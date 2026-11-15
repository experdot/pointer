/** 仅测试使用：旧数据转换只发生在临时副本中，不属于应用迁移路径。 */
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdtemp, readdir, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises'
import { join, resolve, relative, dirname, basename, sep } from 'node:path'
import { tmpdir, cpus } from 'node:os'
import { generateNKeysBetween } from 'fractional-indexing'
import { DatabaseSync } from 'node:sqlite'

const require = createRequire(import.meta.url)
const source = resolve(process.argv[2] ?? 'C:/Users/experdot/Desktop/tt')
const baseline = require(resolve('out/diagnostics/baseline-runtime.cjs'))
const current = require(resolve('out/diagnostics/current-runtime.cjs'))
const output = resolve('out/diagnostics/ordering-performance.json')
// 可复用隔离准备阶段生成的索引，避免每个场景重新构建全文索引。
let preparedIndex = process.argv[3] ? resolve(process.argv[3]) : undefined
const scratch = await mkdtemp(join(tmpdir(), 'pointer-ordering-benchmark-'))
const manifest = new Map()
const samples = []
let active = null
let phase = 'idle'
let runtime

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const round = (n) => Math.round(n * 100) / 100
function record(key, bytes = 0) {
  if (!active) return
  const metric = (active.io[`${phase}:${key}`] ??= { count: 0, bytes: 0 })
  metric.count++
  metric.bytes += bytes
}
function category(path) {
  const name = String(path)
    .replace(/\\/g, '/')
    .replace(/\.tmp-[a-f0-9-]{36}$/i, '')
  if (name.endsWith('.pointer.md')) return 'page'
  if (name.endsWith('manifest.json')) return 'manifest'
  if (name.endsWith('.bin')) return 'backup'
  return 'other'
}
// 包含原子写、事务副本和清单；SQLite 原生内部 IO 另以索引调用计数报告。
const fs = require('node:fs/promises')
const rawOpen = fs.open
fs.open = async (...args) => {
  const handle = await rawOpen(...args)
  const kind = category(args[0])
  for (const name of ['writeFile', 'sync']) {
    const original = handle[name].bind(handle)
    handle[name] = async (...values) => {
      const result = await original(...values)
      record(`${name}.${kind}`, name === 'writeFile' ? Buffer.byteLength(values[0]) : 0)
      return result
    }
  }
  return handle
}
const rawRead = fs.readFile
fs.readFile = async (...args) => {
  const result = await rawRead(...args)
  record(`readFile.${category(args[0])}`, Buffer.byteLength(result))
  return result
}
for (const name of ['rename', 'stat', 'lstat', 'mkdir', 'readdir', 'unlink', 'rmdir']) {
  const original = fs[name]
  fs[name] = async (...args) => {
    const result = await original(...args)
    record(name)
    return result
  }
}
for (const bundle of [baseline, current]) {
  const write = bundle.WorkspaceStore.prototype.trackWrite
  bundle.WorkspaceStore.prototype.trackWrite = async function (path, operation) {
    if (active && phase === 'command' && path.endsWith('.pointer.md')) active.pageWrites.add(path)
    return write.call(this, path, operation)
  }
  const fts = bundle.IndexDb.prototype.replaceMessages
  bundle.IndexDb.prototype.replaceMessages = function (...args) {
    record('index.replaceMessages')
    return fts.apply(this, args)
  }
}

async function filesAt(root) {
  const result = []
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('测试源不允许符号链接')
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile()) result.push(relative(root, path))
    }
  }
  await walk(root)
  return result.sort()
}

async function convertReplica(replica) {
  if (!resolve(replica).startsWith(`${resolve(scratch)}${sep}`)) throw new Error('副本不在临时目录')
  const pages = []
  for (const path of (await filesAt(replica)).filter((path) => path.endsWith('.pointer.md'))) {
    const bytes = await readFile(join(replica, path))
    const text = bytes.toString('utf8')
    if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('测试源不是无损 UTF-8 文档')
    const parsed = baseline.domain.parsePageMetadata(text)
    if (!parsed.ok) throw new Error('基线副本包含无效页面')
    pages.push({ path, text, metadata: parsed.value })
  }
  const folderPath = join(replica, '.pointer', 'folders.json')
  const folderFile = JSON.parse(await readFile(folderPath, 'utf8'))
  const groups = new Map()
  for (const node of [...folderFile.folders, ...pages.map((page) => page.metadata.page)]) {
    const group = groups.get(node.parentFolderId) ?? []
    group.push(node)
    groups.set(node.parentFolderId, group)
  }
  for (const group of groups.values()) {
    group.sort(baseline.domain.compareNodes)
    const keys = generateNKeysBetween(null, null, group.length)
    group.forEach((node, index) => {
      delete node.order
      node.orderKey = keys[index]
    })
  }
  await writeFile(folderPath, JSON.stringify(folderFile))
  for (const page of pages) {
    const converted = current.domain.replacePageMetadata(page.text, {
      version: 3,
      ...page.metadata
    })
    const body = (text) => text.slice(text.indexOf('</pointer-page>') + '</pointer-page>'.length)
    if (body(converted) !== body(page.text)) throw new Error('副本转换改变了正文')
    await writeFile(join(replica, page.path), converted)
  }
  return pages.length
}

