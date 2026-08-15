import { readFile } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'

const discoverySchema = z.object({
  baseUrl: z.string().url(),
  ownerPid: z.number().int().positive().optional(),
}).passthrough()

function discoveryPaths(): string[] {
  const override = process.env.BEAV_DISCOVERY_FILE
  if (override) return [override]
  if (platform() === 'darwin') {
    return [
      join(homedir(), 'Library', 'Application Support', 'Beav', 'acp-gateway.json'),
      // Historical install location retained only for upgrades from older Beav builds.
      join(homedir(), 'Library', 'Application Support', 'RedBox', 'acp-gateway.json'),
    ]
  }
  if (platform() === 'win32') {
    const appData = process.env.APPDATA
    return appData ? [join(appData, 'Beav', 'acp-gateway.json'), join(appData, 'RedBox', 'acp-gateway.json')] : []
  }
  const config = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config')
  return [join(config, 'Beav', 'acp-gateway.json'), join(config, 'RedBox', 'acp-gateway.json')]
}

function isLoopback(url: URL): boolean {
  return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)
}

export function normalizeCreatorBaseUrl(value: string): string {
  const url = new URL(value)
  if (!isLoopback(url)) throw new Error('Beav endpoint must use loopback HTTP')
  return `${url.origin}/creator/v1`
}

export async function discoverCreatorBaseUrl(explicit?: string): Promise<string | undefined> {
  if (explicit?.trim()) return normalizeCreatorBaseUrl(explicit.trim())
  if (process.env.BEAV_CREATOR_BASE_URL?.trim()) {
    return normalizeCreatorBaseUrl(process.env.BEAV_CREATOR_BASE_URL.trim())
  }
  for (const filename of discoveryPaths()) {
    try {
      const parsed = discoverySchema.parse(JSON.parse(await readFile(filename, 'utf8')))
      return normalizeCreatorBaseUrl(parsed.baseUrl)
    } catch {
      // A discovery record is only a hint. Try the next supported location.
    }
  }
  return undefined
}
