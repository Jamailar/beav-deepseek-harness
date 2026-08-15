import type { BeavArtifact, BeavRunStatus } from '../shared/contract.ts'

export interface BeavTaskSnapshot {
  readonly taskId: string
  readonly jobId?: string
  readonly title: string
  readonly status: BeavRunStatus
  readonly readBackVerified: boolean
  readonly artifacts: readonly Pick<BeavArtifact, 'id' | 'kind' | 'title' | 'summary'>[]
  readonly message?: string
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'beav/task-started': BeavTaskSnapshot
    'beav/task-state': BeavTaskSnapshot
    'beav/task-artifact': { taskId: string; artifact: Pick<BeavArtifact, 'id' | 'kind' | 'title' | 'summary'> }
    'beav/task-ended': BeavTaskSnapshot
  }
}

declare module '@deepseek-ai/dsh-jobs' {
  interface JobKindMap { beav: 'beav' }
}
