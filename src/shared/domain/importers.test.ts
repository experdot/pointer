import { describe, expect, it } from 'vitest'
import { detectFormat, parseImport } from './importers'
import { PAGE_FILE_FORMAT_VERSION, parsePageFile, serializePageFile } from './pageFile'
import { deepseekExport } from '../../../tests/fixtures/deepseek'

/** 导入缺少时间戳时使用的固定时钟 */
const NOW = 1_700_000_000_000

describe('导入格式检测', () => {
  it('识别三种导出格式', () => {
    expect(detectFormat([{ mapping: {}, current_node: 'a' }])).toBe('openai')
    expect(detectFormat([{ mapping: { root: {} } }])).toBe('deepseek')
    expect(detectFormat({ type: 'chats-only', pages: [] })).toBe('pointer')
    expect(detectFormat({ unrelated: true })).toBeNull()
  })
})

describe('ChatGPT 导出解析', () => {
  const payload = [
    {
      title: '架构讨论',
      conversation_id: 'c1',
      create_time: 1_700_000_000,
      mapping: {
        root: { id: 'root', parent: null, children: ['u1'], message: null },
        u1: {
          id: 'u1',
          parent: 'root',
          children: ['a1'],
          message: {
            id: 'u1',
            author: { role: 'user' },
            content: { parts: ['如何分层'] },
            create_time: 1_700_000_001
          }
        },
        hidden: {
          id: 'hidden',
          parent: 'u1',
          children: ['a1'],
          message: {
            id: 'hidden',
            author: { role: 'system' },
            content: { parts: [''] },
            create_time: 1_700_000_002
          }
        },
        a1: {
          id: 'a1',
          parent: 'hidden',
          children: [],
          message: {
            id: 'a1',
            author: { role: 'assistant' },
            content: { parts: ['分三层'] },
            create_time: 1_700_000_003,
            metadata: { model_slug: 'gpt-x' }
          }
        }
      },
      current_node: 'a1'
    }
  ]

  it('跳过空消息并把父节点重映射到最近的可见祖先', () => {
    const result = parseImport(payload, undefined, NOW)
    expect(result.format).toBe('openai')
    expect(result.conversations).toHaveLength(1)

    const conversation = result.conversations[0]
    expect(conversation.title).toBe('架构讨论')
    expect(conversation.createdAt).toBe(1_700_000_000_000)
    expect(conversation.messages.map((message) => message.id)).toEqual(['u1', 'a1'])
    expect(conversation.messages[1].parentMessageId).toBe('u1')
    expect(conversation.messages[1].llmId).toBe('gpt-x')
    expect(conversation.leafMessageId).toBe('a1')
  })
})

describe('DeepSeek 导出解析', () => {
  it('搜索片段没有正文时仍读取后续回答，并保留所有思考与回答片段', () => {
    const result = parseImport(
      deepseekExport([
        { type: 'SEARCH', results: [{ title: '搜索元数据' }] },
        { type: 'THINK', content: '先分析' },
        { type: 'TOOL_SEARCH', results: [] },
        { type: 'TOOL_OPEN', content: '工具元数据不作为回答' },
        { type: 'THINK', content: '再分析' },
        { type: 'RESPONSE', content: '第一段回答' },
        { type: 'RESPONSE', content: '第二段回答' }
      ]),
      undefined,
      NOW
    )

    expect(result.format).toBe('deepseek')
    expect(result.conversations[0].messages[1]).toMatchObject({
      id: '2',
      role: 'assistant',
      content: '第一段回答\n\n第二段回答',
      reasoning: '先分析\n\n再分析',
      parentMessageId: '1',
      llmId: 'deepseek-chat'
    })
    expect(result.conversations[0].leafMessageId).toBe('2')
  })

  it.each([
    {
      label: '附件位于提问前',
      fragments: [
        { type: 'FILE', files: [{ id: 'file-1' }] },
        { type: 'REQUEST', content: '分析附件' }
      ],
      role: 'user',
      content: '分析附件',
      reasoning: undefined
    },
    {
      label: '仅有附件',
      fragments: [{ type: 'FILE', files: [{ id: 'file-1' }] }],
      role: 'user',
      content: '',
      reasoning: undefined
    },
    {
      label: '只有思考尚无回答',
      fragments: [
        { type: 'SEARCH', results: [] },
        { type: 'THINK', content: '尚在思考' }
      ],
      role: 'assistant',
      content: '',
      reasoning: '尚在思考'
    },
    {
      label: '缺失、空值和非字符串正文',
      fragments: [
        null,
        { type: 'RESPONSE' },
        { type: 'RESPONSE', content: null },
        { type: 'RESPONSE', content: false },
        { type: 'THINK', content: {} }
      ],
      role: 'assistant',
      content: '',
      reasoning: undefined
    }
  ])('$label 时正文始终为字符串且消息身份保留', ({ fragments, role, content, reasoning }) => {
    const result = parseImport(deepseekExport(fragments), 'deepseek', NOW)
    expect(result.conversations[0].messages[1]).toMatchObject({
      id: '2',
      parentMessageId: '1',
      role,
      content,
      reasoning
    })
  })

  it('按 fragment 判定角色并建立父子关系', () => {
    const result = parseImport(
      [
        {
          id: 'd1',
          title: '翻译任务',
          inserted_at: '2024-01-01T00:00:00.000Z',
          mapping: {
            root: { id: 'root', parent: null, children: ['m1'], message: null },
            m1: {
              id: 'm1',
              parent: 'root',
              children: ['m2'],
              message: {
                model: 'deepseek-chat',
                inserted_at: '2024-01-01T00:00:01.000Z',
                fragments: [{ type: 'REQUEST', content: '翻译这段话' }]
              }
            },
            m2: {
              id: 'm2',
              parent: 'm1',
              children: [],
              message: {
                inserted_at: '2024-01-01T00:00:02.000Z',
                fragments: [{ type: 'RESPONSE', content: '好的' }]
              }
            }
          }
        }
      ],
      'deepseek',
      NOW
    )

    const conversation = result.conversations[0]
    expect(conversation.messages.map((message) => [message.id, message.role])).toEqual([
      ['m1', 'user'],
      ['m2', 'assistant']
    ])
    expect(conversation.messages[0].parentMessageId).toBeUndefined()
    expect(conversation.leafMessageId).toBe('m2')
  })
})

