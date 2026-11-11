import { randomUUID } from 'node:crypto'
import { lstat, readdir, rmdir, unlink } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { RuntimeError } from '@shared/contracts'
import { assertWithin } from './pathSafety'
import {
  ensureDir,
  listDirectories,
  readBinary,
  readJson,
  writeBinaryAtomic,
  writeJsonAtomic
} from './fsx'

type Entry =
  | { path: string; kind: 'file'; backup: string | null }
  | { path: string; kind: 'directory'; existed: boolean }
interface Manifest {
  version: 1
  committed: boolean
  entries: Entry[]
}

/** 写前保存原文件；进程中断后回滚整个未提交命令，恢复本身也可重复执行。 */
export class WorkspaceTransaction {
  private readonly directory: string
  private manifest: Manifest = { version: 1, committed: false, entries: [] }

  constructor(
    private readonly root: string,
    id: string = randomUUID()
  ) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('非法事务标识')
    this.directory = join(root, '.pointer', 'transactions', id)
    assertWithin(root, this.directory)
  }

  static async recover(root: string): Promise<void> {
    const directory = join(root, '.pointer', 'transactions')
    await checkPath(root, directory)
    for (const id of await listDirectories(directory)) {
      const transaction = new WorkspaceTransaction(root, id)
      await checkPath(root, transaction.directory)
      const manifestPath = join(transaction.directory, 'manifest.json')
      await checkPath(root, manifestPath)
      const manifest = await readJson<Manifest>(manifestPath)
      if (!manifest) {
        // 首份清单落盘前中断，此时还未允许改动工作区文件。
        await transaction.cleanup()
        continue
      }
      transaction.manifest = manifest
      transaction.validate()
      if (manifest.committed) await transaction.cleanup()
      else await transaction.rollback()
    }
  }

  get changed(): boolean {
    return this.manifest.entries.length > 0
  }

  async capture(path: string, kind: 'file' | 'directory' = 'file'): Promise<void> {
    const target = resolve(path)
    const key = relative(this.root, target)
    if (this.manifest.entries.some((entry) => pathKey(entry.path) === pathKey(key))) return
    await checkPath(this.root, target)
    await checkPath(this.root, this.directory)
    const info = await lstat(target).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    if (info && (kind === 'file' ? !info.isFile() : !info.isDirectory()))
      throw new RuntimeError('workspace.invalid-path', '文件类型不符合预期')
    let entry: Entry
    if (kind === 'directory') entry = { path: key, kind, existed: info !== null }
    else {
      const previous = await readBinary(target)
      const backup = previous === null ? null : `${this.manifest.entries.length}.bin`
      if (backup) await writeBinaryAtomic(join(this.directory, backup), previous!)
      entry = { path: key, kind, backup }
    }
    const next: Manifest = { ...this.manifest, entries: [...this.manifest.entries, entry] }
    await writeJsonAtomic(join(this.directory, 'manifest.json'), next)
    this.manifest = next
  }

  async commit(): Promise<void> {
    if (!this.changed) return
    await writeJsonAtomic(join(this.directory, 'manifest.json'), {
      ...this.manifest,
      committed: true
    })
    this.manifest.committed = true
    // 提交标记成功后清理失败不再把已提交命令报告为失败；下次打开继续清理。
    await this.cleanup().catch((error) => console.warn('[runtime] 事务清理待重试', error))
  }

  async rollback(): Promise<void> {
    if (!this.changed) return
    this.validate()
    // 先验证全部目标与备份，避免损坏的清单造成部分恢复。
    const originals = new Map<string, Buffer>()
    for (const entry of this.manifest.entries) {
      await checkPath(this.root, resolve(this.root, entry.path))
      if (entry.kind === 'file' && entry.backup) {
        const backup = join(this.directory, entry.backup)
        await checkPath(this.root, backup)
        const bytes = await readBinary(backup)
        if (bytes === null) throw new Error('恢复备份缺失，请保留工作区以便修复')
        originals.set(entry.path, bytes)
      }
    }
    for (const entry of this.manifest.entries) {
      const path = resolve(this.root, entry.path)
      if (entry.kind === 'directory') {
        if (entry.existed) await ensureDir(path)
      } else if (entry.backup) {
        const bytes = originals.get(entry.path)!
        const current = await readBinary(path)
        if (!current?.equals(bytes)) await writeBinaryAtomic(path, bytes)
      } else {
        await unlink(path).catch(ignoreMissing)
      }
    }
    for (const entry of [...this.manifest.entries].reverse()) {
      if (entry.kind === 'directory' && !entry.existed) {
        await rmdir(resolve(this.root, entry.path)).catch(ignoreNonempty)
      }
    }
    // 已完整恢复后也写完成标记，清理途中再次中断时不依赖已删除的备份。
    await this.commit()
  }

  private validate(): void {
    if (
      this.manifest.version !== 1 ||
      typeof this.manifest.committed !== 'boolean' ||
      !Array.isArray(this.manifest.entries)
    )
      throw new Error('不支持的工作区恢复记录')
    const seen = new Set<string>()
    for (const entry of this.manifest.entries) {
      if (!entry || typeof entry.path !== 'string') throw new Error('损坏的恢复路径')
      const path = resolve(this.root, entry.path)
      assertWithin(this.root, path)
      const transactionRoot = join(this.root, '.pointer', 'transactions')
      if (path === transactionRoot || path.startsWith(`${transactionRoot}${sep}`))
        throw new Error('恢复记录不能修改事务目录')
      if (seen.has(path)) throw new Error('重复的恢复路径')
      seen.add(path)
      if (entry.kind === 'file') {
        if (entry.backup !== null && !/^\d+\.bin$/.test(entry.backup))
          throw new Error('损坏的备份路径')
      } else if (entry.kind !== 'directory' || typeof entry.existed !== 'boolean') {
        throw new Error('损坏的恢复记录')
      }
    }
  }

  private async cleanup(): Promise<void> {
    await checkPath(this.root, this.directory)
    const entries = await readdir(this.directory, { withFileTypes: true }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return []
        throw error
      }
    )
    for (const entry of entries) {
      if (!entry.isFile()) throw new Error('事务目录中有未知内容，已保留')
      await unlink(join(this.directory, entry.name))
    }
    await rmdir(this.directory).catch(ignoreMissing)
  }
}

/** 允许尚未创建的后缀，但绝不沿符号链接/junction 写入。 */
async function checkPath(root: string, target: string): Promise<void> {
  assertWithin(root, target)
  let path = target
  for (;;) {
    const info = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    if (info?.isSymbolicLink()) throw new Error('恢复路径包含符号链接')
    path = dirname(path)
    if (path === resolve(root)) return
  }
}

function ignoreMissing(error: NodeJS.ErrnoException): void {
  if (error.code !== 'ENOENT') throw error
}

function ignoreNonempty(error: NodeJS.ErrnoException): void {
  if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code ?? '')) throw error
}

function pathKey(path: string): string {
  return process.platform === 'win32' ? path.toLowerCase() : path
}