const host = {
  getVersion: () => 'benchmark',
  getPreferredSystemLanguages: () => ['zh-CN'],
  saveFile: async () => ({}),
  openTextFile: async () => null,
  pickDirectory: async () => null,
  pickImages: async () => [],
  openInFileManager: async () => undefined
}
const scenarios = ['head', 'middle', 'tail', 'far-move', 'folder-move', 'cross-folder']
try {
  for (const path of await filesAt(source))
    manifest.set(path, hash(await readFile(join(source, path))))
  const pageCount = [...manifest.keys()].filter((path) => path.endsWith('.pointer.md')).length
  console.log(JSON.stringify({ stage: 'source-hashed', pageCount, files: manifest.size }))
  for (const [variant, bundle] of [
    ['baseline', baseline],
    ['current', current]
  ]) {
    for (const scenario of scenarios) {
      const caseRoot = join(scratch, `${variant}-${scenario}`)
      const replica = join(caseRoot, 'workspace')
      await mkdir(join(replica, '.pointer'), { recursive: true })
      // 缓存、锁、事务和用户设置不复制；首次索引建立完全在计时之外。
      for (const path of manifest.keys()) {
        if (!(path.endsWith('.pointer.md') || path === join('.pointer', 'folders.json'))) continue
        await mkdir(dirname(join(replica, path)), { recursive: true })
        await cp(join(source, path), join(replica, path), { preserveTimestamps: true })
      }
      try {
        await readFile(join(replica, '.pointer', 'folders.json'))
      } catch {
        await writeFile(join(replica, '.pointer', 'folders.json'), '{"folders":[]}')
      }
      if (variant === 'current') await convertReplica(replica)
      if (preparedIndex) {
        for (const suffix of ['', '-wal']) {
          try {
            await cp(`${preparedIndex}${suffix}`, join(replica, '.pointer', `index.db${suffix}`))
          } catch (error) {
            if (error.code !== 'ENOENT') throw error
          }
        }
        // 强制比对所有消息；中断的准备索引也只作为加速缓存，不能掩盖未索引页面。
        const index = new DatabaseSync(join(replica, '.pointer', 'index.db'))
        index.exec('UPDATE pages SET mtime = -1')
        index.close()
      }
      const appDataPath = join(caseRoot, 'app-data')
      runtime = new bundle.RuntimeCore({ appDataPath, host })
      await runtime.init()
      await runtime.command('workspace.create', { name: '排序性能测试副本', path: replica })
      runtime.stopWatcher()
      let folder
      if (scenario === 'folder-move' || scenario === 'cross-folder') {
        const roots = bundle.domain.childrenOf(
          await runtime.query('tree.get', undefined),
          undefined
        )
        folder = await runtime.command('folder.create', {
          name: 'benchmark-folder',
          afterNodeId: roots.at(-1).id
        })
      }
      await runtime.dispose()
      runtime = new bundle.RuntimeCore({ appDataPath, host })
      await runtime.init()
      // 手动触发同一监听扫描路径，避免 600ms 去抖与命令队列交叠污染测量。
      runtime.stopWatcher()
      const initial = await runtime.query('tree.get', undefined)
      const moved = initial.pages.toSorted((a, b) => a.createdAt - b.createdAt)[
        Math.floor(initial.pages.length / 2)
      ]
      for (let iteration = 0; iteration <= 10; iteration++) {
        const before = await runtime.query('tree.get', undefined)
        const nodes = bundle.domain.childrenOf(before, undefined)
        const oldPaths = new Set(
          [...runtime.workspace.pagePaths.values()].map((path) => join(replica, path))
        )
        const sample = {
          variant,
          scenario,
          iteration,
          commandMs: 0,
          firstReadMs: 0,
          scanMs: 0,
          io: {},
          pageWrites: new Set()
        }
        samples.push(sample)
        active = sample
        phase = 'command'
        const start = performance.now()
        let pageId = moved.id
        if (['head', 'middle', 'tail'].includes(scenario)) {
          const afterNodeId =
            scenario === 'head'
              ? undefined
              : nodes[scenario === 'middle' ? Math.floor(nodes.length / 2) : nodes.length - 1].id
          const page = await runtime.command('page.create', {
            name: `benchmark-${scenario}-${iteration}`,
            afterNodeId
          })
          pageId = page.id
        } else {
          const nodeId = scenario === 'folder-move' ? folder.id : moved.id
          const targetNodeId =
            scenario === 'cross-folder'
              ? iteration % 2 === 0
                ? folder.id
                : undefined
              : nodes.filter((node) => node.id !== nodeId)[
                  iteration % 2 === 0 ? 0 : nodes.length - 2
                ].id
          await runtime.command('tree.move', {
            nodeId,
            targetNodeId,
            placement:
              scenario === 'cross-folder' ? 'inside' : iteration % 2 === 0 ? 'before' : 'after'
          })
        }
        sample.commandMs = round(performance.now() - start)
        phase = 'first-read'
        const readStart = performance.now()
        if (scenario === 'folder-move') await runtime.query('tree.get', undefined)
        else await runtime.query('conversation.get', { pageId })
        sample.firstReadMs = round(performance.now() - readStart)
        phase = 'scan'
        const scanStart = performance.now()
        await runtime.checkExternalChanges()
        sample.scanMs = round(performance.now() - scanStart)
        active = null
        sample.oldPagesWritten = [...sample.pageWrites].filter((path) => oldPaths.has(path)).length
        sample.totalPagesWritten = sample.pageWrites.size
        delete sample.pageWrites
        console.log(
          JSON.stringify({
            variant,
            scenario,
            iteration,
            commandMs: sample.commandMs,
            firstReadMs: sample.firstReadMs,
            scanMs: sample.scanMs,
            oldPagesWritten: sample.oldPagesWritten
          })
        )
      }
      await runtime.dispose()
      runtime = undefined
      preparedIndex = join(replica, '.pointer', 'index.db')
    }
  }
} finally {
  await finish()
}

