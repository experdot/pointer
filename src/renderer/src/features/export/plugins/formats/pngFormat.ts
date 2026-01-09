import html2canvas from 'html2canvas'
import type { FormatPlugin, ExtractedContent, ExportOptions, ConvertResult } from '../../types'

/**
 * PNG Format Plugin
 *
 * Converts content to PNG image format.
 * Uses html2canvas library to render HTML and capture as image.
 */
export const pngFormatPlugin: FormatPlugin = {
  id: 'png',
  name: 'PNG',
  extension: 'png',
  mimeType: 'image/png',

  async convert(content: ExtractedContent, options: ExportOptions): Promise<ConvertResult> {
    // Create a temporary container for rendering
    const container = document.createElement('div')
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: -9999px;
      width: ${options.imageOptions?.width || 800}px;
      padding: 20px;
      background: ${options.imageOptions?.theme === 'dark' ? '#1a1a1a' : '#ffffff'};
      color: ${options.imageOptions?.theme === 'dark' ? '#ffffff' : '#333333'};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
    `

    // Convert content to HTML for rendering
    container.innerHTML = contentToHtml(content, options)

    // Append to document
    document.body.appendChild(container)

    try {
      // Use html2canvas to render
      const canvas = await html2canvas(container, {
        backgroundColor: options.imageOptions?.backgroundColor || '#ffffff',
        scale: 2, // High resolution
        useCORS: true,
        logging: false
      })

      // Convert canvas to Blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b)
            else reject(new Error('Failed to create blob'))
          },
          'image/png',
          options.imageOptions?.quality || 1
        )
      })

      // Generate preview dataURL
      const dataUrl = canvas.toDataURL('image/png', options.imageOptions?.quality || 1)

      return {
        content: blob,
        preview: dataUrl,
        isBinary: true,
        extension: 'png',
        mimeType: 'image/png'
      }
    } finally {
      // Clean up
      document.body.removeChild(container)
    }
  }
}

/**
 * Convert extracted content to HTML for rendering
 */
function contentToHtml(content: ExtractedContent, options: ExportOptions): string {
  switch (content.contentType) {
    case 'messages':
      return messagesToHtml(content, options)

    case 'text':
      return `<div style="white-space: pre-wrap;">${escapeHtml(content.rawContent)}</div>`

    case 'code':
      return `<pre style="background: #2d2d2d; color: #ccc; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 0;"><code>${escapeHtml(content.rawContent)}</code></pre>`

    case 'table':
      return markdownTableToHtml(content.rawContent)

    default:
      return `<pre>${escapeHtml(content.rawContent)}</pre>`
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Convert messages to HTML
 */
function messagesToHtml(content: ExtractedContent, options: ExportOptions): string {
  const { messages } = content
  if (!messages || messages.length === 0) {
    return `<pre>${escapeHtml(content.rawContent)}</pre>`
  }

  const { metadata } = options
  const isDark = options.imageOptions?.theme === 'dark'
  const parts: string[] = []

  for (const message of messages) {
    const roleLabel =
      message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'System'

    // Adjust colors for dark theme
    let bgColor: string
    if (isDark) {
      bgColor =
        message.role === 'user' ? '#1e3a5f' : message.role === 'assistant' ? '#2d2d2d' : '#3d2e1f'
    } else {
      bgColor =
        message.role === 'user' ? '#e3f2fd' : message.role === 'assistant' ? '#f5f5f5' : '#fff3e0'
    }

    let msgHtml = `<div style="margin-bottom: 16px; padding: 16px; border-radius: 12px; background: ${bgColor};">`

    // Header
    msgHtml += `<div style="font-weight: 600; margin-bottom: 8px; font-size: 15px;">${roleLabel}`
    if (metadata?.showTimestamp && message.createdAt) {
      const date = new Date(message.createdAt)
      const timestampColor = isDark ? '#aaa' : '#666'
      msgHtml += ` <span style="font-weight: normal; color: ${timestampColor}; font-size: 13px;">${date.toLocaleString()}</span>`
    }
    msgHtml += '</div>'

    // Content
    msgHtml += `<div style="white-space: pre-wrap; font-size: 14px;">${simpleMarkdownToHtml(message.content, isDark)}</div>`

    msgHtml += '</div>'
    parts.push(msgHtml)
  }

  return parts.join('')
}

/**
 * Simple markdown to HTML conversion
 */
function simpleMarkdownToHtml(markdown: string, isDark = false): string {
  let html = escapeHtml(markdown)

  // Code block colors
  const codeBlockBg = isDark ? '#1e1e1e' : '#2d2d2d'
  const inlineCodeBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'

  // Code blocks
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    `<pre style="background: ${codeBlockBg}; color: #ccc; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0;"><code>$2</code></pre>`
  )

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    `<code style="background: ${inlineCodeBg}; padding: 2px 6px; border-radius: 3px; font-size: 13px;">$1</code>`
  )

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Line breaks
  html = html.replace(/\n/g, '<br>')

  return html
}

/**
 * Convert markdown table to HTML
 */
function markdownTableToHtml(markdown: string): string {
  const lines = markdown.trim().split('\n')
  const rows: string[][] = []

  for (const line of lines) {
    if (/^[\s|:-]+$/.test(line)) {
      continue
    }

    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0)

    if (cells.length > 0) {
      rows.push(cells)
    }
  }

  if (rows.length === 0) return ''

  const headerRow = rows[0]
  const bodyRows = rows.slice(1)

  let html = '<table style="border-collapse: collapse; width: 100%; font-size: 14px;">\n'

  // Header
  html += '<thead><tr>'
  for (const cell of headerRow) {
    html += `<th style="background: #f0f0f0; padding: 10px 12px; border: 1px solid #ddd; font-weight: 600; text-align: left;">${escapeHtml(cell)}</th>`
  }
  html += '</tr></thead>\n'

  // Body
  if (bodyRows.length > 0) {
    html += '<tbody>'
    for (let i = 0; i < bodyRows.length; i++) {
      const row = bodyRows[i]
      const rowBg = i % 2 === 0 ? '#fff' : '#fafafa'
      html += `<tr style="background: ${rowBg};">`
      for (const cell of row) {
        html += `<td style="padding: 10px 12px; border: 1px solid #ddd;">${escapeHtml(cell)}</td>`
      }
      html += '</tr>'
    }
    html += '</tbody>\n'
  }

  html += '</table>'
  return html
}
