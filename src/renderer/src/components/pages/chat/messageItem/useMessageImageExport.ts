import { useState, useRef, useCallback } from 'react'
import { App } from 'antd'
import {
  captureElementToCanvas,
  canvasToDataURL,
  canvasToBlob,
  copyBlobToClipboard,
  dataURLtoBlob
} from '@renderer/utils/exporter'
import { ImageExportWidth } from '../ImagePreviewModal'

export function useMessageImageExport() {
  const [isImagePreviewVisible, setIsImagePreviewVisible] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [currentCanvas, setCurrentCanvas] = useState<HTMLCanvasElement | null>(null)
  const [isExportingImage, setIsExportingImage] = useState(false)
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false)
  const [imageExportWidth, setImageExportWidth] = useState<ImageExportWidth>('medium')
  const [shouldRenderExportContainer, setShouldRenderExportContainer] = useState(false)

  const exportContentRef = useRef<HTMLDivElement>(null)
  const { message: antdMessage } = App.useApp()

  const generateImage = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    let retries = 0
    const maxRetries = 20 // 最多等待2秒

    while (!exportContentRef.current && retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      retries++
    }

    if (!exportContentRef.current) {
      throw new Error('导出容器未找到')
    }

    // 额外等待以确保样式和内容完全加载
    await new Promise((resolve) => setTimeout(resolve, 200))

    const canvas = await captureElementToCanvas(exportContentRef.current, 40, 40)
    const dataURL = canvasToDataURL(canvas)

    setCurrentCanvas(canvas)
    setPreviewImageUrl(dataURL)
    return canvas
  }, [antdMessage])

  const handleCopyAsImage = useCallback(async () => {
    setIsExportingImage(true)

    try {
      // 触发导出容器渲染
      setShouldRenderExportContainer(true)

      // 等待状态更新和DOM渲染
      await new Promise((resolve) => setTimeout(resolve, 50))

      await generateImage()
      setIsImagePreviewVisible(true)
    } catch (error) {
      console.error('Failed to export image:', error)
      antdMessage.error('导出图片失败')
    } finally {
      setIsExportingImage(false)
    }
  }, [generateImage, antdMessage])

  const handleWidthChange = useCallback(
    async (newWidth: ImageExportWidth) => {
      setImageExportWidth(newWidth)
      setIsRegeneratingImage(true)

      try {
        // 等待DOM更新后重新生成图片
        await new Promise((resolve) => setTimeout(resolve, 100))
        await generateImage()
      } catch (error) {
        console.error('Failed to regenerate image:', error)
        antdMessage.error('重新生成图片失败')
      } finally {
        setIsRegeneratingImage(false)
      }
    },
    [generateImage, antdMessage]
  )

  const handleImageEdited = useCallback((editedImageUrl: string) => {
    setPreviewImageUrl(editedImageUrl)
  }, [])

  const handleSaveImage = useCallback(async () => {
    // 如果有编辑后的图片，直接从 previewImageUrl 保存
    if (previewImageUrl && previewImageUrl.startsWith('data:')) {
      try {
        const blob = dataURLtoBlob(previewImageUrl)
        const now = new Date()
        const timeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
        const fileName = `消息_${timeString}.png`

        // 将 blob 转换为 Uint8Array
        const arrayBuffer = await blob.arrayBuffer()
        const buffer = new Uint8Array(arrayBuffer)

        // 调用主进程保存文件
        const result = await window.api.saveFile({
          content: buffer,
          defaultPath: fileName,
          filters: [
            { name: 'PNG Images', extensions: ['png'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })

        if (result.success) {
          antdMessage.success(`图片已保存: ${result.filePath}`)
          setIsImagePreviewVisible(false)
        } else if (!result.cancelled) {
          antdMessage.error(`保存失败: ${result.error}`)
        }
        return
      } catch (error) {
        console.error('Failed to save image:', error)
        antdMessage.error('保存图片失败')
        return
      }
    }

    // 原有的canvas保存逻辑
    if (!currentCanvas) {
      antdMessage.error('没有可保存的图片')
      return
    }

    try {
      const blob = await canvasToBlob(currentCanvas)
      const now = new Date()
      const timeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
      const fileName = `消息_${timeString}.png`

      // 将 blob 转换为 Uint8Array
      const arrayBuffer = await blob.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)

      // 调用主进程保存文件
      const result = await window.api.saveFile({
        content: buffer,
        defaultPath: fileName,
        filters: [
          { name: 'PNG Images', extensions: ['png'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.success) {
        antdMessage.success(`图片已保存: ${result.filePath}`)
        setIsImagePreviewVisible(false)
      } else if (!result.cancelled) {
        antdMessage.error(`保存失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to save image:', error)
      antdMessage.error('保存图片失败')
    }
  }, [currentCanvas, previewImageUrl, antdMessage])

  const handleCopyImageToClipboard = useCallback(async () => {
    // 如果有编辑后的图片，直接从 previewImageUrl 复制
    if (previewImageUrl && previewImageUrl.startsWith('data:')) {
      try {
        // 使用 dataURLtoBlob 函数而不是 fetch，避免 CSP 问题
        const blob = dataURLtoBlob(previewImageUrl)
        await copyBlobToClipboard(blob)
        antdMessage.success('图片已复制到剪贴板')
        return
      } catch (error) {
        console.error('Failed to copy image:', error)
        antdMessage.error('复制到剪贴板失败')
        return
      }
    }

    // 原有的canvas复制逻辑
    if (!currentCanvas) {
      antdMessage.error('没有可复制的图片')
      return
    }

    try {
      const blob = await canvasToBlob(currentCanvas)
      await copyBlobToClipboard(blob)
      antdMessage.success('图片已复制到剪贴板')
    } catch (error) {
      console.error('Failed to copy image:', error)
      antdMessage.error('复制到剪贴板失败')
    }
  }, [currentCanvas, previewImageUrl, antdMessage])

  const closeImagePreview = useCallback(() => {
    setIsImagePreviewVisible(false)
  }, [])

  return {
    // State
    isImagePreviewVisible,
    previewImageUrl,
    currentCanvas,
    isExportingImage,
    isRegeneratingImage,
    imageExportWidth,
    shouldRenderExportContainer,
    exportContentRef,

    // Actions
    handleCopyAsImage,
    handleWidthChange,
    handleImageEdited,
    handleSaveImage,
    handleCopyImageToClipboard,
    closeImagePreview,
    setImageExportWidth,
    setIsImagePreviewVisible
  }
}
