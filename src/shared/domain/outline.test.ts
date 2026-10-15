import { describe, expect, it } from 'vitest'
import type { ChatMessage } from './chat'
import type { TopicGroup } from './messageTree'
import { computeOutline } from './outline'

function message(id: string, content = id, title?: string): ChatMessage {
  return { id, role: 'user', content, createdAt: 1, branchIndex: 0, title }
}

function group(patch: Partial<TopicGroup> = {}): TopicGroup {
  return {
    topicId: 't1',
    name: '第一段',
    startMessageId: 'm1',
    endMessageId: 'm2',
    messageIds: ['m1', 'm2'],
    collapsed: false,
    ...patch
  }
}

describe('会话大纲', () => {
  it('空路径返回空', () => {
    expect(computeOutline([], [])).toEqual([])
  })

  it('Topic 作为顶级节点，其下挂载消息', () => {
    const path = [message('m1'), message('m2', '内容二', '标题二'), message('m3')]

    const outline = computeOutline([group()], path)

    expect(outline.map((node) => node.type)).toEqual(['topic', 'untitled'])
    expect(outline[0].children?.map((node) => [node.messageId, node.type])).toEqual([
      ['m1', 'untitled'],
      ['m2', 'title']
    ])
  })

  it('不在任何 Topic 内的消息直挂顶层，start 不在路径上的 Topic 被跳过', () => {
    const path = [message('m1'), message('m2')]
    const ghost = group({
      topicId: 't-ghost',
      startMessageId: 'ghost',
      endMessageId: 'ghost',
      messageIds: ['ghost']
    })

    const outline = computeOutline([ghost], path)

    expect(outline.map((node) => node.type)).toEqual(['untitled', 'untitled'])
  })

  it('带标题的消息在顶层直接使用标题', () => {
    const outline = computeOutline([], [message('m1', '内容', '标题一')])

    expect(outline).toEqual([
      { id: 'title-m1', title: '标题一', type: 'title', messageId: 'm1', role: 'user' }
    ])
  })
})
