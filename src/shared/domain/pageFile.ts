/**
 * 页面文件（.pointer.md）编解码
 *
 * 设计目标：
 * - 人类可读：正文就是 Markdown，可直接用编辑器打开、纳入 git
 * - 机器可解析：元数据放在 HTML 注释内的 XML 片段里，不会渲染到正文
 * - 可演进：文件头带 version，读侧拒绝 version 大于 PAGE_FILE_FORMAT_VERSION 的文件。
 *   注意：当前只接受新版标签（<pointer-page> / <pointer-message>），没有迁移前
 *   <page> / <message> 标签的读取路径——用旧标签写出的文件会被判为 missing-page-block，
 *   在工作区扫描时静默跳过（界面上表现为对话消失）。做格式变更前必须先补上旧版本的读取
 *   或显式迁移提示，详见 docs/architecture.md 的《待确认问题》。
 *
 * 结构：
 *
 *   <!--
 *   <pointer-page version="2">
 *     ...页面元数据与 Topic...
 *   </pointer-page>
 *   -->
 *
 *   <!-- [POINTER-MSG] -->
 *   ## 1:1 User
 *   <!--
 *   <pointer-message>
 *     ...消息元数据...
 *   </pointer-message>
 *   -->
 *
 *   正文
 */

import type { AttachmentRef, ChatMessage, MessageRole, Topic } from './chat'
import { ROLE_DISPLAY_NAMES, roleFromDisplayName } from './chat'
import type { Page } from './page'

export const PAGE_FILE_FORMAT_VERSION = 2

export const PAGE_BLOCK_START = '<!--\n<pointer-page version="'
export const MESSAGE_HEADER_PREFIX = '<!-- [POINTER-MSG] -->'
const REASONING_OPEN = '<details>\n<summary>💭 Thinking</summary>\n\n'
const REASONING_CLOSE = '\n\n</details>'

export interface PageFileDocument {
  version: number
  page: Page
  messages: ChatMessage[]
  topics: Topic[]
  leafMessageId?: string
  selectedMessageId?: string
}

