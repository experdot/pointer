/**
 * 内核所需的主进程能力（对话框、系统集成）
 *
 * 单独抽出来是为了让 RuntimeCore 不直接依赖 Electron 的交互 API。
 */

import { app, dialog, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname } from 'node:path'
import type { RuntimeHost } from './runtime'

export function createRuntimeHost(): RuntimeHost {
  return {
    getVersion(): string {
      return app.getVersion()
    },

    async saveFile(options) {
      const result = await dialog.showSaveDialog({
        defaultPath: options.suggestedName,
        filters: options.filters
      })

      if (result.canceled || !result.filePath) return {}
      if (options.encoding === 'base64') {
        await writeFile(result.filePath, Buffer.from(options.content, 'base64'))
      } else {
        await writeFile(result.filePath, options.content, 'utf8')
      }
      return { savedPath: result.filePath }
    },

    async openTextFile(options) {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: options?.filters
      })

      const filePath = result.filePaths[0]
      if (result.canceled || !filePath) return null

      const content = await readFile(filePath, 'utf8')
      return { name: filePath.split(/[\\/]/).pop() ?? filePath, content }
    },

    async pickDirectory(title) {
      const result = await dialog.showOpenDialog({
        title,
        properties: ['openDirectory', 'createDirectory']
      })
      return result.canceled ? null : (result.filePaths[0] ?? null)
    },

    async pickImages(options) {
      const result = await dialog.showOpenDialog({
        properties: options.multiple === false ? ['openFile'] : ['openFile', 'multiSelections'],
        filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
      })

      if (result.canceled) return []

      const images: Array<{ name: string; mimeType: string; size: number; dataBase64: string }> = []
      for (const filePath of result.filePaths) {
        const buffer = await readFile(filePath)
        images.push({
          name: basename(filePath),
          mimeType: mimeTypeOf(filePath),
          size: buffer.byteLength,
          dataBase64: buffer.toString('base64')
        })
      }
      return images
    },

    async openInFileManager(targetPath) {
      const error = await shell.openPath(dirname(targetPath))
      if (error) console.warn('[runtime] 打开文件管理器失败：', error)
    }
  }
}

function mimeTypeOf(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}
