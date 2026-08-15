import { describe, expect, it } from 'vitest'
import { normalizeCreatorBaseUrl } from '../src/runtime/discovery.ts'
import { referenceText } from '../src/shared/contract.ts'

describe('Beav connection boundaries', () => {
  it('accepts loopback HTTP and pins the Creator API root', () => {
    expect(normalizeCreatorBaseUrl('http://127.0.0.1:41700')).toBe('http://127.0.0.1:41700/creator/v1')
    expect(normalizeCreatorBaseUrl('http://localhost:41700/legacy/path')).toBe('http://localhost:41700/creator/v1')
  })

  it('rejects remote and encrypted endpoints because this connector is local-only', () => {
    expect(() => normalizeCreatorBaseUrl('https://127.0.0.1:41700')).toThrow('loopback HTTP')
    expect(() => normalizeCreatorBaseUrl('http://192.168.1.3:41700')).toThrow('loopback HTTP')
  })

  it('serializes a stable Beav reference without leaking paths or credentials', () => {
    expect(referenceText({ id: 'ws-1', kind: 'workspace', name: 'Cars <CN>' }))
      .toBe('<beav-ref kind="workspace" id="ws-1">Cars &lt;CN&gt;</beav-ref> ')
  })
})
