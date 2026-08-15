import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import open from 'open'
import type {
  BeavArtifact, BeavDelegateInput, BeavPairingStatus, BeavProject, BeavResourceCandidate, BeavStatus, BeavTask, BeavWorkspace,
} from '../shared/contract.ts'
import { BeavGatewayClient, BeavGatewayError, createPairingMaterial, type GatewayConfig } from './gateway-client.ts'

const PAIRING_SCOPES = [
  'manifest:read', 'guide:read', 'session:read', 'session:write', 'run:read', 'run:write', 'artifact:read',
] as const

declare module '@deepseek-ai/cordis' {
  interface Context { beav: BeavService }
}

export class BeavService extends TypertRemoteService {
  private readonly gateway: BeavGatewayClient
  private statusCache?: { at: number; value: BeavStatus }
  private readonly pairings = new Map<string, { verifier: string; expiresAt: number }>()

  constructor(ctx: Context, private readonly config: GatewayConfig) {
    super(ctx, 'beav')
    this.gateway = new BeavGatewayClient(ctx.credentials, config)
  }

  private async withAutoLaunch<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (this.config.autoLaunch !== 'on-demand' || !(error instanceof BeavGatewayError) || !['NOT_RUNNING', 'UNREACHABLE'].includes(error.code)) throw error
      await this.open()
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
        try { await this.gateway.health(); return await operation() } catch { /* keep the bounded retry */ }
      }
      throw error
    }
  }

  async status(signal?: AbortSignal): Promise<BeavStatus> {
    if (this.statusCache && Date.now() - this.statusCache.at < 2_000) return this.statusCache.value
    const credential = await this.gateway.describeCredential()
    try {
      const health = await this.gateway.health(signal)
      const version = typeof health.version === 'string' ? health.version : undefined
      const workspaces = await this.gateway.listWorkspaces(signal)
      const value: BeavStatus = {
        connected: true, configured: credential.configured, state: 'connected',
        ...(version ? { version } : {}), workspaceCount: workspaces.length,
        message: `Connected to Beav${version ? ` ${version}` : ''}`,
      }
      this.statusCache = { at: Date.now(), value }
      return value
    } catch (error) {
      const code = error instanceof BeavGatewayError ? error.code : 'UNREACHABLE'
      const state = code === 'UNAUTHORIZED' ? 'unauthorized' : code === 'GATEWAY_DISABLED' ? 'gateway-disabled' : code === 'NOT_RUNNING' ? 'not-running' : 'unreachable'
      const value: BeavStatus = {
        connected: false, configured: credential.configured, state,
        message: error instanceof Error ? error.message : 'Beav is unavailable',
      }
      this.statusCache = { at: Date.now(), value }
      return value
    }
  }

  listWorkspaces(signal?: AbortSignal): Promise<BeavWorkspace[]> { return this.withAutoLaunch(() => this.gateway.listWorkspaces(signal)) }
  listProjects(workspaceId: string, signal?: AbortSignal): Promise<BeavProject[]> { return this.withAutoLaunch(() => this.gateway.listProjects(workspaceId, signal)) }
  delegate(input: BeavDelegateInput, signal?: AbortSignal): Promise<BeavTask> { return this.withAutoLaunch(() => this.gateway.delegate(input, signal)) }
  getTask(taskId: string, signal?: AbortSignal): Promise<BeavTask> { return this.withAutoLaunch(() => this.gateway.getTask(taskId, signal)) }
  cancelTask(taskId: string, signal?: AbortSignal): Promise<BeavTask> { return this.withAutoLaunch(() => this.gateway.cancelTask(taskId, signal)) }
  getArtifact(artifactId: string, signal?: AbortSignal): Promise<BeavArtifact> { return this.withAutoLaunch(() => this.gateway.getArtifact(artifactId, signal)) }

  async open(intent = 'beav://open'): Promise<void> {
    const url = new URL(intent)
    if (url.protocol !== 'beav:') throw new Error('Only Beav links can be opened')
    await open(url.toString(), { wait: false })
  }

  @Remote async getStatus(): Promise<BeavStatus> { return this.status() }

  @Remote async listResources(): Promise<BeavResourceCandidate[]> {
    const workspaces = await this.listWorkspaces()
    const projects = await Promise.all(workspaces.map(workspace => this.listProjects(workspace.id).catch(() => [])))
    return [
      ...workspaces.map(workspace => ({ id: workspace.id, kind: 'workspace' as const, name: workspace.name, ...(workspace.description ? { description: workspace.description } : {}) })),
      ...projects.flat().map(project => ({ id: project.id, kind: 'project' as const, name: project.name, ...(project.description ? { description: project.description } : {}) })),
    ].slice(0, 200)
  }

  @Remote async openApp(): Promise<boolean> {
    await this.open()
    return true
  }

  @Remote async beginPairing(): Promise<BeavPairingStatus> {
    const material = createPairingMaterial()
    this.pairings.set(material.requestId, { verifier: material.verifier, expiresAt: material.expiresAt })
    const url = new URL('beav://connect/authorize')
    url.searchParams.set('requestId', material.requestId)
    url.searchParams.set('challenge', material.challenge)
    url.searchParams.set('clientName', 'DeepSeek Harness')
    url.searchParams.set('clientKind', 'deepseek_harness')
    url.searchParams.set('scopes', PAIRING_SCOPES.join(','))
    try {
      await this.open(url.toString())
    } catch (error) {
      this.pairings.delete(material.requestId)
      throw error
    }
    return {
      requestId: material.requestId,
      state: 'waiting-for-app',
      message: 'Approve the connection in Beav.',
      expiresAt: material.expiresAt,
    }
  }

  @Remote async getPairingStatus(requestId: string): Promise<BeavPairingStatus> {
    const pairing = this.pairings.get(requestId)
    if (!pairing) {
      return { requestId, state: 'failed', message: 'Pairing request is not active in this Harness process.', expiresAt: Date.now() }
    }
    if (Date.now() > pairing.expiresAt) {
      this.pairings.delete(requestId)
      return { requestId, state: 'expired', message: 'The Beav connection request expired. Try again.', expiresAt: pairing.expiresAt }
    }
    try {
      const remote = await this.gateway.pairingStatus(requestId)
      if (remote.state === 'pending') {
        return { requestId, state: 'pending', message: 'Waiting for approval in Beav.', expiresAt: remote.expiresAt }
      }
      if (remote.state === 'denied') {
        this.pairings.delete(requestId)
        return { requestId, state: 'denied', message: 'The connection was denied in Beav.', expiresAt: remote.expiresAt }
      }
      if (remote.state === 'expired') {
        this.pairings.delete(requestId)
        return { requestId, state: 'expired', message: 'The Beav connection request expired. Try again.', expiresAt: remote.expiresAt }
      }
      if (remote.state === 'approved') {
        const token = await this.gateway.exchangePairing(requestId, pairing.verifier)
        await this.gateway.setCredential(token)
        this.pairings.delete(requestId)
        this.statusCache = undefined
        const status = await this.status()
        return {
          requestId,
          state: status.connected ? 'connected' : 'failed',
          message: status.connected ? 'Connected to Beav.' : status.message,
          expiresAt: remote.expiresAt,
          status,
        }
      }
      this.pairings.delete(requestId)
      return { requestId, state: 'failed', message: 'This pairing credential was already exchanged.', expiresAt: remote.expiresAt }
    } catch (error) {
      if (error instanceof BeavGatewayError && ['NOT_RUNNING', 'UNREACHABLE', 'pairing_not_found'].includes(error.code)) {
        return { requestId, state: 'waiting-for-app', message: 'Waiting for Beav to open.', expiresAt: pairing.expiresAt }
      }
      return {
        requestId,
        state: 'failed',
        message: error instanceof Error ? error.message : 'Beav pairing failed.',
        expiresAt: pairing.expiresAt,
      }
    }
  }

  @Remote async configureToken(token: string): Promise<BeavStatus> {
    if (!token.trim()) throw new Error('Beav token cannot be empty')
    await this.gateway.setCredential(token.trim())
    this.statusCache = undefined
    return this.status()
  }

  @Remote async disconnect(): Promise<BeavStatus> {
    this.pairings.clear()
    try { await this.gateway.revokeCurrentClient() } catch { /* local credential is still removed below */ }
    await this.gateway.unsetCredential()
    this.statusCache = undefined
    return this.status()
  }
}
