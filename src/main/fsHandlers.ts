import { ipcMain, dialog, app } from 'electron'
import { readFile, writeFile, unlink, mkdir, readdir, stat, rm, rename } from 'fs/promises'
import * as path from 'path'
import {
  approveWorkspacePath,
  getAllowedFileSystemRoots,
  syncWorkspaceAccessContext,
  type WorkspaceAccessContext
} from './workspaceRuntime'

/**
 * 获取应用数据目录路径
 */
function getAppDataPath(): string {
  return app.getPath('userData')
}

/**
 * 验证路径是否在允许的目录内
 */
function isPathAllowed(filePath: string, allowedDirs: string[]): boolean {
  const resolvedPath = path.resolve(filePath)
  return allowedDirs.some((dir) => {
    const resolvedDir = path.resolve(dir)
    return resolvedPath.startsWith(resolvedDir + path.sep) || resolvedPath === resolvedDir
  })
}

/**
 * 验证路径安全性
 * @param targetPath 目标路径
 * @param allowCustom 是否允许自定义路径（用于工作区）
 */
function validatePath(targetPath: string, allowCustom = false): { valid: boolean; error?: string } {
  const allowedRoots = getAllowedFileSystemRoots(allowCustom)
  if (isPathAllowed(targetPath, allowedRoots)) {
    return { valid: true }
  }
  return { valid: false, error: '访问被拒绝：路径不在允许的范围内' }
}

async function writeFileAtomically(filePath: string, content: string | Buffer): Promise<void> {
  const dir = path.dirname(filePath)
  await mkdir(dir, { recursive: true })

  const tmpPath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  )

  try {
    await writeFile(tmpPath, content)
    await rename(tmpPath, filePath)
  } catch (error) {
    try {
      await unlink(tmpPath)
    } catch {
      // Ignore temp cleanup errors
    }
    throw error
  }
}

