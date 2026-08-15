import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CredentialInfo, CredentialProvider, CredentialRef, ResolvedCredential } from '@deepseek-ai/dsh-credentials'
import { BeavGatewayClient, createPairingMaterial } from '../src/runtime/gateway-client.ts'

class Credentials {
  value = 'test-token'
  resolve(_ref: CredentialRef): Promise<ResolvedCredential | undefined> { return Promise.resolve({ value: this.value, source: 'test' }) }
  describe(_ref: CredentialRef): Promise<CredentialInfo> { return Promise.resolve({ configured: true, source: 'test', writable: true }) }
  set(_ref: CredentialRef, value: string): Promise<void> { this.value = value; return Promise.resolve() }
  unset(_ref: CredentialRef): Promise<void> { this.value = ''; return Promise.resolve() }
}

describe('Beav Creator Gateway client', () => {
  let server: Server
  let endpoint: string

  beforeEach(async () => {
    server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json')
      const path = request.url ?? ''
      if (path === '/creator/v1/pairings/pairing-1') {
        if (request.headers.authorization) response.statusCode = 400
        response.end(JSON.stringify({ success: true, pairing: { requestId: 'pairing-1', state: 'approved', expiresAt: 1_900_000_000 } }))
        return
      }
      if (path === '/creator/v1/pairings/pairing-1/exchange' && request.method === 'POST') {
        if (request.headers.authorization) response.statusCode = 400
        response.end(JSON.stringify({ success: true, requestId: 'pairing-1', token: 'paired-token', tokenType: 'Bearer' }))
        return
      }
      if (request.headers.authorization !== 'Bearer test-token') {
        response.statusCode = 401
        response.end(JSON.stringify({ success: false, error: { code: 'AUTH', message: 'denied' } }))
        return
      }
      if (path === '/creator/v1/health') response.end(JSON.stringify({ success: true, version: '2.7.3' }))
      else if (path === '/creator/v1/workspaces') response.end(JSON.stringify({ success: true, workspaces: [{ id: 'ws-1', name: 'Studio' }] }))
      else if (path === '/creator/v1/workspaces/ws-1/projects') response.end(JSON.stringify({ success: true, projects: [{ id: 'pr-1', name: 'Launch' }] }))
      else if (path === '/creator/v1/tasks' && request.method === 'POST') response.end(JSON.stringify({ success: true, task: { id: 'task-1', status: { state: 'working' }, metadata: { redboxRunStatus: 'running' }, artifacts: [] } }))
      else if (path === '/creator/v1/tasks/task-1') response.end(JSON.stringify({ success: true, task: { id: 'task-1', status: { state: 'completed' }, metadata: { redboxRunStatus: 'completed', creatorCompletion: { requiredArtifacts: ['article'], satisfiedArtifacts: ['article'], missingArtifacts: [], artifactIds: ['artifact-1'], readBackVerified: true } }, artifacts: [] } }))
      else if (path === '/creator/v1/artifacts/artifact-1') response.end(JSON.stringify({ success: true, artifact: { id: 'artifact-1', kind: 'article', title: 'Launch article', refs: [] } }))
      else if (path === '/creator/v1/clients/current/revoke' && request.method === 'POST') response.end(JSON.stringify({ success: true, revoked: true }))
      else { response.statusCode = 404; response.end(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'missing' } })) }
    }).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('test server did not bind TCP')
    endpoint = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => { server.close(); await once(server, 'close') })

  it('uses typed workspace, project, task, completion, and artifact contracts', async () => {
    const client = new BeavGatewayClient(new Credentials() as unknown as CredentialProvider, {
      endpoint, tokenRef: 'BEAV_CREATOR_TOKEN' as CredentialRef, requestTimeoutMs: 2_000, autoLaunch: 'never',
    })
    await expect(client.listWorkspaces()).resolves.toEqual([{ id: 'ws-1', name: 'Studio' }])
    await expect(client.listProjects('ws-1')).resolves.toEqual([{ id: 'pr-1', workspaceId: 'ws-1', name: 'Launch' }])
    await expect(client.delegate({ workspaceId: 'ws-1', objective: 'Create launch content', idempotencyKey: 'idem-1' })).resolves.toMatchObject({ id: 'task-1', status: 'running' })
    await expect(client.getTask('task-1')).resolves.toMatchObject({ id: 'task-1', status: 'completed', completion: { readBackVerified: true, artifactIds: ['artifact-1'] } })
    await expect(client.getArtifact('artifact-1')).resolves.toEqual({ id: 'artifact-1', kind: 'article', title: 'Launch article', refs: [] })
    await expect(client.revokeCurrentClient()).resolves.toBeUndefined()
  })

  it('classifies an invalid token without exposing it', async () => {
    const credentials = new Credentials()
    credentials.value = 'wrong-token'
    const client = new BeavGatewayClient(credentials as unknown as CredentialProvider, {
      endpoint, tokenRef: 'BEAV_CREATOR_TOKEN' as CredentialRef, requestTimeoutMs: 2_000, autoLaunch: 'never',
    })
    await expect(client.health()).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 })
  })

  it('uses PKCE pairing endpoints without sending an existing credential', async () => {
    const client = new BeavGatewayClient(new Credentials() as unknown as CredentialProvider, {
      endpoint, tokenRef: 'BEAV_CREATOR_TOKEN' as CredentialRef, requestTimeoutMs: 2_000, autoLaunch: 'never',
    })
    const material = createPairingMaterial(1_700_000_000_000)
    expect(material.requestId).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(material.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(material.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(material.challenge).not.toBe(material.verifier)
    await expect(client.pairingStatus('pairing-1')).resolves.toEqual({ state: 'approved', expiresAt: 1_900_000_000_000 })
    await expect(client.exchangePairing('pairing-1', material.verifier)).resolves.toBe('paired-token')
  })

  it('keeps historical transport branding out of user-visible errors', async () => {
    server.removeAllListeners('request')
    server.on('request', (_request, response) => {
      response.statusCode = 403
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ success: false, error: { code: 'gateway_disabled', message: 'RedBox ACP gateway is disabled.' } }))
    })
    const client = new BeavGatewayClient(new Credentials() as unknown as CredentialProvider, {
      endpoint, tokenRef: 'BEAV_CREATOR_TOKEN' as CredentialRef, requestTimeoutMs: 2_000, autoLaunch: 'never',
    })
    await expect(client.health()).rejects.toMatchObject({ code: 'GATEWAY_DISABLED', message: 'Beav ACP gateway is disabled.' })
  })
})
