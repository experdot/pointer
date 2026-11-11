import { describe, expect, it } from 'vitest'
import { parsePageFile, serializePageFile, validateConversation } from '../../src/shared/domain'
import { treeDocument } from '../helpers/trees'

describe('页面文件规模与固定种子性质测试', () => {
  it.each(['deep', 'wide', 'random'] as const)('20000 条 %s 消息完整往返', (shape) => {
    const original = treeDocument(20000, 20261111, shape)
    const text = serializePageFile(original)
    const parsed = parsePageFile(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.error)
    const byId = new Map(parsed.value.messages.map((message) => [message.id, message]))
    expect(byId.size).toBe(original.messages.length)
    for (const message of original.messages) expect(byId.get(message.id)).toMatchObject(message)
    expect(parsed.value.topics).toEqual(original.topics)
    expect(parsed.value.leafMessageId).toBe(original.leafMessageId)
    expect(serializePageFile(parsed.value)).toBe(text)
  })

  it.each(Array.from({ length: 20 }, (_, seed) => seed + 1))(
    'seed=%i：随机合法树往返保持引用和不变量',
    (seed) => {
      const original = treeDocument(300, seed)
      const parsed = parsePageFile(serializePageFile(original))
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) throw new Error(parsed.error)
      expect(validateConversation({ pageId: original.page.id, ...parsed.value })).toEqual([])
      expect(new Set(parsed.value.messages.map((message) => message.id))).toEqual(
        new Set(original.messages.map((message) => message.id))
      )
      expect(parsed.value.selectedMessageId).toBe(original.selectedMessageId)
    }
  )
})
