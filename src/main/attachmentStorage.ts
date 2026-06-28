import { copyFile, mkdir, readFile, rename, rm, stat, unlink, writeFile } from 'fs/promises'
import * as path from 'path'
import {
  getCurrentAttachmentsDirectory,
  isPathWithinRoot,
  resolveRelativePathWithinRoot
} from './workspaceRuntime'

function validatePathSegment(segment: string, label: string): string {
  if (!segment || segment === '.' || segment === '..' || /[\\/]/.test(segment)) {
    throw new Error(`Invalid ${label}`)
  }

  return segment
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
}

async function ensureAttachmentsRoot(): Promise<string> {
  const attachmentsRoot = getCurrentAttachmentsDirectory()
  await mkdir(attachmentsRoot, { recursive: true })
  return attachmentsRoot
}

async function resolveAttachmentPath(localPath: string): Promise<string> {
  const attachmentsRoot = await ensureAttachmentsRoot()
  return resolveRelativePathWithinRoot(attachmentsRoot, localPath)
}

function buildStoredRelativePath(
  fileId: string,
  fileName: string,
  pageId?: string,
  messageId?: string
): string {
  const safeFileId = validatePathSegment(fileId, 'file ID')
  const extension = path.extname(fileName)

  if (pageId && messageId) {
    const safePageId = validatePathSegment(pageId, 'page ID')
    const safeMessageId = validatePathSegment(messageId, 'message ID')
    return path.posix.join(safePageId, safeMessageId, `${safeFileId}${extension}`)
  }

  return path.posix.join('temp', `${safeFileId}${extension}`)
}

async function moveFile(sourcePath: string, targetPath: string): Promise<void> {
  try {
    await rename(sourcePath, targetPath)
  } catch (error) {
    const isCrossDeviceMove = (error as NodeJS.ErrnoException).code === 'EXDEV'
    if (!isCrossDeviceMove) {
      throw error
    }

    await copyFile(sourcePath, targetPath)
    await unlink(sourcePath)
  }
}

function resolveDirectoryWithinAttachmentsRoot(...segments: string[]): string {
  const attachmentsRoot = getCurrentAttachmentsDirectory()
  const resolvedPath = path.resolve(
    attachmentsRoot,
    ...segments.map((segment) => validatePathSegment(segment, 'path segment'))
  )

  if (!isPathWithinRoot(resolvedPath, attachmentsRoot)) {
    throw new Error('Resolved path escapes attachments root')
  }

  return resolvedPath
}

export async function saveAttachmentFile(options: {
  fileId: string
  fileName: string
  base64Content: string
  pageId?: string
  messageId?: string
}): Promise<string> {
  const relativePath = buildStoredRelativePath(
    options.fileId,
    options.fileName,
    options.pageId,
    options.messageId
  )
  const targetPath = await resolveAttachmentPath(relativePath)

  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, Buffer.from(options.base64Content, 'base64'))

  return relativePath
}

export async function readAttachmentFile(localPath: string): Promise<string> {
  const targetPath = await resolveAttachmentPath(localPath)
  const buffer = await readFile(targetPath)
  return buffer.toString('base64')
}

export async function deleteAttachmentFile(localPath: string): Promise<void> {
  const targetPath = await resolveAttachmentPath(localPath)
  if (!(await pathExists(targetPath))) {
    return
  }

  await unlink(targetPath)
}

export async function moveAttachmentFile(options: {
  fileId: string
  fileName: string
  fromPath: string
  pageId: string
  messageId: string
}): Promise<string> {
  const sourcePath = await resolveAttachmentPath(options.fromPath)
  if (!(await pathExists(sourcePath))) {
    throw new Error(`Attachment source not found: ${options.fromPath}`)
  }

  const relativePath = buildStoredRelativePath(
    options.fileId,
    options.fileName,
    options.pageId,
    options.messageId
  )
  const targetPath = await resolveAttachmentPath(relativePath)

  await mkdir(path.dirname(targetPath), { recursive: true })
  await moveFile(sourcePath, targetPath)

  return relativePath
}

export async function cleanupMessageAttachmentFiles(
  pageId: string,
  messageId: string
): Promise<void> {
  const targetDir = resolveDirectoryWithinAttachmentsRoot(pageId, messageId)
  await rm(targetDir, { recursive: true, force: true })
}

export async function cleanupPageAttachmentFiles(pageId: string): Promise<void> {
  const targetDir = resolveDirectoryWithinAttachmentsRoot(pageId)
  await rm(targetDir, { recursive: true, force: true })
}

export async function cleanupTempAttachmentFiles(): Promise<void> {
  const targetDir = resolveDirectoryWithinAttachmentsRoot('temp')
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(targetDir, { recursive: true })
}

export async function resolveAttachmentPathForAI(localPath: string): Promise<string> {
  const targetPath = await resolveAttachmentPath(localPath)
  if (!(await pathExists(targetPath))) {
    throw new Error(`Attachment not found: ${localPath}`)
  }

  return targetPath
}
