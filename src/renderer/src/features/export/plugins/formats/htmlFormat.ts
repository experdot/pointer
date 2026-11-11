import { parseMarkdownTable } from '../../parseMarkdownTable'
import type { FormatPlugin, ExtractedContent, ExportOptions, ConvertResult } from '../../types'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getDirectTopicMessages } from '../../messageTraversal'

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
          `<pre><code class="language-${escapeHtml(content.language || 'text')}">${escapeHtml(content.rawContent)}</code></pre>`,
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
  const rows = parseMarkdownTable(markdown)

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

  // Build model name map for lookup
  const settings = useSettingsStore.getState().settings
  const llmConfigs = settings.llmConfigs.items
  const modelNameMap = new Map(llmConfigs.map((config) => [config.id, config.modelName]))
  const modelConfigNameMap = new Map(
    settings.modelConfigs.items.map((config) => [config.id, config.name])
  )

  if (metadata?.showTopicsOutline && content.topics?.length) {
    const starts = new Set(content.topics.map((topic) => topic.startMessageId))
    parts.push('<nav aria-label="目录"><h1>目录</h1><ul>')
    for (const topic of content.topics) {
      const titles = getDirectTopicMessages(
        messages,
        topic.startMessageId,
        topic.endMessageId,
        starts
      )
        .filter((message) => message.title)
        .map((message) => `<li>${escapeHtml(message.title!)}</li>`)
        .join('')
      parts.push(`<li>${escapeHtml(topic.name)}${titles ? `<ul>${titles}</ul>` : ''}</li>`)
    }
    parts.push('</ul></nav>')
  }

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
    if (metadata?.showModelName && message.llmId) {
      const modelName = modelNameMap.get(message.llmId) || message.llmId
      msgHtml += ` <span style="font-weight: normal; color: #888; font-size: 0.9em;">(${escapeHtml(modelName)})</span>`
    }
    if (metadata?.showModelConfig && message.modelConfigId) {
      const name = modelConfigNameMap.get(message.modelConfigId) ?? message.modelConfigId
      msgHtml += ` (${escapeHtml(name)})`
    }
    msgHtml += '</div>'

    // Title
    if (metadata?.showMessageTitle && message.title) {
      msgHtml += `<div style="font-style: italic; margin-bottom: 8px; color: #555;">${escapeHtml(message.title)}</div>`
    }

    // Reasoning
    if (metadata?.showReasoningContent && message.reasoning) {
      msgHtml += `<details style="margin-bottom: 8px; background: #fff; padding: 8px; border-radius: 4px;">
        <summary style="cursor: pointer; font-weight: 500;">Reasoning</summary>
        <div style="margin-top: 8px; white-space: pre-wrap;">${escapeHtml(message.reasoning)}</div>
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
  // 与界面使用同一 Markdown 解析器，避免正则替换继续处理已经生成的代码标签。
  return renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, markdown)
  )
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
