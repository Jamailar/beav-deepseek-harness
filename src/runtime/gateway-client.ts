import type { CredentialProvider, CredentialRef } from '@deepseek-ai/dsh-credentials'
import type {
  BeavArtifact, BeavCompletion, BeavDelegateInput, BeavProject, BeavRunStatus, BeavTask, BeavWorkspace,
} from '../shared/contract.ts'
import { discoverCreatorBaseUrl } from './discovery.ts'

export class BeavGatewayError extends Error {
  constructor(readonly code: string, message: string, readonly status?: number) {
    super(message)
    this.name = 'BeavGatewayError'
  }
}

export interface GatewayConfig {
  endpoint?: string
  tokenRef: CredentialRef
  requestTimeoutMs: number
  autoLaunch: 'never' | 'on-demand'
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new BeavGatewayError('INVALID_RESPONSE', `${label} response is invalid`)
  return value as Record<string, unknown>
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function beavMessage(value: string): string {
  return value.replaceAll(/RedBox|RedConvert|Read Books/giu, 'Beav')
}

export class BeavGatewayClient {
  constructor(private readonly credentials: CredentialProvider, private readonly config: GatewayConfig) {}

  private async request(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const baseUrl = await discoverCreatorBaseUrl(this.config.endpoint)
    if (!baseUrl) throw new BeavGatewayError('NOT_RUNNING', 'Beav is not running or its Creator Gateway is disabled')
    const resolved = await this.credentials.resolve(this.config.tokenRef)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(new Error('Beav request timed out')), this.config.requestTimeoutMs)
    const abort = () => controller.abort(signal?.reason)
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          accept: 'application/json',
          ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(resolved === undefined ? {} : { authorization: `Bearer ${resolved.value}` }),
          ...init.headers,
        },
        signal: controller.signal,
      })
      const body = record(await response.json().catch(() => ({})), 'Beav')
      if (!response.ok || body.success === false) {
        const errorBody = typeof body.error === 'object' && body.error !== null && !Array.isArray(body.error) ? body.error as Record<string, unknown> : {}
        const rawCode = text(errorBody.code, `HTTP_${response.status}`)
        const code = rawCode.toLowerCase() === 'gateway_disabled'
          ? 'GATEWAY_DISABLED'
          : response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : rawCode
        throw new BeavGatewayError(code, beavMessage(text(errorBody.message, typeof body.error === 'string' ? body.error : `Beav request failed (${response.status})`)), response.status)
      }
      return body
    } catch (error) {
      if (error instanceof BeavGatewayError) throw error
      if (controller.signal.aborted) throw new BeavGatewayError('ABORTED', controller.signal.reason instanceof Error ? controller.signal.reason.message : 'Beav request aborted')
      throw new BeavGatewayError('UNREACHABLE', beavMessage(error instanceof Error ? error.message : 'Beav is unreachable'))
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }

  describeCredential() { return this.credentials.describe(this.config.tokenRef) }
  setCredential(value: string) { return this.credentials.set(this.config.tokenRef, value) }
  unsetCredential() { return this.credentials.unset(this.config.tokenRef) }

  health(signal?: AbortSignal) { return this.request('/health', {}, signal) }

  async listWorkspaces(signal?: AbortSignal): Promise<BeavWorkspace[]> {
    const body = await this.request('/workspaces', {}, signal)
    const values = Array.isArray(body.workspaces) ? body.workspaces : []
    return values.slice(0, 100).map(value => {
      const item = record(value, 'workspace')
      return { id: text(item.id), name: text(item.name, text(item.title, 'Untitled workspace')), ...(typeof item.description === 'string' ? { description: item.description } : {}) }
    }).filter(item => item.id.length > 0)
  }

  async listProjects(workspaceId: string, signal?: AbortSignal): Promise<BeavProject[]> {
    const body = await this.request(`/workspaces/${encodeURIComponent(workspaceId)}/projects`, {}, signal)
    const values = Array.isArray(body.projects) ? body.projects : []
    return values.slice(0, 100).map(value => {
      const item = record(value, 'project')
      return { id: text(item.id), workspaceId, name: text(item.name, text(item.title, 'Untitled project')), ...(typeof item.description === 'string' ? { description: item.description } : {}) }
    }).filter(item => item.id.length > 0)
  }

  async delegate(input: BeavDelegateInput, signal?: AbortSignal): Promise<BeavTask> {
    const body = await this.request('/tasks', { method: 'POST', body: JSON.stringify({ ...input, client: { name: 'DeepSeek Harness', version: '0.1.0' } }) }, signal)
    return normalizeTask(record(body.task, 'task'), body.completion)
  }

  async getTask(taskId: string, signal?: AbortSignal): Promise<BeavTask> {
    const body = await this.request(`/tasks/${encodeURIComponent(taskId)}`, {}, signal)
    const task = record(body.task, 'task')
    const metadata = typeof task.metadata === 'object' && task.metadata !== null ? task.metadata as Record<string, unknown> : {}
    return normalizeTask(task, metadata.completion ?? metadata.creatorCompletion)
  }

  async cancelTask(taskId: string, signal?: AbortSignal): Promise<BeavTask> {
    const body = await this.request(`/tasks/${encodeURIComponent(taskId)}/cancel`, { method: 'POST', body: '{}' }, signal)
    return normalizeTask(record(body.task, 'task'), body.completion)
  }

  async getArtifact(artifactId: string, signal?: AbortSignal): Promise<BeavArtifact> {
    const body = await this.request(`/artifacts/${encodeURIComponent(artifactId)}`, {}, signal)
    const item = record(body.artifact, 'artifact')
    return {
      id: text(item.id), kind: text(item.kind, 'artifact'), title: text(item.title, 'Beav artifact'),
      ...(typeof item.summary === 'string' ? { summary: item.summary } : {}),
      refs: Array.isArray(item.refs) ? item.refs : [], ...(item.payload === undefined ? {} : { payload: item.payload }),
    }
  }
}

function normalizeCompletion(value: unknown): BeavCompletion | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const data = value as Record<string, unknown>
  const strings = (input: unknown) => Array.isArray(input) ? input.filter((entry): entry is string => typeof entry === 'string') : []
  return {
    requiredArtifacts: strings(data.requiredArtifacts), satisfiedArtifacts: strings(data.satisfiedArtifacts),
    missingArtifacts: strings(data.missingArtifacts), artifactIds: strings(data.artifactIds),
    readBackVerified: data.readBackVerified === true,
  }
}

function normalizeTask(task: Record<string, unknown>, completionValue: unknown): BeavTask {
  const statusRecord = typeof task.status === 'object' && task.status !== null ? task.status as Record<string, unknown> : {}
  const metadata = typeof task.metadata === 'object' && task.metadata !== null ? task.metadata as Record<string, unknown> : {}
  const runStatus = text(metadata.redboxRunStatus, text(statusRecord.state, 'running')) as BeavRunStatus
  return {
    id: text(task.id), ...(typeof task.contextId === 'string' ? { contextId: task.contextId } : {}), status: runStatus,
    ...(typeof task.title === 'string' ? { title: task.title } : {}), artifacts: Array.isArray(task.artifacts) ? task.artifacts : [],
    ...(normalizeCompletion(completionValue ?? metadata.creatorCompletion ?? metadata.completion) ? { completion: normalizeCompletion(completionValue ?? metadata.creatorCompletion ?? metadata.completion) } : {}),
    raw: task,
  }
}
