import { describe, expect, it } from 'vitest'
import { parsePageFile, serializePageFile, type PageFileDocument } from './pageFile'
import type { ChatMessage } from './chat'

function document(messages: ChatMessage[]): PageFileDocument {
  return {
    version: 2,
    page: { id: 'page', kind: 'page', name: '边界', order: 0, createdAt: 1 },
    messages,
    topics: [],
    leafMessageId: messages.at(-1)?.id
  }
}

describe('页面文件规模与损坏边界', () => {
  it('6000 层父链序列化不依赖调用栈深度，往返保持所有消息', () => {
    const messages: ChatMessage[] = Array.from({ length: 6000 }, (_, index) => ({
      id: `m-${index}`,
      role: index % 2 ? 'assistant' : 'user',
      content: `第 ${index} 条😀`,
      branchIndex: 0,
      createdAt: index + 1,
      parentMessageId: index ? `m-${index - 1}` : undefined
    }))
    const parsed = parsePageFile(serializePageFile(document(messages)))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.value.messages).toEqual(messages)
    expect(parsed.value.leafMessageId).toBe('m-5999')
  })

  it('环和孤立消息也被保存，避免错误输入造成静默丢失', () => {
    const messages: ChatMessage[] = [
      { id: 'a', parentMessageId: 'b', role: 'user', branchIndex: 0, content: 'A', createdAt: 1 },
      {
        id: 'b',
        parentMessageId: 'a',
        role: 'assistant',
        branchIndex: 0,
        content: 'B',
        createdAt: 2
      },
      {
        id: 'c',
        parentMessageId: 'missing',
        role: 'user',
        branchIndex: 0,
        content: 'C',
        createdAt: 3
      }
    ]
    const parsed = parsePageFile(serializePageFile(document(messages)))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.value.messages).toEqual(messages)
  })
})
