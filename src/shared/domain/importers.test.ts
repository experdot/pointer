import { describe, expect, it } from 'vitest'
import { detectFormat, parseImport } from './importers'

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
    const result = parseImport(payload)
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
      'deepseek'
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
      'pointer'
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
