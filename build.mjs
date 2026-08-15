import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'

rmSync('lib', { recursive: true, force: true })
mkdirSync('lib', { recursive: true })
const external = ['@deepseek-ai/cordis', '@deepseek-ai/dsh-*', '@deepseek-ai/schemastery']

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node22'],
  sourcemap: true,
  external,
})

await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: true,
  jsx: 'automatic',
  external: [...external, 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'scheduler'],
  banner: { js: "window.__ModuleLoader__.load({ id: 'beav-creator-dsh', factory: (require) => { var module = { exports: {} }; var exports = module.exports;" },
  footer: { js: 'return module.exports; } });' },
})

execFileSync('node_modules/.bin/tsc', ['-p', 'tsconfig.json', '--emitDeclarationOnly'], { stdio: 'inherit' })
