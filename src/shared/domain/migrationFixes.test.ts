import { describe, expect, it } from 'vitest'
import type { ChatMessage, Conversation } from './chat'
import { emptyConversation } from './chat'
import {
  buildIndex,
  deleteMessage,
  firstLeafOf,
  switchBranchToMessage,
  updateMessages
} from './messageTree'
import { isNewerVersion } from './version'

function message(id: string, parentMessageId?: string, branchIndex = 0): ChatMessage {
  return { id, role: 'user', content: id, createdAt: 1, branchIndex, parentMessageId }
}

/** root -> a -> a1，root -> b -> b1 */
function fixture(): Conversation {
  let conversation = emptyConversation('page-1')
  conversation = {
    ...conversation,
    messages: [
      message('root'),
      message('a', 'root'),
      message('a1', 'a'),
      message('b', 'root', 1),
      message('b1', 'b')
    ],
    leafMessageId: 'a1'
  }
  return conversation
}

describe('分支切换（迁移前语义）', () => {
  it('切到某条消息时 leaf 指向该分支最深的叶子，并记录选中消息', () => {
    const after = switchBranchToMessage(fixture(), 'b', 10)
    expect(after.leafMessageId).toBe('b1')
    expect(after.selectedMessageId).toBe('b')
  })

  it('firstLeafOf 沿第一个子节点前进', () => {
    const index = buildIndex(fixture().messages)
    expect(firstLeafOf(index, 'a')).toBe('a1')
    expect(firstLeafOf(index, 'root')).toBe('a1')
    expect(firstLeafOf(index, 'b1')).toBe('b1')
  })
})

describe('删除消息后的落点（迁移前语义）', () => {
  it('回退到前一个兄弟分支的叶子', () => {
    const after = deleteMessage({ ...fixture(), leafMessageId: 'b1' }, 'b', 20)
    // b 被删除后，前一个兄弟是 a 分支，叶子为 a1
    expect(after.leafMessageId).toBe('a1')
    expect(after.messages.map((item) => item.id)).toEqual(['root', 'a', 'a1'])
  })

  it('没有前一个兄弟时选剩余的第一个兄弟', () => {
    const after = deleteMessage({ ...fixture(), leafMessageId: 'a1' }, 'a', 20)
    expect(after.leafMessageId).toBe('b1')
  })

  it('没有其它兄弟时回退到父消息', () => {
    const conversation: Conversation = {
      ...emptyConversation('page-1'),
      messages: [message('root'), message('only', 'root')],
      leafMessageId: 'only'
    }
    const after = deleteMessage(conversation, 'only', 20)
    expect(after.leafMessageId).toBe('root')
  })

  it('叶子未被删除时保持不动', () => {
    const after = deleteMessage(fixture(), 'root', 20)
    expect(after.messages).toEqual([])
    expect(after.leafMessageId).toBeUndefined()
  })
})

describe('批量消息补丁', () => {
  it('一次作用于多条消息', () => {
    const after = updateMessages(fixture(), ['a', 'b'], { collapsed: true }, 30)
    expect(after.messages.filter((item) => item.collapsed).map((item) => item.id)).toEqual([
      'a',
      'b'
    ])
  })

  it('没有命中时返回原对象', () => {
    const conversation = fixture()
    expect(updateMessages(conversation, [], { collapsed: true }, 30)).toBe(conversation)
  })
})

describe('版本比较', () => {
  it('正式版与预发布的优先级', () => {
    expect(isNewerVersion('2.0.0', '2.0.0-preview.9')).toBe(true)
    expect(isNewerVersion('2.0.0-preview.9', '2.0.0')).toBe(false)
  })

  it('预发布序号按数值比较', () => {
    expect(isNewerVersion('2.0.0-preview.10', '2.0.0-preview.9')).toBe(true)
    expect(isNewerVersion('2.0.0-preview.9', '2.0.0-preview.10')).toBe(false)
  })

  it('低版本不视为可升级（本地 bug 场景）', () => {
    expect(isNewerVersion('1.0.0-preview.24', '2.0.0-preview.1')).toBe(false)
    expect(isNewerVersion('2.0.0-preview.1', '1.0.0-preview.24')).toBe(true)
    expect(isNewerVersion('2.0.0-preview.1', '2.0.0-preview.1')).toBe(false)
  })

  it('无法解析时视为不可升级', () => {
    expect(isNewerVersion('not-a-version', '2.0.0')).toBe(false)
  })
})
