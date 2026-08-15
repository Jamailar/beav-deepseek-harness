import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client'
import type { BeavTaskSnapshot } from '../agent/events.ts'

export interface BeavTaskNodeData extends BeavTaskSnapshot { readonly seq: number }

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap { 'beav-task': BeavTaskNodeData }
}

function isTaskEvent(event: SessionEvent): event is SessionEvent<'beav/task-started' | 'beav/task-state' | 'beav/task-ended'> {
  return event.type === 'beav/task-started' || event.type === 'beav/task-state' || event.type === 'beav/task-ended'
}

export const beavTaskDefinition: ConversationNodeDefinition<BeavTaskNodeData> = {
  kind: 'beav-task',
  target: 'chat',
  match(event) {
    if (event.type === 'beav/task-started') return { id: event.data.taskId, role: 'start' }
    if (event.type === 'beav/task-state' || event.type === 'beav/task-ended') return { id: event.data.taskId, role: 'update' }
    return null
  },
  start(_context, match) {
    if (!isTaskEvent(match.event)) throw new Error('Beav task node requires a Beav task event')
    return { ...match.event.data, seq: match.event.seq }
  },
  update(context, match) {
    if (!isTaskEvent(match.event)) return context.state
    return { ...match.event.data, seq: match.event.seq }
  },
  publication: match => match.event.type === 'beav/task-state' ? 'animation-frame' : 'immediate',
  buildViewNode(context) {
    if (!context.state) return null
    return {
      key: context.key, kind: 'beav-task', id: context.id, target: 'chat', anchorSeq: context.state.seq,
      location: context.start?.location ?? { kind: 'unresolved' }, visibility: 'visible', data: context.state,
    }
  },
}