/** 页面元数据（不包含消息），用于工作区扫描 */
export interface PageMetadata {
  page: Page
  topics: Topic[]
  leafMessageId?: string
  selectedMessageId?: string
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

// ==================== 转义 ====================

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function unescapeXml(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
}

/** 防止正文伪造元数据注释块或提前结束 details */
function escapeBody(value: string): string {
  return value
    .replace(/<!--/g, '&lt;!--')
    .replace(/-->/g, '--&gt;')
    .replace(/<\/details/gi, '<\\/details')
}

function unescapeBody(value: string): string {
  return value
    .replace(/&lt;!--/g, '<!--')
    .replace(/--&gt;/g, '-->')
    .replace(/<\\\/details/gi, '</details')
}

// ==================== XML 小工具 ====================

function element(name: string, value: string | number | boolean | undefined): string {
  if (value === undefined) return ''
  return `  <${name}>${escapeXml(String(value))}</${name}>\n`
}

function readElement(xml: string, name: string): string | undefined {
  const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return match ? unescapeXml(match[1].trim()) : undefined
}

function readNumber(xml: string, name: string): number | undefined {
  const raw = readElement(xml, name)
  if (raw === undefined) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

function readBoolean(xml: string, name: string): boolean | undefined {
  const raw = readElement(xml, name)
  return raw === undefined ? undefined : raw === 'true'
}

// ==================== 序列化 ====================

function serializeTopics(topics: readonly Topic[]): string {
  if (topics.length === 0) return ''

  let xml = '  <topics>\n'
  for (const topic of topics) {
    xml += '    <topic>\n'
    xml += `      <id>${escapeXml(topic.id)}</id>\n`
    xml += `      <name>${escapeXml(topic.name)}</name>\n`
    xml += `      <startMessageId>${escapeXml(topic.startMessageId)}</startMessageId>\n`
    if (topic.endMessageId) {
      xml += `      <endMessageId>${escapeXml(topic.endMessageId)}</endMessageId>\n`
    }
    xml += `      <collapsed>${topic.collapsed}</collapsed>\n`
    xml += '    </topic>\n'
  }

  return `${xml}  </topics>\n`
}

function serializePageBlock(doc: PageFileDocument): string {
  let xml = `${PAGE_BLOCK_START}${doc.version}">\n`
  xml += element('id', doc.page.id)
  xml += element('name', doc.page.name)
  if (doc.page.starred) xml += element('starred', true)
  if (doc.page.parentFolderId) xml += element('parentFolderId', doc.page.parentFolderId)
  xml += element('order', doc.page.order)
  xml += element('createdAt', doc.page.createdAt)
  if (doc.page.updatedAt) xml += element('updatedAt', doc.page.updatedAt)
  if (doc.leafMessageId) xml += element('leafMessageId', doc.leafMessageId)
  if (doc.selectedMessageId) xml += element('selectedMessageId', doc.selectedMessageId)
  xml += serializeTopics(doc.topics)
  xml += '</pointer-page>\n-->'
  return xml
}

function serializeMessageBlock(message: ChatMessage): string {
  let xml = '<!--\n<pointer-message>\n'
  xml += element('id', message.id)
  xml += element('time', message.createdAt)
  if (message.updatedAt) xml += element('updatedAt', message.updatedAt)
  if (message.parentMessageId) xml += element('parentMessageId', message.parentMessageId)
  xml += element('branchIndex', message.branchIndex)
  if (message.llmId) xml += element('llmId', message.llmId)
  if (message.modelConfigId) xml += element('modelConfigId', message.modelConfigId)
  if (message.starred) xml += element('starred', true)
  if (message.collapsed) xml += element('collapsed', true)
  if (message.hasError) xml += element('hasError', true)
  if (message.title) xml += element('title', message.title)
  if (message.attachments && message.attachments.length > 0) {
    xml += '  <attachments>\n'
    for (const attachment of message.attachments) {
      xml += '    <attachment>\n'
      xml += `      <id>${escapeXml(attachment.id)}</id>\n`
      xml += `      <name>${escapeXml(attachment.name)}</name>\n`
      xml += `      <mimeType>${escapeXml(attachment.mimeType)}</mimeType>\n`
      xml += `      <size>${attachment.size}</size>\n`
      xml += `      <relativePath>${escapeXml(attachment.relativePath)}</relativePath>\n`
      xml += `      <createdAt>${attachment.createdAt}</createdAt>\n`
      xml += '    </attachment>\n'
    }
    xml += '  </attachments>\n'
  }
  xml += '</pointer-message>\n-->'
  return xml
}

/**
 * 深度优先展开消息，使文件中的阅读顺序与树结构一致
 * 返回每层的显示编号（layer:branch，均从 1 起）
 */
function flattenForDisplay(
  messages: readonly ChatMessage[]
): Array<{ message: ChatMessage; layer: number; branch: number }> {
  const byParent = new Map<string | undefined, ChatMessage[]>()
  for (const message of messages) {
    const siblings = byParent.get(message.parentMessageId) ?? []
    siblings.push(message)
    byParent.set(message.parentMessageId, siblings)
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.branchIndex - b.branchIndex || a.createdAt - b.createdAt)
  }

  const result: Array<{ message: ChatMessage; layer: number; branch: number }> = []
  const visited = new Set<string>()

  const walk = (parentId: string | undefined, layer: number): void => {
    const siblings = byParent.get(parentId) ?? []
    siblings.forEach((message, position) => {
      if (visited.has(message.id)) return
      visited.add(message.id)
      result.push({ message, layer, branch: position + 1 })
      walk(message.id, layer + 1)
    })
  }

  walk(undefined, 1)

  // 兜底：环或孤立节点也应被写出，避免静默丢数据
  for (const message of messages) {
    if (!visited.has(message.id)) {
      visited.add(message.id)
      result.push({ message, layer: 1, branch: 1 })
    }
  }

  return result
}

function serializeMessage(message: ChatMessage, layer: number, branch: number): string {
  const numbering = branch > 1 ? `${layer}:${branch}` : `${layer}`
  const role = ROLE_DISPLAY_NAMES[message.role]
  const header = `${MESSAGE_HEADER_PREFIX}\n## ${numbering} ${role}`
  const metadata = serializeMessageBlock(message)

  const parts = [header, metadata]

  if (message.reasoning) {
    parts.push(`${REASONING_OPEN}${escapeBody(message.reasoning)}${REASONING_CLOSE}`)
  }

  if (message.content) {
    parts.push(escapeBody(message.content))
  }

  return parts.join('\n\n')
}

export function serializePageFile(doc: PageFileDocument): string {
  const sections = [serializePageBlock(doc)]

  for (const { message, layer, branch } of flattenForDisplay(doc.messages)) {
    sections.push(serializeMessage(message, layer, branch))
  }

  return `${sections.join('\n\n')}\n`
}

const PAGE_BLOCK_PATTERN = /<!--\s*\n?<pointer-page version="\d+">[\s\S]*?<\/pointer-page>\s*\n?-->/

/**
 * 只替换页面元数据块，正文（消息）保持原样
 *
 * 用于星标/改名/排序这类纯元数据变更：避免整篇重新序列化与解析，
 * 同时保证元数据一定会落盘（迁移前正是这里缺失导致重扫回滚）。
 */
export function replacePageMetadata(
  fileText: string,
  doc: Pick<PageFileDocument, 'version' | 'page' | 'topics' | 'leafMessageId' | 'selectedMessageId'>
): string {
  const block = serializePageBlock({ ...doc, messages: [] })
  if (!PAGE_BLOCK_PATTERN.test(fileText)) {
    return `${block}\n\n${fileText}`
  }
  return fileText.replace(PAGE_BLOCK_PATTERN, block)
}

// ==================== 解析 ====================

function parseTopics(xml: string): Topic[] {
  const block = xml.match(/<topics>([\s\S]*?)<\/topics>/)
  if (!block) return []

  const topics: Topic[] = []
  const topicPattern = /<topic>([\s\S]*?)<\/topic>/g
  let match: RegExpExecArray | null

  while ((match = topicPattern.exec(block[1])) !== null) {
    const topicXml = match[1]
    const id = readElement(topicXml, 'id')
    const name = readElement(topicXml, 'name')
    const startMessageId = readElement(topicXml, 'startMessageId')
    const collapsed = readBoolean(topicXml, 'collapsed')

    if (id && name && startMessageId) {
      topics.push({
        id,
        name,
        startMessageId,
        endMessageId: readElement(topicXml, 'endMessageId'),
        collapsed: collapsed ?? false
      })
    }
  }

  return topics
}

/** 只解析页面元数据块，用于工作区扫描 */
export function parsePageMetadata(text: string): ParseResult<PageMetadata> {
  const match = text.match(
    /<!--\s*\n?<pointer-page version="(\d+)">([\s\S]*?)<\/pointer-page>\s*\n?-->/
  )
  if (!match) {
    return { ok: false, error: 'missing-page-block' }
  }

  const version = Number.parseInt(match[1], 10)
  if (version > PAGE_FILE_FORMAT_VERSION) {
    return { ok: false, error: `unsupported-version:${version}` }
  }

  const xml = match[2]
  const id = readElement(xml, 'id')
  const name = readElement(xml, 'name')
  const createdAt = readNumber(xml, 'createdAt')

  if (!id || !name || createdAt === undefined) {
    return { ok: false, error: 'incomplete-page-block' }
  }

  return {
    ok: true,
    value: {
      page: {
        id,
        name,
        kind: 'page',
        starred: readBoolean(xml, 'starred'),
        parentFolderId: readElement(xml, 'parentFolderId'),
        order: readNumber(xml, 'order') ?? 0,
        createdAt,
        updatedAt: readNumber(xml, 'updatedAt')
      },
      topics: parseTopics(xml),
      leafMessageId: readElement(xml, 'leafMessageId'),
      selectedMessageId: readElement(xml, 'selectedMessageId')
    }
  }
}

function parseMessageBlock(section: string): ChatMessage | null {
  const headerEnd = section.indexOf('\n')
  if (headerEnd === -1) return null

  const headerLine = section.slice(0, headerEnd).trim()
  const headerMatch = headerLine.match(/^##\s+\d+(?::\d+)?\s+(User|Assistant|System)\s*$/)
  if (!headerMatch) return null

  const role = roleFromDisplayName(headerMatch[1])
  if (!role) return null

  const rest = section.slice(headerEnd + 1)
  const metaMatch = rest.match(/<!--\s*\n?<pointer-message>([\s\S]*?)<\/pointer-message>\s*\n?-->/)
  if (!metaMatch) return null

  const xml = metaMatch[1]
  const id = readElement(xml, 'id')
  if (!id) return null

  const body = rest.slice((metaMatch.index ?? 0) + metaMatch[0].length)

  const reasoningMatch = body.match(
    /<details>\s*<summary>[^<]*<\/summary>\s*([\s\S]*?)\s*<\/details>/
  )
  const reasoning = reasoningMatch ? unescapeBody(reasoningMatch[1].trim()) : undefined
  const contentSource = reasoningMatch ? body.replace(reasoningMatch[0], '') : body

  const message: ChatMessage = {
    id,
    role: role as MessageRole,
    content: unescapeBody(contentSource.trim()),
    createdAt: readNumber(xml, 'time') ?? 0,
    branchIndex: readNumber(xml, 'branchIndex') ?? 0,
    parentMessageId: readElement(xml, 'parentMessageId'),
    llmId: readElement(xml, 'llmId'),
    modelConfigId: readElement(xml, 'modelConfigId'),
    title: readElement(xml, 'title')
  }

  if (reasoning) message.reasoning = reasoning
  const updatedAt = readNumber(xml, 'updatedAt')
  if (updatedAt !== undefined) message.updatedAt = updatedAt
  if (readBoolean(xml, 'starred')) message.starred = true
  if (readBoolean(xml, 'collapsed')) message.collapsed = true
  if (readBoolean(xml, 'hasError')) message.hasError = true

  const attachments = parseAttachments(xml)
  if (attachments) message.attachments = attachments

  return message
}

function parseAttachments(xml: string): AttachmentRef[] | undefined {
  const block = xml.match(/<attachments>([\s\S]*?)<\/attachments>/)
  if (!block) return undefined

  const attachments: AttachmentRef[] = []
  const pattern = /<attachment>([\s\S]*?)<\/attachment>/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(block[1])) !== null) {
    const item = match[1]
    const id = readElement(item, 'id')
    const name = readElement(item, 'name')
    const mimeType = readElement(item, 'mimeType')
    const size = readNumber(item, 'size')
    const relativePath = readElement(item, 'relativePath')
    const createdAt = readNumber(item, 'createdAt')

    if (id && name && mimeType && relativePath && size !== undefined && createdAt !== undefined) {
      attachments.push({ id, name, mimeType, size, relativePath, createdAt })
    }
  }

  return attachments.length > 0 ? attachments : undefined
}

function splitMessageSections(text: string): string[] {
  const sections: string[] = []
  const parts = text.split(MESSAGE_HEADER_PREFIX)

  for (let index = 1; index < parts.length; index++) {
    const section = parts[index].replace(/\n*<!--\s*═+\s*-->\s*$/, '').trim()
    if (section) sections.push(section)
  }

  return sections
}

export function parsePageFile(text: string): ParseResult<PageFileDocument> {
  const metadata = parsePageMetadata(text)
  if (!metadata.ok) return metadata

  const versionMatch = text.match(/<pointer-page version="(\d+)">/)
  const version = versionMatch ? Number.parseInt(versionMatch[1], 10) : PAGE_FILE_FORMAT_VERSION

  const messages: ChatMessage[] = []
  for (const section of splitMessageSections(text)) {
    const parsed = parseMessageBlock(section)
    if (parsed) messages.push(parsed)
  }

  return {
    ok: true,
    value: {
      version,
      page: metadata.value.page,
      messages,
      topics: metadata.value.topics,
      leafMessageId: metadata.value.leafMessageId,
      selectedMessageId: metadata.value.selectedMessageId
    }
  }
}