export function setupFileSystemHandlers(): void {
  // 获取应用数据目录
  ipcMain.handle('fs:get-app-data-path', () => {
    return getAppDataPath()
  })

  ipcMain.handle('fs:sync-workspace-access', (_event, context: WorkspaceAccessContext) => {
    syncWorkspaceAccessContext(context)
  })

  ipcMain.handle('fs:approve-workspace-path', (_event, workspacePath: string) => {
    approveWorkspacePath(workspacePath)
  })

  // 选择目录
  ipcMain.handle(
    'fs:select-directory',
    async (
      _event,
      options?: {
        title?: string
        defaultPath?: string
      }
    ) => {
      try {
        const result = await dialog.showOpenDialog({
          title: options?.title || '选择目录',
          defaultPath: options?.defaultPath,
          properties: ['openDirectory', 'createDirectory']
        })

        if (!result.canceled && result.filePaths[0]) {
          approveWorkspacePath(result.filePaths[0])
        }

        return {
          success: !result.canceled,
          cancelled: result.canceled,
          path: result.filePaths[0]
        }
      } catch (error) {
        console.error('Select directory error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    }
  )

  // 读取文本文件
  ipcMain.handle(
    'fs:read-text',
    async (
      _event,
      filePath: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; content?: string; error?: string }> => {
      try {
        const validation = validatePath(filePath, options?.allowCustomPath)
        if (!validation.valid) {
          return { success: false, error: validation.error }
        }

        const content = await readFile(filePath, 'utf-8')
        return { success: true, content }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return { success: false, error: 'FILE_NOT_FOUND' }
        }
        console.error('Read text error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    }
  )

  // 写入文本文件
  ipcMain.handle(
    'fs:write-text',
    async (
      _event,
      filePath: string,
      content: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const validation = validatePath(filePath, options?.allowCustomPath)
        if (!validation.valid) {
          return { success: false, error: validation.error }
        }

        await writeFileAtomically(filePath, Buffer.from(content, 'utf-8'))
        return { success: true }
      } catch (error) {
        console.error('Write text error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    }
  )

  // 读取 JSON 文件
  ipcMain.handle(
    'fs:read-json',
    async (
      _event,
      filePath: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; data?: unknown; error?: string }> => {
      try {
        const validation = validatePath(filePath, options?.allowCustomPath)
        if (!validation.valid) {
          return { success: false, error: validation.error }
        }

        const content = await readFile(filePath, 'utf-8')
        const data = JSON.parse(content)
        return { success: true, data }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return { success: false, error: 'FILE_NOT_FOUND' }
        }
        console.error('Read JSON error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    }
  )

  // 写入 JSON 文件
  ipcMain.handle(
    'fs:write-json',
    async (
      _event,
      filePath: string,
      data: unknown,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const validation = validatePath(filePath, options?.allowCustomPath)
        if (!validation.valid) {
          return { success: false, error: validation.error }
        }

        const content = JSON.stringify(data, null, 2)
        await writeFileAtomically(filePath, Buffer.from(content, 'utf-8'))
        return { success: true }
      } catch (error) {
        console.error('Write JSON error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    }
  )

  // 删除文件或目录
  ipcMain.handle(
    'fs:delete',
    async (
      _event,
      targetPath: string,
      options?: { allowCustomPath?: boolean; recursive?: boolean }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const validation = validatePath(targetPath, options?.allowCustomPath)
        if (!validation.valid) {
          return { success: false, error: validation.error }
        }

        const stats = await stat(targetPath).catch(() => null)
        if (!stats) {
          return { success: true } // 文件不存在，视为删除成功
        }

        if (stats.isDirectory()) {
          await rm(targetPath, { recursive: options?.recursive ?? true })
        } else {
          await unlink(targetPath)
        }

        return { success: true }
      } catch (error) {
        console.error('Delete error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    }
  )

  // 确保目录存在
  ipcMain.handle(
    'fs:ensure-dir',
    async (
      _event,
      dirPath: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const validation = validatePath(dirPath, options?.allowCustomPath)
        if (!validation.valid) {
          return { success: false, error: validation.error }
        }

        await mkdir(dirPath, { recursive: true })
        return { success: true }
      } catch (error) {
        console.error('Ensure dir error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    }
  )

  // 检查路径是否存在
  ipcMain.handle(
    'fs:exists',
    async (
      _event,
      targetPath: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; exists?: boolean; isDirectory?: boolean; error?: string }> => {
      try {
        const validation = validatePath(targetPath, options?.allowCustomPath)
        if (!validation.valid) {
          return { success: false, error: validation.error }
        }

        const stats = await stat(targetPath).catch(() => null)
        if (!stats) {
          return { success: true, exists: false }
        }

        return {
          success: true,
          exists: true,
          isDirectory: stats.isDirectory()
        }
      } catch (error) {
        console.error('Exists check error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    }
  )

  // 列出目录内容
  ipcMain.handle(
    'fs:list-dir',
    async (
      _event,
      dirPath: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{
      success: boolean
      entries?: Array<{ name: string; isDirectory: boolean }>
      error?: string
    }> => {
      try {
        const validation = validatePath(dirPath, options?.allowCustomPath)
        if (!validation.valid) {
          return { success: false, error: validation.error }
        }

        const entries = await readdir(dirPath, { withFileTypes: true })
        return {
          success: true,
          entries: entries.map((entry) => ({
            name: entry.name,
            isDirectory: entry.isDirectory()
          }))
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return { success: true, entries: [] }
        }
        console.error('List dir error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    }
  )

  // 复制文件
  ipcMain.handle(
    'fs:copy-file',
    async (
      _event,
      sourcePath: string,
      destPath: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const sourceValidation = validatePath(sourcePath, options?.allowCustomPath)
        const destValidation = validatePath(destPath, options?.allowCustomPath)

        if (!sourceValidation.valid) {
          return { success: false, error: sourceValidation.error }
        }
        if (!destValidation.valid) {
          return { success: false, error: destValidation.error }
        }

        // 确保目标目录存在
        const destDir = path.dirname(destPath)
        await mkdir(destDir, { recursive: true })

        // 读取并写入
        const content = await readFile(sourcePath)
        await writeFile(destPath, content)

        return { success: true }
      } catch (error) {
        console.error('Copy file error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    }
  )

  // 读取二进制文件（用于附件）
  ipcMain.handle(
    'fs:read-binary',
    async (
      _event,
      filePath: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; content?: string; error?: string }> => {
      try {
        const validation = validatePath(filePath, options?.allowCustomPath)
        if (!validation.valid) {
          return { success: false, error: validation.error }
        }

        const buffer = await readFile(filePath)
        return { success: true, content: buffer.toString('base64') }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return { success: false, error: 'FILE_NOT_FOUND' }
        }
        console.error('Read binary error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    }
  )

  // 写入二进制文件（用于附件）
  ipcMain.handle(
    'fs:write-binary',
    async (
      _event,
      filePath: string,
      base64Content: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const validation = validatePath(filePath, options?.allowCustomPath)
        if (!validation.valid) {
          return { success: false, error: validation.error }
        }

        // 确保父目录存在
        const dir = path.dirname(filePath)
        await mkdir(dir, { recursive: true })

        const buffer = Buffer.from(base64Content, 'base64')
        await writeFile(filePath, buffer)
        return { success: true }
      } catch (error) {
        console.error('Write binary error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    }
  )
}
