/**
 * 文件系统工具：原子写、目录遍历与安全删除
 */

import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import {
  access,
  copyFile,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink
} from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'

export async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory()
  } catch {
    return false
  }
}

export async function readText(target: string): Promise<string | null> {
  try {
    return await readFile(target, 'utf8')
  } catch {
    return null
  }
}

export async function readBinary(target: string): Promise<Buffer | null> {
  try {
    return await readFile(target)
  } catch {
    return null
  }
}

export async function readJson<T>(target: string): Promise<T | null> {
  const text = await readText(target)
  if (text === null) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function ensureDir(target: string): Promise<void> {
  await mkdir(target, { recursive: true })
}

/**
 * 原子写：先写临时文件并 fsync，再重命名覆盖目标
 */
export async function writeTextAtomic(target: string, content: string): Promise<void> {
  await ensureDir(dirname(target))
  const tempPath = `${target}.tmp-${randomUUID()}`
  const handle = await open(tempPath, 'w')
  try {
    await handle.writeFile(content, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }

  try {
    await rename(tempPath, target)
  } catch (error) {
    await unlink(tempPath).catch(() => undefined)
    throw error
  }
}

export async function writeJsonAtomic(target: string, value: unknown): Promise<void> {
  await writeTextAtomic(target, `${JSON.stringify(value, null, 2)}\n`)
}

/** 原子写入二进制内容 */
export async function writeBinaryAtomic(target: string, content: Uint8Array): Promise<void> {
  await ensureDir(dirname(target))
  const tempPath = `${target}.tmp-${randomUUID()}`
  const handle = await open(tempPath, 'w')
  try {
    await handle.writeFile(content)
    await handle.sync()
  } finally {
    await handle.close()
  }

  try {
    await rename(tempPath, target)
  } catch (error) {
    await unlink(tempPath).catch(() => undefined)
    throw error
  }
}

export async function removePath(target: string, recursive = false): Promise<void> {
  await rm(target, { recursive, force: true }).catch(() => undefined)
}

export async function movePath(from: string, to: string): Promise<void> {
  await ensureDir(dirname(to))
  try {
    await rename(from, to)
  } catch {
    // 跨卷或目标已存在时退化为复制 + 删除
    await copyFile(from, to)
    await unlink(from).catch(() => undefined)
  }
}

export async function mtimeOf(target: string): Promise<number | null> {
  try {
    return (await stat(target)).mtimeMs
  } catch {
    return null
  }
}

export interface WalkEntry {
  absolutePath: string
  /** 相对遍历根目录的路径，使用 / 分隔 */
  relativePath: string
  fileName: string
  modifiedAt: number
}

/**
 * 递归遍历目录；跳过隐藏目录与内核私有目录
 */
export async function walkFiles(
  root: string,
  options: {
    include?: (fileName: string) => boolean
    skipDirectory?: (name: string) => boolean
  } = {}
): Promise<WalkEntry[]> {
  const results: WalkEntry[] = []
  const include = options.include ?? (() => true)
  const skipDirectory = options.skipDirectory ?? ((name: string) => name.startsWith('.'))

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true }).catch(() => null)
    if (!entries) return

    for (const entry of entries) {
      const absolutePath = join(current, entry.name)
      if (entry.isDirectory()) {
        if (skipDirectory(entry.name)) continue
        await walk(absolutePath)
        continue
      }
      if (!entry.isFile() || !include(entry.name)) continue

      const info = await stat(absolutePath).catch(() => null)
      if (!info) continue

      results.push({
        absolutePath,
        relativePath: relative(root, absolutePath).split(sep).join('/'),
        fileName: entry.name,
        modifiedAt: info.mtimeMs
      })
    }
  }

  await walk(root)
  return results
}

/** 列出目录下的子目录名 */
export async function listDirectories(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch {
    return []
  }
}

/** 内容哈希，用于索引层的增量判断 */
export function contentHash(value: string): string {
  return createHash('sha1').update(value).digest('hex')
}
