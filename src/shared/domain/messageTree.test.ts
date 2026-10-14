import { describe, expect, it } from 'vitest'
import type { ChatMessage, Conversation, MessageDraft } from './chat'
import { emptyConversation } from './chat'
import {
  appendMessage,
  buildIndex,
  computeTopicGroups,
  createTopic,
  currentPath,
  deleteMessage,
  deleteTopic,
  filterByTopicCollapse,
  isDescendantOf,
  nextBranchIndex,
  normalizeSiblingIndexes,
  pathToMessage,
  resolveLeafId,
  setLeaf,
  subtreeIds,
  updateMessage,
  updateTopic,
  validateConversation
} from './messageTree'
import { computeOutline } from './outline'

function draft(id: string, parentMessageId?: string, content = `content-${id}`): MessageDraft {
  return { id, role: 'user', content, parentMessageId }
}

/** 构建 root -> (a -> a1) 与 root -> b 的树 */
function fixture(): Conversation {
  let conversation = emptyConversation('page-1')
  conversation = appendMessage(conversation, draft('root'), 1).conversation
  conversation = appendMessage(conversation, draft('a', 'root'), 2).conversation
  conversation = appendMessage(conversation, draft('a1', 'a'), 3).conversation
  conversation = appendMessage(conversation, draft('b', 'root'), 4).conversation
  return conversation
}

describe('消息树索引与路径', () => {
  it('同级分支序号递增，路径按父链回溯', () => {
    const conversation = fixture()
    const index = buildIndex(conversation.messages)

    expect(conversation.messages.map((message) => [message.id, message.branchIndex])).toEqual([
      ['root', 0],
      ['a', 0],
      ['a1', 0],
      ['b', 1]
    ])
    expect(nextBranchIndex(index, 'root')).toBe(2)
    expect(pathToMessage(index, 'a1').map((message) => message.id)).toEqual(['root', 'a', 'a1'])
  })

  it('追加消息后新消息成为当前路径终点', () => {
    const conversation = fixture()
    expect(conversation.leafMessageId).toBe('b')
    expect(currentPath(conversation).map((message) => message.id)).toEqual(['root', 'b'])
  })

  it('leaf 失效时沿分支序号最大的子节点回落', () => {
    const conversation = { ...fixture(), leafMessageId: 'missing' }
    expect(currentPath(conversation).map((message) => message.id)).toEqual(['root', 'b'])
  })

  it('可切换到另一条分支', () => {
    const conversation = setLeaf(fixture(), 'a1', 10)
    expect(currentPath(conversation).map((message) => message.id)).toEqual(['root', 'a', 'a1'])
  })

  it('识别祖先关系与子树范围', () => {
    const index = buildIndex(fixture().messages)
    expect(isDescendantOf(index, 'root', 'a1')).toBe(true)
    expect(isDescendantOf(index, 'a', 'b')).toBe(false)
    expect(subtreeIds(index, 'a').sort()).toEqual(['a', 'a1'])
  })
})

describe('消息树校验', () => {
  it('合法会话无诊断', () => {
    expect(validateConversation(fixture())).toEqual([])
  })

  it('捕获重复分支序号、缺失父节点与无效 leaf', () => {
    const conversation = fixture()
    const broken: Conversation = {
      ...conversation,
      leafMessageId: 'ghost',
      messages: [
        ...conversation.messages,
        {
          id: 'dup',
          role: 'user',
          content: 'x',
          createdAt: 5,
          branchIndex: 1,
          parentMessageId: 'root'
        }
      ]
    }

    const codes = validateConversation(broken).map((diagnostic) => diagnostic.code)
    expect(codes).toContain('chat.branch-index-conflict')
    expect(codes).toContain('chat.leaf-not-found')

    const orphan: Conversation = {
      ...emptyConversation('p'),
      messages: [
        {
          id: 'child',
          role: 'user',
          content: 'x',
          createdAt: 1,
          branchIndex: 0,
          parentMessageId: 'nope'
        }
      ]
    }
    expect(validateConversation(orphan).map((d) => d.code)).toContain('chat.missing-parent')
  })
})

