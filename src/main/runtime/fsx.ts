/**
 * 文件系统工具：原子写、目录遍历与安全删除
 */

import { randomUUID } from 'node:crypto'
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
import { isPageFileName, isReservedDirectory } from '@shared/domain'

/** 忽略内部写入噪声；目录改名仍需扫描，空文件名表示平台未提供具体路径。 */
export function isWorkspaceFileChange(event: string, fileName: string | null): boolean {
  if (!fileName) return true
  const parts = fileName.replace(/\\/g, '/').split('/')
  if (parts[0] === '.pointer') return parts.length === 2 && parts[1] === 'folders.json'
  if (parts.some(isReservedDirectory)) return false
  if (/\.tmp-[\da-f-]{36}$/i.test(fileName)) return false
  return isPageFileName(fileName) || event === 'rename'
}

function missing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target, constants.F_OK)
    return true
  } catch (error) {
    if (missing(error)) return false
    throw error
  }
}

export async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory()
  } catch (error) {
    if (missing(error)) return false
    throw error
  }
}

export async function readText(target: string): Promise<string | null> {
  try {
    return await readFile(target, 'utf8')
  } catch (error) {
    if (missing(error)) return null
    throw error
  }
}

export async function readBinary(target: string): Promise<Buffer | null> {
  try {
    return await readFile(target)
  } catch (error) {
    if (missing(error)) return null
    throw error
  }
}

export async function readJson<T>(target: string): Promise<T | null> {
  const text = await readText(target)
  if (text === null) return null
  try {
    return JSON.parse(text) as T
  } catch (error) {
    if (missing(error)) return null
    throw error
  }
}

export async function ensureDir(target: string): Promise<void> {
  await mkdir(target, { recursive: true })
}

/**
 * 原子写：先写临时文件并 fsync，再重命名覆盖目标
 */
export async function writeTextAtomic(target: string, content: string): Promise<void> {
  await writeAtomic(target, content)
}

export async function writeJsonAtomic(target: string, value: unknown): Promise<void> {
  await writeTextAtomic(target, `${JSON.stringify(value, null, 2)}\n`)
}

export async function writeBinaryAtomic(target: string, content: Uint8Array): Promise<void> {
  await writeAtomic(target, content)
}

async function writeAtomic(target: string, content: string | Uint8Array): Promise<void> {
  await ensureDir(dirname(target))
  const tempPath = `${target}.tmp-${randomUUID()}`
  try {
    const handle = await open(tempPath, 'wx')
    try {
      await handle.writeFile(content)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(tempPath, target)
  } catch (error) {
    await unlink(tempPath).catch(() => undefined)
    throw error
  }
}

export async function removePath(target: string, recursive = false): Promise<void> {
  await rm(target, { recursive, force: true })
}

export async function movePath(from: string, to: string): Promise<void> {
  await ensureDir(dirname(to))
  try {
    await rename(from, to)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
    // 只有跨卷移动退化为复制后删除；权限或磁盘错误直接传递。
    await copyFile(from, to)
    await unlink(from)
  }
}

export async function mtimeOf(target: string): Promise<number | null> {
  try {
    return (await stat(target)).mtimeMs
  } catch (error) {
    if (missing(error)) return null
    throw error
  }
}

interface WalkEntry {
  absolutePath: string
  /** 相对遍历根目录的路径，使用 / 分隔 */
  relativePath: string
  fileName: string
  modifiedAt: number
}

/**
 * 递归遍历目录；只跳过明确保留的系统目录
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
  const skipDirectory = options.skipDirectory ?? isReservedDirectory

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true }).catch((error) => {
      if (missing(error)) return null
      throw error
    })
    if (!entries) return

    for (const entry of entries) {
      const absolutePath = join(current, entry.name)
      if (entry.isDirectory()) {
        if (skipDirectory(entry.name)) continue
        await walk(absolutePath)
        continue
      }
      if (!entry.isFile() || !include(entry.name)) continue

      const info = await stat(absolutePath).catch((error) => {
        if (missing(error)) return null
        throw error
      })
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
  } catch (error) {
    if (missing(error)) return []
    throw error
  }
}
