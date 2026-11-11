import { build } from 'esbuild'
import { nodeWorkerPlugin } from './worker-build.mjs'

await build({
  entryPoints: ['scripts/kernel-smoke.ts'],
  outfile: 'out/kernel-smoke.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  alias: { '@shared': './src/shared' },
  plugins: [nodeWorkerPlugin]
})
