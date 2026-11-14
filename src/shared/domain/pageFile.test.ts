import { describe, expect, it } from 'vitest'
import type { ChatMessage } from './chat'
import {
  MESSAGE_HEADER_PREFIX,
  PAGE_FILE_FORMAT_VERSION,
  parsePageFile,
  parsePageMetadata,
  serializePageFile
} from './pageFile'
import type { PageFileDocument } from './pageFile'

function buildDocument(): PageFileDocument {
  const messages: ChatMessage[] = [
    {
      id: 'm1',
      role: 'user',
      content: '第一行\n\n```ts\nconst a = 1\n```\n<!-- [POINTER-MSG] -->\n-->',
      createdAt: 1,
      branchIndex: 0,
      title: '标题 & <tag>'
    },
    {
      id: 'm2',
      role: 'assistant',
      content: '回答内容',
      reasoning: '思考过程 </details> 继续',
      createdAt: 2,
      branchIndex: 0,
      parentMessageId: 'm1',
      llmId: 'llm-1',
      modelConfigId: 'model-1',
      hasError: true,
      starred: true,
      attachments: [
        {
          id: 'att-1',
          name: 'x.png',
          mimeType: 'image/png',
          size: 10,
          relativePath: 'attachments/x.png',
          createdAt: 3
        }
      ]
    },
    {
      id: 'm3',
      role: 'user',
      content: '分支内容',
      createdAt: 4,
      branchIndex: 1,
      parentMessageId: 'm1',
      collapsed: true
    }
  ]

  return {
    version: PAGE_FILE_FORMAT_VERSION,
    page: {
      id: 'page-1',
      kind: 'page',
      name: '页面 <A> & "B"',
      starred: true,
      parentFolderId: 'folder-1',
      order: 2,
      createdAt: 100,
      updatedAt: 200
    },
    messages,
    topics: [
      { id: 't1', name: '主题 & <x>', startMessageId: 'm1', endMessageId: 'm2', collapsed: false }
    ],
    leafMessageId: 'm2',
    selectedMessageId: 'm1'
  }
}

describe('页面文件编解码', () => {
  it('序列化后可以完整还原', () => {
    const document = buildDocument()
    const text = serializePageFile(document)
    const parsed = parsePageFile(text)

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    expect(parsed.value.page).toEqual(document.page)
    expect(parsed.value.topics).toEqual(document.topics)
    expect(parsed.value.leafMessageId).toBe('m2')
    expect(parsed.value.selectedMessageId).toBe('m1')
    expect(parsed.value.messages).toEqual(document.messages)
  })

  it('正文中的注释标记不会伪造消息边界', () => {
    const document = buildDocument()
    const text = serializePageFile(document)
    const parsed = parsePageFile(text)

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    expect(parsed.value.messages).toHaveLength(3)
    expect(parsed.value.messages[0].content).toContain(MESSAGE_HEADER_PREFIX)
    expect(parsed.value.messages[1].reasoning).toContain('</details>')
  })

  it('文件中保留人类可读的 Markdown 与思维链折叠块', () => {
    const text = serializePageFile(buildDocument())

    expect(text).toContain('## 1 User')
    expect(text).toContain('## 2 Assistant')
    expect(text).toContain('## 2:2 User')
    expect(text).toContain('```ts')
    expect(text).toContain('<summary>💭 Thinking</summary>')
  })

  it('可只解析页面元数据用于工作区扫描', () => {
    const text = serializePageFile(buildDocument())
    const metadata = parsePageMetadata(text)

    expect(metadata.ok).toBe(true)
    if (!metadata.ok) return

    expect(metadata.value.page.name).toBe('页面 <A> & "B"')
    expect(metadata.value.page.starred).toBe(true)
    expect(metadata.value.topics).toHaveLength(1)
  })

  it('转义字面量与真实标记混排时可以无损往返', () => {
    const literal = 'a &lt;!-- b --&gt; c <\\/details d &amp; e'
    const mixed = '真注释 <!-- x --> 与真闭合 </details> 同现'

    const document: PageFileDocument = {
      version: PAGE_FILE_FORMAT_VERSION,
      page: { id: 'p-escape', kind: 'page', name: '转义', order: 0, createdAt: 1 },
      messages: [
        { id: 'm1', role: 'user', content: literal, createdAt: 1, branchIndex: 0 },
        {
          id: 'm2',
          role: 'assistant',
          content: mixed,
          reasoning: `思考 ${literal} 结束`,
          createdAt: 2,
          branchIndex: 0,
          parentMessageId: 'm1'
        }
      ],
      topics: []
    }

    const parsed = parsePageFile(serializePageFile(document))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.messages).toEqual(document.messages)
  })

  it('未知或大小写异常的角色头不再丢弃消息', () => {
    const text = serializePageFile(buildDocument())
      .replace('## 1 User', '## 1 user')
      .replace('## 2 Assistant', '## 2 undefined')
      .replace('## 2:2 User', '## 2:2 Tool')

    const parsed = parsePageFile(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    expect(parsed.value.messages.map((message) => [message.id, message.role])).toEqual([
      ['m1', 'user'],
      ['m2', 'assistant'],
      ['m3', 'assistant']
    ])
    expect(parsed.value.messages[0].content).toContain('第一行')
    expect(parsed.value.messages[1].reasoning).toContain('</details>')
  })

  it('非 Pointer 文件与高版本文件被拒绝', () => {
    expect(parsePageFile('# 普通 Markdown').ok).toBe(false)
    expect(parsePageMetadata('# 普通 Markdown').ok).toBe(false)

    const future = serializePageFile(buildDocument()).replace('version="2"', 'version="99"')
    const parsed = parsePageMetadata(future)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toBe('unsupported-version:99')
  })

  it('空会话页面也能往返', () => {
    const document: PageFileDocument = {
      version: PAGE_FILE_FORMAT_VERSION,
      page: { id: 'p', kind: 'page', name: '空页面', order: 0, createdAt: 1 },
      messages: [],
      topics: []
    }

    const parsed = parsePageFile(serializePageFile(document))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.messages).toEqual([])
    expect(parsed.value.page.name).toBe('空页面')
  })
})
