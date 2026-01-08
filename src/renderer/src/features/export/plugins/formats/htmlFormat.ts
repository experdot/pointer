import type { FormatPlugin, ExtractedContent, ExportOptions, ConvertResult } from '../../types'

/**
 * HTML Format Plugin
 *
 * Converts extracted content to HTML format.
 * Uses inline styles for standalone viewing.
 */
export const htmlFormatPlugin: FormatPlugin = {
  id: 'html',
  name: 'HTML',
  extension: 'html',
  mimeType: 'text/html',

  async convert(content: ExtractedContent, options: ExportOptions): Promise<ConvertResult> {
    let html: string

    switch (content.contentType) {
      case 'messages':
        html = convertMessagesToHtml(content, options)
        break

      case 'text':
        html = wrapInHtml(escapeHtml(content.rawContent).replace(/\n/g, '<br>'), 'Text Export')
        break

      case 'code':
        html = wrapInHtml(
          `<pre><code class="language-${content.language || 'text'}">${escapeHtml(content.rawContent)}</code></pre>`,
          'Code Export'
        )
        break

      case 'table':
        html = wrapInHtml(markdownTableToHtml(content.rawContent), 'Table Export')
        break

      default:
        html = wrapInHtml(escapeHtml(content.rawContent), 'Export')
    }

    return {
      content: html,
      preview: html,
      isBinary: false,
      extension: 'html',
      mimeType: 'text/html'
    }
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
 * Convert markdown table to HTML table
 */
function markdownTableToHtml(markdown: string): string {
  const lines = markdown.trim().split('\n')
  const rows: string[][] = []

  for (const line of lines) {
    // Skip separator lines
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

  let html =
    '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">\n'

  // Header
  html += '<thead><tr>'
  for (const cell of headerRow) {
    html += `<th style="background: #f0f0f0; font-weight: bold;">${escapeHtml(cell)}</th>`
  }
  html += '</tr></thead>\n'

  // Body
  if (bodyRows.length > 0) {
    html += '<tbody>'
    for (const row of bodyRows) {
      html += '<tr>'
      for (const cell of row) {
        html += `<td>${escapeHtml(cell)}</td>`
      }
      html += '</tr>'
    }
    html += '</tbody>\n'
  }

  html += '</table>'
  return html
}

/**
 * Convert messages to HTML format
 */
function convertMessagesToHtml(content: ExtractedContent, options: ExportOptions): string {
  const { messages } = content
  if (!messages || messages.length === 0) {
    return wrapInHtml(`<pre>${escapeHtml(content.rawContent)}</pre>`, 'Export')
  }

  const { metadata } = options
  const parts: string[] = []

  for (const message of messages) {
    const roleLabel =
      message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'System'
    const bgColor =
      message.role === 'user' ? '#e3f2fd' : message.role === 'assistant' ? '#f5f5f5' : '#fff3e0'

    let msgHtml = `<div style="margin-bottom: 16px; padding: 12px; border-radius: 8px; background: ${bgColor};">`

    // Header
    msgHtml += `<div style="font-weight: bold; margin-bottom: 8px;">${roleLabel}`
    if (metadata?.showTimestamp && message.createdAt) {
      const date = new Date(message.createdAt)
      msgHtml += ` <span style="font-weight: normal; color: #666; font-size: 0.9em;">${date.toLocaleString()}</span>`
    }
    if (metadata?.showModelName && message.modelId) {
      msgHtml += ` <span style="font-weight: normal; color: #888; font-size: 0.9em;">(${escapeHtml(message.modelId)})</span>`
    }
    msgHtml += '</div>'

    // Title
    if (metadata?.showMessageTitle && message.title) {
      msgHtml += `<div style="font-style: italic; margin-bottom: 8px; color: #555;">${escapeHtml(message.title)}</div>`
    }

    // Reasoning
    if (metadata?.showReasoningContent && message.reasoning_content) {
      msgHtml += `<details style="margin-bottom: 8px; background: #fff; padding: 8px; border-radius: 4px;">
        <summary style="cursor: pointer; font-weight: 500;">Reasoning</summary>
        <div style="margin-top: 8px; white-space: pre-wrap;">${escapeHtml(message.reasoning_content)}</div>
      </details>`
    }

    // Content - simple markdown to HTML conversion
    msgHtml += `<div style="white-space: pre-wrap;">${simpleMarkdownToHtml(message.content)}</div>`

    msgHtml += '</div>'
    parts.push(msgHtml)
  }

  return wrapInHtml(parts.join('\n'), 'Messages Export')
}

/**
 * Simple markdown to HTML conversion
 */
function simpleMarkdownToHtml(markdown: string): string {
  let html = escapeHtml(markdown)

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre style="background: #2d2d2d; color: #ccc; padding: 12px; border-radius: 4px; overflow-x: auto;"><code>${code}</code></pre>`
  })

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code style="background: #f0f0f0; padding: 2px 4px; border-radius: 2px;">$1</code>'
  )

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // Line breaks
  html = html.replace(/\n/g, '<br>')

  return html
}

/**
 * Wrap content in a complete HTML document
 */
function wrapInHtml(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #fff;
      color: #333;
    }
    pre {
      overflow-x: auto;
    }
    code {
      font-family: Consolas, Monaco, "Courier New", monospace;
    }
  </style>
</head>
<body>
${content}
</body>
</html>`
}
