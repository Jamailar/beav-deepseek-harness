import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import open from 'open'
import type {
  BeavArtifact, BeavDelegateInput, BeavProject, BeavResourceCandidate, BeavStatus, BeavTask, BeavWorkspace,
} from '../shared/contract.ts'
import { BeavGatewayClient, BeavGatewayError, type GatewayConfig } from './gateway-client.ts'

declare module '@deepseek-ai/cordis' {
  interface Context { beav: BeavService }
}

export class BeavService extends TypertRemoteService {
  private readonly gateway: BeavGatewayClient
  private statusCache?: { at: number; value: BeavStatus }

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

  @Remote async configureToken(token: string): Promise<BeavStatus> {
    if (!token.trim()) throw new Error('Beav token cannot be empty')
    await this.gateway.setCredential(token.trim())
    this.statusCache = undefined
    return this.status()
  }

  @Remote async disconnect(): Promise<BeavStatus> {
    await this.gateway.unsetCredential()
    this.statusCache = undefined
    return this.status()
  }
}
