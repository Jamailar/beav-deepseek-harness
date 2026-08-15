import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-jobs'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-typert-registry'
import { BeavService } from './runtime/service.ts'
import { TYPERT_MANIFEST } from './runtime/typert.ts'
import { registerTools } from './agent/tools.ts'
import { registerCommands } from './agent/commands.ts'
import { registerPrompt } from './agent/prompt.ts'
import './agent/events.ts'

export const name = 'beav-creator-dsh'
export const inject = ['credentials', 'tools', 'commands', 'jobs', 'systemPrompt', 'typert']

export interface Config {
  endpoint?: string
  tokenRef: string
  autoLaunch: 'never' | 'on-demand'
  requestTimeoutMs: number
}

export const Config = z.object({
  endpoint: z.string(),
  tokenRef: z.string().default('BEAV_CREATOR_TOKEN'),
  autoLaunch: z.union(['never', 'on-demand']).default('on-demand'),
  requestTimeoutMs: z.natural().min(1_000).default(30_000),
})

export function apply(ctx: Context, input?: Config): void {
  const config = Config(input ?? {})
  new BeavService(ctx, {
    ...(config.endpoint?.trim() ? { endpoint: config.endpoint.trim() } : {}),
    tokenRef: credentialRef(config.tokenRef), requestTimeoutMs: config.requestTimeoutMs, autoLaunch: config.autoLaunch,
  })
  ctx.effect(() => {
    const dispose = ctx.typert.register(TYPERT_MANIFEST)
    return () => { void dispose() }
  }, 'beav: typert manifest')
  registerTools(ctx)
  registerCommands(ctx)
  registerPrompt(ctx)
}

export { BeavService } from './runtime/service.ts'
export type * from './shared/contract.ts'
