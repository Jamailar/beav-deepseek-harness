import { useState, useSyncExternalStore } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { BeavStatus } from '../shared/contract.ts'

export interface BeavStatusStore {
  getSnapshot(): BeavStatus
  subscribe(listener: () => void): () => void
  refresh(): void
  open(): void
  connect(token: string): Promise<boolean>
  disconnect(): Promise<void>
}

export type BeavSettingsCardProps = PropsRuntime<'settings.plugin.item'> & { store: BeavStatusStore }

export function BeavSettingsCard({ store }: BeavSettingsCardProps) {
  const status = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [token, setToken] = useState('')
  return (
    <li style={{ listStyle: 'none', padding: 16, border: '1px solid var(--border, #d8d8d8)', borderRadius: 12 }}>
      <h3 style={{ margin: 0 }}>Beav</h3>
      <p style={{ margin: '6px 0' }}>{status.connected ? 'Connected' : 'Not connected'}{status.version ? ` · ${status.version}` : ''}</p>
      <p style={{ margin: '6px 0 12px', opacity: 0.75 }}>{status.message}</p>
      {!status.configured ? <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input type="password" value={token} onChange={event => setToken(event.target.value)} placeholder="Beav Creator Token" autoComplete="off" />
        <button type="button" disabled={!token.trim()} onClick={() => { void store.connect(token).then(ok => { if (ok) setToken('') }) }}>Connect</button>
      </div> : null}
      <button type="button" onClick={store.refresh}>Refresh</button>
      <button type="button" onClick={store.open} style={{ marginLeft: 8 }}>Open Beav</button>
      {status.configured ? <button type="button" onClick={() => { void store.disconnect() }} style={{ marginLeft: 8 }}>Disconnect</button> : null}
    </li>
  )
}
