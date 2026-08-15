import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { BeavResourceCandidate } from '../shared/contract.ts'
import { referenceText } from '../shared/contract.ts'

export function createBeavInputSource(load: (signal: AbortSignal) => Promise<readonly BeavResourceCandidate[]>): InputTriggerSource {
  let cached: readonly BeavResourceCandidate[] = []
  return {
    trigger: '@',
    name: 'beav',
    async candidates(_session, { query, signal }) {
      cached = await load(signal)
      const needle = query.trim().toLocaleLowerCase()
      return cached.filter(item => !needle || `${item.name} ${item.description ?? ''}`.toLocaleLowerCase().includes(needle)).slice(0, 20).map(item => ({
        name: item.name,
        description: `${item.kind === 'workspace' ? 'Beav workspace' : 'Beav project'}${item.description ? ` · ${item.description}` : ''}`,
        icon: item.kind === 'workspace' ? '◫' : '◇',
      }))
    },
    onPick({ candidate }) {
      const item = cached.find(entry => entry.name === candidate.name)
      return item ? { text: referenceText(item) } : undefined
    },
  }
}
