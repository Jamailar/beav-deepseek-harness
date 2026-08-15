import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { BeavTaskNodeData } from './conversation.ts'

export type BeavTaskNodeProps = PropsRuntime<'conversation.chat.node', 'beav-task'> & { openBeav(): void }

const terminal = new Set(['completed', 'cancelled', 'failed', 'expired'])

export function BeavTaskNode({ node, openBeav }: BeavTaskNodeProps) {
  const data: BeavTaskNodeData = node.data
  return (
    <section style={{ margin: '10px 0', padding: 14, border: '1px solid var(--border, #d8d8d8)', borderRadius: 12, background: 'var(--surface, transparent)' }} aria-label="Beav task">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <strong>Beav · {data.title}</strong>
        <span>{data.status}</span>
      </div>
      {data.message ? <p style={{ margin: '8px 0 0' }}>{data.message}</p> : null}
      {data.artifacts.length ? <ul style={{ margin: '8px 0', paddingLeft: 20 }}>{data.artifacts.map(item => <li key={item.id}>{item.title} · {item.kind}</li>)}</ul> : null}
      {data.status === 'completed' ? <div style={{ marginTop: 8 }}>✓ {data.readBackVerified ? 'Artifacts verified' : 'Verification incomplete'}</div> : null}
      <button type="button" onClick={openBeav} style={{ marginTop: 10 }}>Open Beav</button>
      {!terminal.has(data.status) && data.status === 'awaiting_approval' ? <span style={{ marginLeft: 10 }}>Approval is waiting in Beav</span> : null}
    </section>
  )
}
