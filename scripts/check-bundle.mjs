import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const renderer = join(root, 'out', 'renderer')
const html = await readFile(join(renderer, 'index.html'), 'utf8')
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="(\.[^"]+)"/g)].map((match) =>
  resolve(renderer, match[1])
)
if (!scripts.length) throw new Error('构建入口脚本不存在，请先运行 pnpm build')

async function javascriptBytes(directory) {
  let bytes = 0
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) bytes += await javascriptBytes(path)
    else if (entry.isFile() && entry.name.endsWith('.js')) bytes += (await stat(path)).size
  }
  return bytes
}

// 以当前生产产物建立回退预算；后续新增依赖须连同必要性审查预算变更。
const sizes = [
  ['main', (await stat(join(root, 'out/main/index.js'))).size, 850_000],
  ['preload', (await stat(join(root, 'out/preload/index.js'))).size, 16_000],
  [
    'renderer entry',
    (await Promise.all(scripts.map((path) => stat(path)))).reduce((n, info) => n + info.size, 0),
    14_500_000
  ],
  ['renderer all JS', await javascriptBytes(renderer), 42_000_000]
]
let failed = false
for (const [name, bytes, limit] of sizes) {
  console.log(`${name}: ${bytes} / ${limit} bytes`)
  if (bytes > limit) failed = true
}
if (failed) throw new Error('构建产物超过预算，请检查新增依赖与打包方式')
