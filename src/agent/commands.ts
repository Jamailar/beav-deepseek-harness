import type { Context } from '@deepseek-ai/cordis'

function httpUrl(raw: string): string {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https URLs are supported')
  if (url.username || url.password) throw new Error('URLs containing credentials are not supported')
  return url.toString()
}

export function registerCommands(ctx: Context): void {
  ctx.commands.register({
    name: 'beav',
    description: 'Check, open, or send work to Beav without a model turn.',
    input: { hint: 'status | open | workspaces | new <request> | import <url> | save <url>' },
    async handler({ rawInput, signal }) {
      const input = rawInput.trim()
      const space = input.indexOf(' ')
      const command = (space < 0 ? input : input.slice(0, space)).toLowerCase()
      const argument = space < 0 ? '' : input.slice(space + 1).trim()
      try {
        if (!command || command === 'status') {
          const status = await ctx.beav.status(signal)
          return { kind: status.connected ? 'success' : 'error', text: status.message }
        }
        if (command === 'open') {
          await ctx.beav.open()
          return { kind: 'success', text: 'Opened Beav.' }
        }
        if (command === 'workspaces') {
          const workspaces = await ctx.beav.listWorkspaces(signal)
          return { kind: 'success', text: workspaces.length ? workspaces.map(item => `${item.name} (${item.id})`).join('\n') : 'No Beav workspaces found.' }
        }
        if (command === 'new') {
          if (!argument) return { kind: 'error', text: 'Usage: /beav new <request>' }
          const url = new URL('beav://chat/new')
          url.searchParams.set('text', argument)
          await ctx.beav.open(url.toString())
          return { kind: 'success', text: 'Opened a new Beav conversation.' }
        }
        if (command === 'import' || command === 'save') {
          if (!argument) return { kind: 'error', text: `Usage: /beav ${command} <https-url>` }
          const target = httpUrl(argument)
          const url = new URL(command === 'import' ? 'beav://import/url' : 'beav://knowledge/save')
          url.searchParams.set('url', target)
          await ctx.beav.open(url.toString())
          return { kind: 'success', text: `Opened the Beav ${command} flow.` }
        }
        return { kind: 'error', text: 'Usage: /beav status | open | workspaces | new <request> | import <url> | save <url>' }
      } catch (error) {
        return { kind: 'error', text: error instanceof Error ? error.message : 'Beav command failed' }
      }
    },
  })
}