describe('消息树变更', () => {
  it('删除消息会级联删除子树并回落 leaf', () => {
    const conversation = setLeaf(fixture(), 'a1', 10)
    const after = deleteMessage(conversation, 'a', 11)

    expect(after.messages.map((message) => message.id)).toEqual(['root', 'b'])
    // 迁移前语义：回退到剩余的第一个兄弟分支（b）
    expect(after.leafMessageId).toBe('b')
  })

  it('删除 Topic 区间内的消息时清理边界', () => {
    let conversation = fixture()
    conversation = createTopic(conversation, {
      id: 't1',
      name: '片段',
      startMessageId: 'root',
      endMessageId: 'a1'
    })

    const after = deleteMessage(conversation, 'a1', 12)
    expect(after.topics[0].endMessageId).toBeUndefined()

    const removedStart = deleteMessage(conversation, 'root', 13)
    expect(removedStart.topics).toEqual([])
  })

  it('归一化分支序号可消除空洞', () => {
    let conversation = fixture()
    conversation = appendMessage(conversation, draft('b1', 'root'), 5).conversation
    conversation = deleteMessage(conversation, 'b', 6)

    const normalized = normalizeSiblingIndexes(conversation, 7)
    expect(normalized.messages.find((m) => m.id === 'a')?.branchIndex).toBe(0)
    expect(normalized.messages.find((m) => m.id === 'b1')?.branchIndex).toBe(1)
  })

  it('更新消息不修改原对象', () => {
    const conversation = fixture()
    const after = updateMessage(conversation, 'a1', { content: 'new' }, 20)

    expect(after.messages.find((m) => m.id === 'a1')?.content).toBe('new')
    expect(conversation.messages.find((m) => m.id === 'a1')?.content).toBe('content-a1')
  })
})

describe('Topic 分组与大纲', () => {
  function pathConversation(): Conversation {
    let conversation = emptyConversation('page-2')
    const ids = ['m1', 'm2', 'm3', 'm4']
    ids.forEach((id, position) => {
      conversation = appendMessage(
        conversation,
        draft(id, position === 0 ? undefined : ids[position - 1]),
        position + 1
      ).conversation
    })
    return conversation
  }

  it('区间未指定结束消息时以下一个 Topic 为界', () => {
    let conversation = pathConversation()
    conversation = createTopic(conversation, { id: 't1', name: '第一段', startMessageId: 'm1' })
    conversation = createTopic(conversation, { id: 't2', name: '第二段', startMessageId: 'm3' })

    const groups = computeTopicGroups(conversation.topics, currentPath(conversation))

    expect(groups.map((group) => group.messageIds)).toEqual([
      ['m1', 'm2'],
      ['m3', 'm4']
    ])
    expect(groups[0].endMessageId).toBe('m2')
  })

  it('显式结束消息会覆盖默认边界', () => {
    let conversation = pathConversation()
    conversation = createTopic(conversation, {
      id: 't1',
      name: '第一段',
      startMessageId: 'm1',
      endMessageId: 'm2'
    })

    const groups = computeTopicGroups(conversation.topics, currentPath(conversation))
    expect(groups[0].messageIds).toEqual(['m1', 'm2'])
  })

  it('结束消息不在起始消息路径上时拒绝设置', () => {
    const conversation = fixture()
    const after = createTopic(conversation, {
      id: 't1',
      name: '非法',
      startMessageId: 'a1',
      endMessageId: 'b'
    })
    expect(after.topics).toEqual([])
  })

  it('折叠的 Topic 只保留首条消息', () => {
    let conversation = pathConversation()
    conversation = createTopic(conversation, { id: 't1', name: '第一段', startMessageId: 'm1' })
    conversation = updateTopic(conversation, 't1', { collapsed: true }, 10)

    const path = currentPath(conversation)
    const groups = computeTopicGroups(conversation.topics, path)
    expect(filterByTopicCollapse(path, groups).map((message) => message.id)).toEqual(['m1'])
  })

  it('删除 Topic 后不再出现在分组中', () => {
    let conversation = pathConversation()
    conversation = createTopic(conversation, { id: 't1', name: '第一段', startMessageId: 'm1' })
    conversation = deleteTopic(conversation, 't1')
    expect(computeTopicGroups(conversation.topics, currentPath(conversation))).toEqual([])
  })

  it('大纲把 Topic 作为顶级节点，其下挂载消息', () => {
    let conversation = pathConversation()
    conversation = createTopic(conversation, {
      id: 't1',
      name: '第一段',
      startMessageId: 'm1',
      endMessageId: 'm2'
    })
    conversation = updateMessage(conversation, 'm2', { title: '有标题' }, 11)

    const path = currentPath(conversation)
    const outline = computeOutline(computeTopicGroups(conversation.topics, path), path)

    expect(outline[0].type).toBe('topic')
    expect(outline[0].children?.map((node) => node.type)).toEqual(['untitled', 'title'])
    expect(outline.slice(1).map((node) => node.type)).toEqual(['untitled', 'untitled'])
  })
})

describe('并发场景下的确定性', () => {
  it('相同输入产生相同索引顺序', () => {
    const messages: ChatMessage[] = [
      { id: 'x2', role: 'user', content: '', createdAt: 2, branchIndex: 1 },
      { id: 'x1', role: 'user', content: '', createdAt: 1, branchIndex: 0 }
    ]
    expect(
      buildIndex(messages)
        .childrenByParent.get(undefined)
        ?.map((m) => m.id)
    ).toEqual(['x1', 'x2'])
  })

  it('resolveLeafId 在空会话上返回 undefined', () => {
    expect(resolveLeafId(buildIndex([]))).toBeUndefined()
  })
})
