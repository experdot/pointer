import { build } from 'esbuild'
import { access } from 'node:fs/promises'
import { nodeWorkerPlugin } from './worker-build.mjs'

// 旧实现改动前生成 baseline；新实现生成 current。两份 bundle 的运行环境相同。
const variant = process.argv[2]
if (!['baseline', 'current'].includes(variant)) throw new Error('指定 baseline 或 current')
const outfile = `out/diagnostics/${variant}-runtime.cjs`
if (variant === 'baseline') {
  const exists = await access(outfile).then(
    () => true,
    () => false
  )
  if (exists) throw new Error('已有基线 bundle，拒绝覆盖')
}
await build({
  stdin: {
    contents: `export { RuntimeCore } from './src/main/runtime/RuntimeCore';
      export { WorkspaceStore } from './src/main/runtime/WorkspaceStore';
      export { WorkspaceTransaction } from './src/main/runtime/WorkspaceTransaction';
      export { IndexDb } from './src/main/runtime/IndexDb';
      export * as domain from './src/shared/domain';`,
    resolveDir: process.cwd(),
    loader: 'ts'
  },
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  alias: { '@shared': './src/shared' },
  plugins: [nodeWorkerPlugin]
})
