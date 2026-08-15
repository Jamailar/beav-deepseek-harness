import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import { startBeavJob } from './jobs.ts'

const jsonOutput = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value) }],
}

function asJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue
}

export function registerTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'beav_status', description: 'Check whether the local Beav app and Creator Gateway are available.', parameters: {}, output: jsonOutput,
    execute: async (_args, exec) => asJson(await ctx.beav.status(exec.signal)),
  }))
  ctx.tools.register(defineTool({
    name: 'beav_list_workspaces', description: 'List bounded Beav workspace summaries so an explicit workspace can be selected.', parameters: {}, output: jsonOutput,
    execute: async (_args, exec) => asJson(await ctx.beav.listWorkspaces(exec.signal)),
  }))
  ctx.tools.register(defineTool({
    name: 'beav_list_projects', description: 'List bounded Beav project summaries in one workspace.',
    parameters: { workspaceId: { type: 'string', required: true, description: 'Stable Beav workspace id.' } }, output: jsonOutput,
    execute: async (args, exec) => asJson(await ctx.beav.listProjects(args.workspaceId, exec.signal)),
  }))
  ctx.tools.register(defineTool({
    name: 'beav_delegate',
    description: 'Delegate one durable knowledge-backed content, image, audio, or video task to Beav. Returns a native Harness background job id.',
    parameters: {
      workspaceId: { type: 'string', required: true, description: 'Stable Beav workspace id.' },
      objective: { type: 'string', required: true, description: 'Concrete desired outcome.' },
      projectId: { type: 'string', description: 'Optional stable Beav project id.' },
      platform: { type: 'string', description: 'Optional target platform.' },
      audience: { type: 'string', description: 'Optional intended audience.' },
      requiredArtifacts: { type: 'array', items: { type: 'string' }, description: 'Required artifact kinds.' },
      acceptanceCriteria: { type: 'array', items: { type: 'string' }, description: 'Verifiable completion criteria.' },
      idempotencyKey: { type: 'string', description: 'Stable retry identity. Omit to derive it from this Harness tool call.' },
    },
    output: jsonOutput,
    async execute(args, exec) {
      if (!exec.agent) throw new Error('beav_delegate requires a live Harness agent')
      const task = await ctx.beav.delegate({
        workspaceId: args.workspaceId, objective: args.objective,
        idempotencyKey: args.idempotencyKey ?? `${String(exec.agent.session.id)}:${String(exec.rootCallId)}`,
        ...(args.projectId ? { projectId: args.projectId } : {}), ...(args.platform ? { platform: args.platform } : {}),
        ...(args.audience ? { audience: args.audience } : {}), ...(args.requiredArtifacts ? { requiredArtifacts: args.requiredArtifacts } : {}),
        ...(args.acceptanceCriteria ? { acceptanceCriteria: args.acceptanceCriteria } : {}), externalThreadId: String(exec.agent.session.id),
      }, exec.signal)
      const jobId = startBeavJob(ctx, exec.agent, task, args.objective.slice(0, 120))
      return asJson({ taskId: task.id, jobId: String(jobId), status: task.status })
    },
  }))
  ctx.tools.register(defineTool({
    name: 'beav_task_get', description: 'Read one durable Beav task and its completion evidence.',
    parameters: { taskId: { type: 'string', required: true, description: 'Beav task id.' } }, output: jsonOutput,
    execute: async (args, exec) => asJson(await ctx.beav.getTask(args.taskId, exec.signal)),
  }))
  ctx.tools.register(defineTool({
    name: 'beav_task_cancel', description: 'Request cancellation of one Beav task. The returned state is authoritative.',
    parameters: { taskId: { type: 'string', required: true, description: 'Beav task id.' } }, output: jsonOutput,
    execute: async (args, exec) => asJson(await ctx.beav.cancelTask(args.taskId, exec.signal)),
  }))
  ctx.tools.register(defineTool({
    name: 'beav_artifact_get', description: 'Read one persisted Beav artifact by id without transferring unbounded media bytes.',
    parameters: { artifactId: { type: 'string', required: true, description: 'Beav artifact id.' } }, output: jsonOutput,
    execute: async (args, exec) => asJson(await ctx.beav.getArtifact(args.artifactId, exec.signal)),
  }))
}
