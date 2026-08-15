import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { InputTriggerServiceContract } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { BeavStatus } from '../shared/contract.ts'
import { BEAV_REMOTE, type BeavRemoteFace } from './remote.ts'
import { createBeavInputSource } from './input-source.ts'
import { beavTaskDefinition } from './conversation.ts'
import { BeavTaskNode } from './BeavTaskNode.tsx'
import { BeavSettingsCard, type BeavStatusStore } from './BeavSettingsCard.tsx'

export const inject = ['remote', 'reflect', 'slots', 'conversationEvents', 'inputTriggers']

const EMPTY_STATUS: BeavStatus = {
  connected: false, configured: false, state: 'not-running', message: 'Start Beav and enable its Creator Gateway.',
}

export function apply(ctx: ClientContext): void {
  let remote: BeavRemoteFace | undefined
  let status = EMPTY_STATUS
  const listeners = new Set<() => void>()
  const publish = (value: BeavStatus) => { status = value; for (const listener of listeners) listener() }

  const refresh = async () => {
    if (!remote) return
    const result = await remote.getStatus()
    publish(result.ok ? result.value : { ...EMPTY_STATUS, message: result.error.message })
  }
  const store: BeavStatusStore = {
    getSnapshot: () => status,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    refresh() { void refresh() },
    open() { if (remote) void remote.openApp() },
    async connect(token) {
      if (!remote) return false
      const result = await remote.configureToken(token)
      if (result.ok) publish(result.value)
      return result.ok
    },
    async disconnect() {
      if (!remote) return
      const result = await remote.disconnect()
      if (result.ok) publish(result.value)
    },
  }

  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(BEAV_REMOTE)
    remote = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.beav') as BeavRemoteFace | undefined
    await refresh()
    return () => { remote = undefined; void dispose() }
  }, 'beav: remote')

  ctx.conversationEvents.register(beavTaskDefinition)

  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node', key: 'beav-task',
    inject: () => ({ openBeav: () => store.open() }),
  }, BeavTaskNode))

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item', id: 'beav', order: 40,
    inject: () => ({ store }),
  }, BeavSettingsCard))

  const inputTriggers = ctx.get('inputTriggers') as InputTriggerServiceContract
  const source = createBeavInputSource(async (signal) => {
    if (!remote) return []
    const result = await remote.listResources()
    if (signal.aborted || !result.ok) return []
    return result.value
  })
  ctx.effect(() => inputTriggers.registerSource(source), 'beav: @beav resources')
}
