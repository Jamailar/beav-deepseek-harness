import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { BEAV_INVOCATIONS } from '../shared/contract.ts'
import type { BeavResourceCandidate, BeavStatus } from '../shared/contract.ts'

export const BEAV_REMOTE: TypertRemoteContribution = {
  package: 'beav-deepseek-harness',
  descriptors: BEAV_INVOCATIONS,
}

export interface BeavRemoteFace {
  getStatus(): Promise<RemoteResult<BeavStatus>>
  listResources(): Promise<RemoteResult<readonly BeavResourceCandidate[]>>
  openApp(): Promise<RemoteResult<boolean>>
  configureToken(token: string): Promise<RemoteResult<BeavStatus>>
  disconnect(): Promise<RemoteResult<BeavStatus>>
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespace$62656176 {
    getStatus: () => Promise<RemoteResult<BeavStatus>>
    listResources: () => Promise<RemoteResult<readonly BeavResourceCandidate[]>>
    openApp: () => Promise<RemoteResult<boolean>>
    configureToken: (token: string) => Promise<RemoteResult<BeavStatus>>
    disconnect: () => Promise<RemoteResult<BeavStatus>>
  }
  interface TypertRemoteMap {
    'beav/getStatus': () => Promise<RemoteResult<BeavStatus>>
    'beav/listResources': () => Promise<RemoteResult<readonly BeavResourceCandidate[]>>
    'beav/openApp': () => Promise<RemoteResult<boolean>>
    'beav/configureToken': (token: string) => Promise<RemoteResult<BeavStatus>>
    'beav/disconnect': () => Promise<RemoteResult<BeavStatus>>
  }
  interface TypertRemoteNamespaceMap { beav: TypertRemoteNamespace$62656176 }
}
