import type { Agent } from '@deepseek-ai/dsh-agent'
import type { JobId, JobOutcome } from '@deepseek-ai/dsh-jobs'
import type { BeavArtifact, BeavTask } from '../shared/contract.ts'
import type { BeavService } from '../runtime/service.ts'
import type { BeavTaskSnapshot } from './events.ts'

const TERMINAL = new Set(['completed', 'cancelled', 'failed', 'expired'])

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
  })
}

function publicArtifact(artifact: BeavArtifact) {
  return { id: artifact.id, kind: artifact.kind, title: artifact.title, ...(artifact.summary ? { summary: artifact.summary } : {}) }
}

function snapshot(task: BeavTask, title: string, jobId: JobId | undefined, artifacts: BeavArtifact[], message?: string): BeavTaskSnapshot {
  return {
    taskId: task.id, ...(jobId ? { jobId: String(jobId) } : {}), title, status: task.status,
    readBackVerified: task.completion?.readBackVerified === true,
    artifacts: artifacts.map(publicArtifact), ...(message ? { message } : {}),
  }
}

export function startBeavJob(ctx: { jobs: import('@deepseek-ai/dsh-jobs').default; beav: BeavService }, owner: Agent, initial: BeavTask, title: string): JobId {
  const controller = new AbortController()
  let jobId: JobId | undefined
  let output = ''
  const watch = async (): Promise<JobOutcome> => {
    let task = initial
    let previous = ''
    let interval = 500
    const artifacts: BeavArtifact[] = []
    while (!controller.signal.aborted && !TERMINAL.has(task.status)) {
      const key = JSON.stringify([task.status, task.completion?.artifactIds ?? [], task.completion?.readBackVerified])
      if (key !== previous) {
        previous = key
        const state = snapshot(task, title, jobId, artifacts)
        owner.session.append('beav/task-state', state)
        output += `${task.status}\n`
      }
      await delay(interval, controller.signal)
      if (controller.signal.aborted) break
      try {
        task = await ctx.beav.getTask(task.id, controller.signal)
        interval = task.status === 'awaiting_approval' ? 5_000 : Math.min(interval * 2, 5_000)
      } catch (error) {
        if (controller.signal.aborted) break
        output += `connection retry: ${error instanceof Error ? error.message : 'unknown error'}\n`
        await delay(2_000, controller.signal)
      }
    }
    if (controller.signal.aborted) {
      const final = snapshot(task, title, jobId, artifacts, 'Cancellation requested')
      owner.session.append('beav/task-ended', final)
      return { status: 'killed', detail: 'cancelled', output: JSON.stringify(final) }
    }
    if (task.status === 'completed') {
      for (const artifactId of task.completion?.artifactIds ?? []) {
        const artifact = await ctx.beav.getArtifact(artifactId)
        artifacts.push(artifact)
        owner.session.append('beav/task-artifact', { taskId: task.id, artifact: publicArtifact(artifact) })
      }
      if (task.completion?.readBackVerified !== true) {
        const final = snapshot(task, title, jobId, artifacts, 'Artifact read-back was not verified')
        owner.session.append('beav/task-ended', final)
        return { status: 'failed', detail: 'artifact read-back unverified', output: JSON.stringify(final) }
      }
      const final = snapshot(task, title, jobId, artifacts)
      owner.session.append('beav/task-ended', final)
      return { status: 'completed', detail: `${artifacts.length} verified artifact(s)`, output: JSON.stringify(final) }
    }
    const final = snapshot(task, title, jobId, artifacts, `Beav task ended as ${task.status}`)
    owner.session.append('beav/task-ended', final)
    return { status: task.status === 'cancelled' ? 'killed' : 'failed', detail: task.status, output: JSON.stringify(final) }
  }

  jobId = ctx.jobs.start({
    kind: 'beav', label: title, owner, outputLimitBytes: 50_000,
    run: () => {
      const done = Promise.resolve().then(watch).catch((error: unknown): JobOutcome => ({
        status: 'failed', detail: error instanceof Error ? error.message : 'Beav watcher failed',
      }))
      return {
        cancel(reason) {
          if (controller.signal.aborted) return
          void ctx.beav.cancelTask(initial.id).catch(() => {})
          controller.abort(reason ?? 'cancelled')
        },
        done,
        readOutput() { const value = output; output = ''; return value },
      }
    },
  })
  owner.session.append('beav/task-started', snapshot(initial, title, jobId, []))
  return jobId
}
