import { describe, expect, it } from 'vitest'
import { BEAV_SETTINGS_NAMESPACE } from '../src/shared/contract.ts'

describe('Beav settings slot identity', () => {
  it('uses a settings namespace that rc.7+ can dispatch as a keyed slot', () => {
    expect(BEAV_SETTINGS_NAMESPACE).toBe('beav')
    expect(/^[a-z][a-z0-9-]*$/.test(BEAV_SETTINGS_NAMESPACE)).toBe(true)
  })
})