describe('Pointer 旧版导出解析', () => {
  it('由 children 推导父节点并保留分支序号', () => {
    const result = parseImport(
      {
        type: 'chats-only',
        pages: [
          {
            id: 'p1',
            title: '分支对话',
            createdAt: 100,
            messages: [
              { id: 'a', role: 'user', content: '问题', timestamp: 1, children: ['b', 'c'] },
              { id: 'b', role: 'assistant', content: '答案一', timestamp: 2 },
              { id: 'c', role: 'assistant', content: '答案二', timestamp: 3 }
            ],
            currentPath: ['a', 'c']
          }
        ]
      },
      'pointer',
      NOW
    )

    const conversation = result.conversations[0]
    expect(conversation.messages.map((message) => [message.id, message.branchIndex])).toEqual([
      ['a', 0],
      ['b', 0],
      ['c', 1]
    ])
    expect(conversation.leafMessageId).toBe('c')
  })
})

describe('未知角色归一', () => {
  const toolPayload = [
    {
      title: '工具对话',
      conversation_id: 'c-tool',
      create_time: 1_700_000_000,
      mapping: {
        root: { id: 'root', parent: null, children: ['t1', 't2'], message: null },
        t1: {
          id: 't1',
          parent: 'root',
          children: [],
          message: {
            id: 't1',
            author: { role: 'tool' },
            content: { parts: ['搜索结果'] },
            create_time: 1_700_000_001
          }
        },
        t2: {
          id: 't2',
          parent: 'root',
          children: [],
          message: {
            id: 't2',
            author: { role: 'tool' },
            content: { parts: [] },
            create_time: 1_700_000_002
          }
        }
      },
      current_node: 't1'
    }
  ]

  it('tool 按 assistant 保留，空 tool 消息跳过', () => {
    const result = parseImport(toolPayload, undefined, NOW)

    expect(result.conversations).toHaveLength(1)
    expect(result.conversations[0].messages.map((message) => [message.id, message.role])).toEqual([
      ['t1', 'assistant']
    ])
  })

  it('导入结果经页面文件往返后消息不丢失', () => {
    const conversation = parseImport(toolPayload, undefined, NOW).conversations[0]
    const text = serializePageFile({
      version: PAGE_FILE_FORMAT_VERSION,
      page: { id: 'page-tool', kind: 'page', name: '工具', order: 0, createdAt: 1 },
      messages: conversation.messages,
      topics: [],
      leafMessageId: conversation.leafMessageId
    })

    const parsed = parsePageFile(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.messages.map((message) => [message.id, message.role])).toEqual([
      ['t1', 'assistant']
    ])
    expect(parsed.value.messages[0].content).toBe('搜索结果')
  })

  it('children 成环的导出也能正常解析', () => {
    const payload = [
      {
        title: '环',
        id: 'c-cycle',
        inserted_at: '2024-01-01T00:00:00.000Z',
        mapping: {
          r: {
            id: 'r',
            parent: null,
            children: ['c1'],
            message: {
              inserted_at: '2024-01-01T00:00:01.000Z',
              fragments: [{ type: 'REQUEST', content: 'r' }]
            }
          },
          c1: {
            id: 'c1',
            parent: 'r',
            children: ['c2'],
            message: {
              inserted_at: '2024-01-01T00:00:02.000Z',
              fragments: [{ type: 'RESPONSE', content: 'c1' }]
            }
          },
          c2: {
            id: 'c2',
            parent: 'c1',
            children: ['c1'],
            message: {
              inserted_at: '2024-01-01T00:00:03.000Z',
              fragments: [{ type: 'REQUEST', content: 'c2' }]
            }
          }
        }
      }
    ]

    const result = parseImport(payload, undefined, NOW)
    const conversation = result.conversations[0]
    expect(conversation.messages).toHaveLength(3)
    expect(['c1', 'c2']).toContain(conversation.leafMessageId)
  })
})
