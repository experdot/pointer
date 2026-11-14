import { beforeEach, describe, expect, it, vi } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { defaultSettings, type Conversation } from '@shared/domain'
import { exportManager } from './ExportManager'
import { registerSourcePlugins, messagesSourcePlugin } from './plugins/sources'
import {
  registerFormatPlugins,
  htmlFormatPlugin,
  markdownFormatPlugin,
  csvFormatPlugin
} from './plugins/formats'
import {
  DEFAULT_EXPORT_OPTIONS,
  FORMAT_SUPPORT,
  type SourceData,
  type SourceType,
  type ExportOptions
} from './types'
import { useMessagesStore } from '../../stores/messagesStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { parseCsv } from './parseCsv'

const client = vi.hoisted(() => ({ query: vi.fn(), command: vi.fn() }))
vi.mock('../../runtime/client', () => client)
vi.mock('../../components/editors/ExportEditor/sources/MessagesSource', () => ({
  MessagesSourceSelector: () => null
}))

const conversation: Conversation = {
  pageId: 'p',
  leafMessageId: 'b',
  topics: [{ id: 'topic', name: '话题', startMessageId: 'b', collapsed: false }],
  messages: [
    { id: 'u', role: 'user', content: '中文🧪 $1', createdAt: 1, branchIndex: 0 },
    {
      id: 'a',
      role: 'assistant',
      parentMessageId: 'u',
      content: '另一个分支',
      createdAt: 2,
      branchIndex: 0
    },
    {
      id: 'b',
      role: 'assistant',
      parentMessageId: 'u',
      content: '当前分支',
      createdAt: 3,
      branchIndex: 1,
      title: '标题',
      reasoning: '思考',
      llmId: 'llm',
      modelConfigId: 'model'
    }
  ]
}
const sources = {
  messages: {
    type: 'messages',
    pageId: 'p',
    selectionMode: 'all-branches',
    selectedMessageIds: []
  },
  'text-snippet': { type: 'text-snippet', text: '中文🧪 $1 **literal**\nline' },
  'code-block': { type: 'code-block', code: '中文🧪 $1 **literal**\n```', language: 'sh' },
  'table-block': { type: 'table-block', markdown: '| A | B |\n|---|---|\n| 中文🧪 | $1 |' }
} satisfies Record<SourceType, SourceData>
const formats = {
  messages: ['markdown', 'txt', 'html'],
  'text-snippet': ['markdown', 'txt', 'html'],
  'code-block': ['markdown', 'txt', 'html'],
  'table-block': ['markdown', 'txt', 'html', 'csv']
} as const
const cases = Object.entries(formats).flatMap(([source, formats]) =>
  formats.map((format) => [source as SourceType, format] as const)
)

beforeEach(() => {
  registerSourcePlugins()
  registerFormatPlugins()
  useMessagesStore.getState().reset()
  useSettingsStore.getState().reset()
  client.query.mockReset().mockImplementation(async () => structuredClone(conversation))
})

