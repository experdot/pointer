import { ipcMain, app } from 'electron'
import { writeFile, readFile, unlink, mkdir, rename, rm } from 'fs/promises'
import * as path from 'path'

/**
 * 附件处理器
 * 管理文件附件的本地存储
 */
class AttachmentHandler {
  private attachmentsDir: string

  constructor() {
    // 附件存储目录：应用数据目录/attachments
    this.attachmentsDir = path.join(app.getPath('userData'), 'attachments')
  }

  /**
   * 保存附件到本地
   * @param fileId 文件ID
   * @param fileName 文件名
   * @param base64Content base64编码的文件内容
   * @param pageId 页面ID（可选）
   * @param messageId 消息ID（可选）
   * @returns 相对路径
   */
  async saveAttachment(
    fileId: string,
    fileName: string,
    base64Content: string,
    pageId?: string,
    messageId?: string
  ): Promise<{ success: boolean; localPath?: string; error?: string }> {
    try {
      // 确定存储路径
      let targetDir: string
      if (pageId && messageId) {
        targetDir = path.join(this.attachmentsDir, pageId, messageId)
      } else {
        targetDir = path.join(this.attachmentsDir, 'temp')
      }

      // 创建目录
      await mkdir(targetDir, { recursive: true })

      // 提取文件扩展名
      const ext = path.extname(fileName)
      const filePath = path.join(targetDir, `${fileId}${ext}`)

      // 写入文件
      const buffer = Buffer.from(base64Content, 'base64')
      await writeFile(filePath, buffer)

      // 返回相对路径
      const relativePath = path.relative(this.attachmentsDir, filePath)
      return { success: true, localPath: relativePath }
    } catch (error) {
      console.error('保存附件失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存附件失败'
      }
    }
  }

  /**
   * 读取附件内容
   * @param localPath 相对路径
   * @returns base64编码的内容
   */
  async readAttachment(
    localPath: string
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const fullPath = path.join(this.attachmentsDir, localPath)
      const buffer = await readFile(fullPath)
      const base64 = buffer.toString('base64')
      return { success: true, content: base64 }
    } catch (error) {
      console.error('读取附件失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取附件失败'
      }
    }
  }

  /**
   * 删除附件
   * @param localPath 相对路径
   */
  async deleteAttachment(
    localPath: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const fullPath = path.join(this.attachmentsDir, localPath)
      await unlink(fullPath)
      return { success: true }
    } catch (error) {
      console.error('删除附件失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除附件失败'
      }
    }
  }

  /**
   * 移动附件（从temp到正式目录）
   * @param fileId 文件ID
   * @param fileName 文件名
   * @param fromPath 源路径（相对路径）
   * @param pageId 目标页面ID
   * @param messageId 目标消息ID
   */
  async moveAttachment(
    fileId: string,
    fileName: string,
    fromPath: string,
    pageId: string,
    messageId: string
  ): Promise<{ success: boolean; localPath?: string; error?: string }> {
    try {
      const sourcePath = path.join(this.attachmentsDir, fromPath)

      const targetDir = path.join(this.attachmentsDir, pageId, messageId)
      await mkdir(targetDir, { recursive: true })

      const ext = path.extname(fileName)
      const targetPath = path.join(targetDir, `${fileId}${ext}`)

      await rename(sourcePath, targetPath)

      const relativePath = path.relative(this.attachmentsDir, targetPath)
      return { success: true, localPath: relativePath }
    } catch (error) {
      console.error('移动附件失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '移动附件失败'
      }
    }
  }

  /**
   * 清理指定消息的所有附件
   * @param pageId 页面ID
   * @param messageId 消息ID
   */
  async cleanupMessageAttachments(
    pageId: string,
    messageId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const targetDir = path.join(this.attachmentsDir, pageId, messageId)
      await rm(targetDir, { recursive: true, force: true })
      return { success: true }
    } catch (error) {
      console.error('清理消息附件失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '清理消息附件失败'
      }
    }
  }

  /**
   * 清理指定页面的所有附件
   * @param pageId 页面ID
   */
  async cleanupPageAttachments(
    pageId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const targetDir = path.join(this.attachmentsDir, pageId)
      await rm(targetDir, { recursive: true, force: true })
      return { success: true }
    } catch (error) {
      console.error('清理页面附件失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '清理页面附件失败'
      }
    }
  }

  /**
   * 清理临时目录中的所有文件
   */
  async cleanupTempAttachments(): Promise<{ success: boolean; error?: string }> {
    try {
      const tempDir = path.join(this.attachmentsDir, 'temp')
      await rm(tempDir, { recursive: true, force: true })
      // 重新创建temp目录
      await mkdir(tempDir, { recursive: true })
      return { success: true }
    } catch (error) {
      console.error('清理临时附件失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '清理临时附件失败'
      }
    }
  }
}

// 创建全局实例
export const attachmentHandler = new AttachmentHandler()

/**
 * 设置附件相关的 IPC 处理器
 */
export function setupAttachmentHandlers(): void {
  // 保存附件
  ipcMain.handle(
    'attachment:save',
    async (
      _event,
      options: {
        fileId: string
        fileName: string
        base64Content: string
        pageId?: string
        messageId?: string
      }
    ) => {
      return await attachmentHandler.saveAttachment(
        options.fileId,
        options.fileName,
        options.base64Content,
        options.pageId,
        options.messageId
      )
    }
  )

  // 读取附件
  ipcMain.handle('attachment:read', async (_event, localPath: string) => {
    return await attachmentHandler.readAttachment(localPath)
  })

  // 删除附件
  ipcMain.handle('attachment:delete', async (_event, localPath: string) => {
    return await attachmentHandler.deleteAttachment(localPath)
  })

  // 移动附件
  ipcMain.handle(
    'attachment:move',
    async (
      _event,
      options: {
        fileId: string
        fileName: string
        fromPath: string
        pageId: string
        messageId: string
      }
    ) => {
      return await attachmentHandler.moveAttachment(
        options.fileId,
        options.fileName,
        options.fromPath,
        options.pageId,
        options.messageId
      )
    }
  )

  // 清理消息附件
  ipcMain.handle(
    'attachment:cleanup-message',
    async (
      _event,
      options: {
        pageId: string
        messageId: string
      }
    ) => {
      return await attachmentHandler.cleanupMessageAttachments(options.pageId, options.messageId)
    }
  )

  // 清理页面附件
  ipcMain.handle('attachment:cleanup-page', async (_event, pageId: string) => {
    return await attachmentHandler.cleanupPageAttachments(pageId)
  })

  // 清理临时附件
  ipcMain.handle('attachment:cleanup-temp', async () => {
    return await attachmentHandler.cleanupTempAttachments()
  })
}
