import type { TypertContribution } from '@deepseek-ai/dsh-typert-registry/types'
import { BEAV_INVOCATIONS } from '../shared/contract.ts'

export const TYPERT_MANIFEST: TypertContribution = {
  package: 'beav-deepseek-harness',
  face: 'host',
  schemas: [],
  model: {
    services: [{
      key: 'beav', exportName: 'BeavService', description: 'Beav connection, resources, durable tasks, and artifacts.', tags: [],
      members: [
        { kind: 'method', name: 'getStatus', signature: 'getStatus(): Promise<BeavStatus>' },
        { kind: 'method', name: 'listResources', signature: 'listResources(): Promise<readonly BeavResourceCandidate[]>' },
        { kind: 'method', name: 'openApp', signature: 'openApp(): Promise<boolean>' },
        { kind: 'method', name: 'beginPairing', signature: 'beginPairing(): Promise<BeavPairingStatus>' },
        { kind: 'method', name: 'getPairingStatus', signature: 'getPairingStatus(requestId: string): Promise<BeavPairingStatus>' },
        { kind: 'method', name: 'configureToken', signature: 'configureToken(token: string): Promise<BeavStatus>' },
        { kind: 'method', name: 'disconnect', signature: 'disconnect(): Promise<BeavStatus>' },
      ], types: [],
    }],
    events: [], objects: [],
  },
  invocations: BEAV_INVOCATIONS,
}