describe('导出来源 × 格式的完整流程', () => {
  it('注册表与类型声明一致，明确覆盖全部 13 种组合', () => {
    expect(cases).toHaveLength(13)
    for (const [source, supported] of Object.entries(formats)) {
      expect(FORMAT_SUPPORT[source as SourceType]).toEqual([...supported])
      expect(
        exportManager.getSupportedFormats(source as SourceType).map((item) => item.id)
      ).toEqual([...supported])
    }
  })
  it.each(cases)('%s → %s 保留选中内容与输出类型', async (source, format) => {
    const result = await exportManager.generatePreview(source, sources[source], format, {
      ...DEFAULT_EXPORT_OPTIONS,
      format
    })
    expect(result.isBinary).toBe(false)
    expect(result.extension).toBe(format === 'markdown' ? 'md' : format)
    expect(result.mimeType).toMatch(/^text\//)
    expect(String(result.content)).toContain('中文🧪')
    if (source === 'text-snippet' && format !== 'html')
      expect(result.content).toBe(sources['text-snippet'].text)
    if (source === 'code-block') {
      if (format === 'txt') expect(result.content).toBe(sources['code-block'].code)
      else if (format === 'html')
        expect(html(String(result.content)).querySelector('code')?.textContent).toBe(
          sources['code-block'].code
        )
      else {
        const node = unified().use(remarkParse).parse(String(result.content)).children[0]
        expect(node.type).toBe('code')
        expect('value' in node && node.value).toBe(sources['code-block'].code)
      }
    }
    if (format === 'csv') expect(parseCsv(String(result.content)).rows).toEqual([['中文🧪', '$1']])
  })
  it.each(['text-snippet', 'messages', 'code-block'] as const)(
    '拒绝未支持的 %s → CSV',
    async (source) => {
      await expect(
        exportManager.generatePreview(source, sources[source], 'csv', DEFAULT_EXPORT_OPTIONS)
      ).rejects.toThrow()
    }
  )
})

describe('导出语义边界', () => {
  it('消息 HTML 的代码块/行内代码保持符号和换行，链接拒绝脚本协议', async () => {
    const code = '**literal**\n# heading\n<tag> $1'
    const result = await htmlFormatPlugin.convert(
      {
        contentType: 'messages',
        rawContent: '',
        messages: [
          {
            ...conversation.messages[0],
            content: `\`\`\`sh\n${code}\n\`\`\`\n\n\`**inline**\`\n\n[危险](javascript:alert%281%29)`
          }
        ]
      },
      DEFAULT_EXPORT_OPTIONS
    )
    const document = html(String(result.content))
    expect(document.querySelector('pre code')?.textContent).toBe(`${code}\n`)
    expect(document.querySelector('pre strong')).toBeNull()
    expect([...document.querySelectorAll('code')].at(-1)?.textContent).toBe('**inline**')
    expect(document.querySelector('a')?.getAttribute('href')).not.toMatch(/^javascript:/)
  })
  it('代码语言不能注入 HTML 属性', async () => {
    const result = await htmlFormatPlugin.convert(
      { contentType: 'code', rawContent: 'keep', language: 'x" onclick="alert(1)' },
      DEFAULT_EXPORT_OPTIONS
    )
    expect(html(String(result.content)).querySelector('[onclick]')).toBeNull()
  })
  it('代码内容包含围栏时自动选择更长的围栏，语言换行不改变文档结构', async () => {
    const code = '````\n$1'
    const result = await markdownFormatPlugin.convert(
      { contentType: 'code', rawContent: code, language: 'sh\n# injection' },
      DEFAULT_EXPORT_OPTIONS
    )
    const nodes = unified().use(remarkParse).parse(String(result.content)).children
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ type: 'code', value: code, lang: 'sh' })
  })
  it('CSV 对公式前缀添加文本保护，普通值与美元参数不改写', async () => {
    const result = await csvFormatPlugin.convert(
      {
        contentType: 'table',
        rawContent:
          '| A | B | C | D | E | F |\n|---|---|---|---|---|---|\n| =1+1 | +cmd | -2 | @sum(1) | $1 | 中文 |'
      },
      DEFAULT_EXPORT_OPTIONS
    )
    expect(parseCsv(String(result.content)).rows[0]).toEqual([
      "'=1+1",
      "'+cmd",
      "'-2",
      "'@sum(1)",
      '$1',
      '中文'
    ])
  })
  it.each([
    ['all-branches', undefined, [], ['u', 'a', 'b']],
    ['current-branch', undefined, [], ['u', 'b']],
    ['topic-messages', 'topic', [], ['b']],
    ['free-select', undefined, ['b', 'u'], ['u', 'b']]
  ] as const)(
    '选择 %s 只输出目标消息，按树顺序排列',
    async (selectionMode, topicId, ids, expected) => {
      const result = await messagesSourcePlugin.extract(
        { type: 'messages', pageId: 'p', selectionMode, topicId, selectedMessageIds: [...ids] },
        DEFAULT_EXPORT_OPTIONS
      )
      expect(result.messages?.map((message) => message.id)).toEqual([...expected])
    }
  )
  it('已删除的话题不能悄悄扩大为全会话导出', async () => {
    await expect(
      messagesSourcePlugin.extract(
        {
          type: 'messages',
          pageId: 'p',
          selectionMode: 'topic-messages',
          topicId: 'missing',
          selectedMessageIds: []
        },
        DEFAULT_EXPORT_OPTIONS
      )
    ).rejects.toThrow('话题')
  })
  it.each(['current-branch', 'free-select'] as const)(
    '%s 使用打开时的分支范围，正文取预览时的最新内容',
    async (selectionMode) => {
      useMessagesStore.getState().setConversation({
        ...conversation,
        leafMessageId: 'a',
        messages: conversation.messages.map((message) =>
          message.id === 'b' ? { ...message, content: '更新后的回答' } : message
        )
      })
      const result = await messagesSourcePlugin.extract(
        {
          type: 'messages',
          pageId: 'p',
          selectionMode,
          branchMessageIds: ['u', 'b'],
          selectedMessageIds: selectionMode === 'free-select' ? ['b'] : ['u', 'b']
        },
        DEFAULT_EXPORT_OPTIONS
      )
      expect(result.messages?.map((message) => message.id)).toEqual(
        selectionMode === 'free-select' ? ['b'] : ['u', 'b']
      )
      expect(result.rawContent).toContain('更新后的回答')
      expect(result.rawContent).not.toContain('另一个分支')
    }
  )
  it('自由选择的目录只包含选中消息所属范围，不泄露其他话题名称', async () => {
    const result = await messagesSourcePlugin.extract(
      { type: 'messages', pageId: 'p', selectionMode: 'free-select', selectedMessageIds: ['u'] },
      {
        ...DEFAULT_EXPORT_OPTIONS,
        metadata: { ...DEFAULT_EXPORT_OPTIONS.metadata, showTopicsOutline: true }
      }
    )
    expect(result.topics).toEqual([])
    expect(result.rawContent).not.toContain('话题')
  })
  it('六千层消息导出不递归溢出，损坏环也会终止且保留内容', async () => {
    const deep = Array.from({ length: 6000 }, (_, i) => ({
      ...conversation.messages[0],
      id: `m${i}`,
      parentMessageId: i ? `m${i - 1}` : undefined
    }))
    client.query.mockResolvedValueOnce({
      pageId: 'deep',
      messages: deep,
      topics: [],
      leafMessageId: 'm5999'
    })
    const result = await messagesSourcePlugin.extract(
      { type: 'messages', pageId: 'deep', selectionMode: 'all-branches', selectedMessageIds: [] },
      DEFAULT_EXPORT_OPTIONS
    )
    expect(result.messages?.map((message) => message.id)).toEqual(deep.map((message) => message.id))
    client.query.mockResolvedValueOnce({
      pageId: 'cycle',
      messages: [
        { ...conversation.messages[0], id: 'x', parentMessageId: 'y' },
        { ...conversation.messages[0], id: 'y', parentMessageId: 'x' }
      ],
      topics: [],
      leafMessageId: 'y'
    })
    const cyclic = await messagesSourcePlugin.extract(
      {
        type: 'messages',
        pageId: 'cycle',
        selectionMode: 'current-branch',
        selectedMessageIds: []
      },
      DEFAULT_EXPORT_OPTIONS
    )
    expect(cyclic.messages?.map((message) => message.id).sort()).toEqual(['x', 'y'])
  })
  it('配置名称、标题和推理信息按开关输出，HTML 文本始终转义', async () => {
    const settings = defaultSettings()
    settings.llmConfigs.items = [
      {
        id: 'llm',
        kind: 'item',
        name: 'LLM',
        baseUrl: 'test',
        apiKey: 'test-only',
        modelName: '<model>',
        order: 0,
        createdAt: 1
      }
    ]
    settings.modelConfigs.items = [
      {
        id: 'model',
        kind: 'item',
        name: '<config>',
        systemPrompt: '',
        temperature: 1,
        topP: 1,
        order: 0,
        createdAt: 1
      }
    ]
    useSettingsStore.getState().accept({ settings, revision: 1 })
    const options: ExportOptions = {
      format: 'html',
      metadata: {
        showTimestamp: false,
        showModelName: true,
        showModelConfig: true,
        showMessageTitle: true,
        showTopicsOutline: true,
        showReasoningContent: true
      }
    }
    const data = { ...sources.messages, selectionMode: 'current-branch' } as SourceData
    const result = await exportManager.generatePreview('messages', data, 'html', options)
    const document = html(String(result.content))
    expect(document.body.textContent).toContain('<model>')
    expect(document.body.textContent).toContain('<config>')
    expect(document.body.textContent).toContain('思考')
    expect(document.body.textContent).toContain('标题')
    expect(document.querySelector('nav')?.textContent).toContain('话题')
    expect(document.querySelector('model, config')).toBeNull()
  })
})

function html(content: string): Document {
  return new DOMParser().parseFromString(content, 'text/html')
}
