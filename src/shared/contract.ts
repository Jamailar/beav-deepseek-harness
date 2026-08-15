import { z } from 'zod'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'

export type BeavRunStatus = 'queued' | 'awaiting_approval' | 'running' | 'completed' | 'cancelled' | 'failed' | 'expired'

export interface BeavStatus {
  readonly connected: boolean
  readonly configured: boolean
  readonly state: 'connected' | 'not-running' | 'gateway-disabled' | 'unauthorized' | 'unreachable' | 'incompatible'
  readonly version?: string
  readonly workspaceCount?: number
  readonly message: string
}

export interface BeavWorkspace {
  readonly id: string
  readonly name: string
  readonly description?: string
}

export interface BeavProject {
  readonly id: string
  readonly workspaceId: string
  readonly name: string
  readonly description?: string
}

export interface BeavCompletion {
  readonly requiredArtifacts: string[]
  readonly satisfiedArtifacts: string[]
  readonly missingArtifacts: string[]
  readonly artifactIds: string[]
  readonly readBackVerified: boolean
}

export interface BeavTask {
  readonly id: string
  readonly contextId?: string
  readonly status: BeavRunStatus
  readonly title?: string
  readonly artifacts: unknown[]
  readonly completion?: BeavCompletion
  readonly raw: Record<string, unknown>
}

export interface BeavArtifact {
  readonly id: string
  readonly kind: string
  readonly title: string
  readonly summary?: string
  readonly refs: unknown[]
  readonly payload?: unknown
}

export interface BeavDelegateInput {
  readonly workspaceId: string
  readonly objective: string
  readonly idempotencyKey: string
  readonly projectId?: string
  readonly platform?: string
  readonly audience?: string
  readonly externalThreadId?: string
  readonly requiredArtifacts?: readonly string[]
  readonly acceptanceCriteria?: readonly string[]
}

export interface BeavResourceCandidate {
  readonly id: string
  readonly kind: 'workspace' | 'project'
  readonly name: string
  readonly description?: string
}

export interface BeavPairingStatus {
  readonly requestId: string
  readonly state: 'waiting-for-app' | 'pending' | 'approved' | 'connected' | 'denied' | 'expired' | 'failed'
  readonly message: string
  readonly expiresAt: number
  readonly status?: BeavStatus
}

const statusSchema = z.object({
  connected: z.boolean(),
  configured: z.boolean(),
  state: z.enum(['connected', 'not-running', 'gateway-disabled', 'unauthorized', 'unreachable', 'incompatible']),
  version: z.string().optional(),
  workspaceCount: z.number().int().nonnegative().optional(),
  message: z.string(),
}).readonly()

const candidateSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['workspace', 'project']),
  name: z.string().min(1),
  description: z.string().optional(),
}).readonly()

const pairingSchema = z.object({
  requestId: z.string().min(1),
  state: z.enum(['waiting-for-app', 'pending', 'approved', 'connected', 'denied', 'expired', 'failed']),
  message: z.string(),
  expiresAt: z.number().int().positive(),
  status: statusSchema.optional(),
}).readonly()

export const BEAV_INVOCATIONS: readonly InvocationDescriptor[] = [
  {
    id: 'beav-deepseek-harness#beav/getStatus', service: 'beav', namespace: 'beav', method: 'getStatus',
    invocation: { kind: 'direct' }, parameters: [],
    result: { mode: 'strict', typeSymbol: 'beav-deepseek-harness#BeavStatus', schema: statusSchema },
  },
  {
    id: 'beav-deepseek-harness#beav/listResources', service: 'beav', namespace: 'beav', method: 'listResources',
    invocation: { kind: 'direct' }, parameters: [],
    result: { mode: 'strict', typeSymbol: 'beav-deepseek-harness#BeavResourceCandidate[]', schema: z.array(candidateSchema) },
  },
  {
    id: 'beav-deepseek-harness#beav/openApp', service: 'beav', namespace: 'beav', method: 'openApp',
    invocation: { kind: 'direct' }, parameters: [],
    result: { mode: 'strict', typeSymbol: 'beav-deepseek-harness#boolean', schema: z.boolean() },
  },
  {
    id: 'beav-deepseek-harness#beav/beginPairing', service: 'beav', namespace: 'beav', method: 'beginPairing',
    invocation: { kind: 'direct' }, parameters: [],
    result: { mode: 'strict', typeSymbol: 'beav-deepseek-harness#BeavPairingStatus', schema: pairingSchema },
  },
  {
    id: 'beav-deepseek-harness#beav/getPairingStatus', service: 'beav', namespace: 'beav', method: 'getPairingStatus',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'requestId', wire: 'requestId', source: 'json', codec: { mode: 'strict', typeSymbol: 'string', schema: z.string().min(1) } }],
    result: { mode: 'strict', typeSymbol: 'beav-deepseek-harness#BeavPairingStatus', schema: pairingSchema },
  },
  {
    id: 'beav-deepseek-harness#beav/configureToken', service: 'beav', namespace: 'beav', method: 'configureToken',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'token', wire: 'token', source: 'json', codec: { mode: 'strict', typeSymbol: 'string', schema: z.string().min(1) } }],
    result: { mode: 'strict', typeSymbol: 'beav-deepseek-harness#BeavStatus', schema: statusSchema },
  },
  {
    id: 'beav-deepseek-harness#beav/disconnect', service: 'beav', namespace: 'beav', method: 'disconnect',
    invocation: { kind: 'direct' }, parameters: [],
    result: { mode: 'strict', typeSymbol: 'beav-deepseek-harness#BeavStatus', schema: statusSchema },
  },
]

export function referenceText(candidate: BeavResourceCandidate): string {
  const escaped = candidate.name.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  return `<beav-ref kind="${candidate.kind}" id="${candidate.id}">${escaped}</beav-ref> `
}