async function finish() {
  active = null
  await runtime?.dispose()
  const after = await filesAt(source)
  const unchanged =
    after.length === manifest.size &&
    (
      await Promise.all(
        after.map(async (path) => manifest.get(path) === hash(await readFile(join(source, path))))
      )
    ).every(Boolean)
  const root = resolve(scratch)
  if (
    dirname(root) !== resolve(tmpdir()) ||
    !basename(root).startsWith('pointer-ordering-benchmark-')
  )
    throw new Error('非法清理路径')
  await rm(root, { recursive: true, force: true })
  const summaries = []
  const percentile = (values, fraction) =>
    values.toSorted((a, b) => a - b)[Math.ceil(values.length * fraction) - 1]
  const median = (values) => {
    const ordered = values.toSorted((a, b) => a - b)
    const middle = Math.floor(ordered.length / 2)
    return round(ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2)
  }
  for (const variant of ['baseline', 'current'])
    for (const scenario of scenarios) {
      const rows = samples.filter((row) => row.variant === variant && row.scenario === scenario)
      if (!rows.length) continue
      const warm = rows.slice(1)
      const metrics = {}
      for (const key of ['commandMs', 'firstReadMs', 'scanMs'])
        metrics[key] = {
          first: rows[0][key],
          median: median(warm.map((row) => row[key])),
          p95: percentile(
            warm.map((row) => row[key]),
            0.95
          ),
          allP95: percentile(
            rows.map((row) => row[key]),
            0.95
          )
        }
      summaries.push({ variant, scenario, samples: rows.length, metrics })
    }
  await writeFile(
    output,
    JSON.stringify(
      {
        schema: 1,
        node: process.version,
        platform: process.platform,
        cpu: cpus()[0].model,
        timestamp: new Date().toISOString(),
        sourceFiles: manifest.size,
        sourceHashUnchanged: unchanged,
        temporaryCopiesRemoved: true,
        scanner: '同一监听扫描路径手动触发；不含 600ms 去抖',
        ioScope: 'Node 文件 IO 含事务备份/清单；SQLite 原生 IO 未计入，单列全文索引调用次数',
        summaries,
        samples
      },
      null,
      2
    )
  )
  if (!unchanged) throw new Error('原工作区哈希发生变化，请查看报告')
}
