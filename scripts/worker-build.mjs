import { build } from 'esbuild'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 测试与 smoke 使用同一份 worker 源码；正式打包由 electron-vite 的 ?nodeWorker 插件处理。
export async function workerFactorySource(path) {
  const result = await build({
    entryPoints: [path],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    alias: { '@shared': resolve(root, 'src/shared') },
    logLevel: 'silent'
  })
  return `import { Worker } from 'node:worker_threads';
    export default (options) => new Worker(${JSON.stringify(result.outputFiles[0].text)}, { ...options, eval: true });`
}

/** @type {import('esbuild').Plugin} */
export const nodeWorkerPlugin = {
  name: 'pointer-node-worker',
  setup(build) {
    build.onResolve({ filter: /\?nodeWorker$/ }, (args) => ({
      path: resolve(args.resolveDir, args.path.replace(/\?nodeWorker$/, '')),
      namespace: 'node-worker'
    }))
    build.onLoad({ filter: /.*/, namespace: 'node-worker' }, async (args) => ({
      contents: await workerFactorySource(args.path),
      loader: 'js'
    }))
  }
}
