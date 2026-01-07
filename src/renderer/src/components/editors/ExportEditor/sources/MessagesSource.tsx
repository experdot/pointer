import { useEffect, useState, useMemo } from 'react'
import { Radio, Tree, Empty, Spin } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { useMessagesStore } from '../../../../stores/messagesStore'
import type {
  SourceSelectorProps,
  MessagesSourceData,
  MessageSelectionMode
} from '../../../../features/export/types'
import type { ChatMessage, Topic } from '../../../../types/type'

interface MessagesSourceSelectorProps extends SourceSelectorProps<MessagesSourceData> {
  pageId?: string
}

/**
 * MessagesSourceSelector - Component for selecting messages to export
 *
 * Features:
 * - Selection mode radio buttons
 * - Message tree with checkboxes (for free-select mode)
 * - Topic selector (for topic-messages mode)
 */
export function MessagesSourceSelector({
  data,
  onChange,
  pageId
}: MessagesSourceSelectorProps): React.JSX.Element {
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [leafMessageId, setLeafMessageId] = useState<string | undefined>()

  const load = useMessagesStore((state) => state.load)

  // Selection mode
  const selectionMode = data?.selectionMode ?? 'current-branch'
  const selectedMessageIds = data?.selectedMessageIds ?? []
  const selectedTopicId = data?.topicId

  // Load messages when pageId changes
  useEffect(() => {
    if (!pageId) return

    setLoading(true)
    load(pageId)
      .then((record) => {
        setMessages(record.messages)
        setTopics(record.topics ?? [])
        setLeafMessageId(record.leafMessageId)

        // Initialize selection if not set
        if (!data) {
          const currentBranchIds = getCurrentBranchIds(record.messages, record.leafMessageId)
          onChange({
            type: 'messages',
            pageId,
            selectionMode: 'current-branch',
            selectedMessageIds: currentBranchIds
          })
        }
      })
      .finally(() => setLoading(false))
  }, [pageId, load])

  // Build tree data for the message tree
  const treeData = useMemo(() => {
    return buildMessageTree(messages)
  }, [messages])

  // Handle selection mode change
  const handleModeChange = (mode: MessageSelectionMode): void => {
    if (!pageId) return

    let newSelectedIds: string[] = []

    switch (mode) {
      case 'all-branches':
        newSelectedIds = messages.map((m) => m.id)
        break
      case 'current-branch':
        newSelectedIds = getCurrentBranchIds(messages, leafMessageId)
        break
      case 'topic-messages':
        // Keep current selection until topic is selected
        newSelectedIds = []
        break
      case 'free-select':
        // Keep current selection
        newSelectedIds = selectedMessageIds
        break
    }

    onChange({
      type: 'messages',
      pageId,
      selectionMode: mode,
      selectedMessageIds: newSelectedIds,
      topicId: mode === 'topic-messages' ? selectedTopicId : undefined
    })
  }

  // Handle tree checkbox change
  const handleTreeCheck = (checkedKeys: React.Key[]): void => {
    if (!pageId) return

    onChange({
      type: 'messages',
      pageId,
      selectionMode: 'free-select',
      selectedMessageIds: checkedKeys as string[]
    })
  }

  // Handle topic selection
  const handleTopicSelect = (topicId: string): void => {
    if (!pageId) return

    const topic = topics.find((t) => t.id === topicId)
    if (!topic) return

    // Get messages within topic
    const topicMessageIds = getTopicMessageIds(messages, topic.startMessageId, topic.endMessageId)

    onChange({
      type: 'messages',
      pageId,
      selectionMode: 'topic-messages',
      selectedMessageIds: topicMessageIds,
      topicId
    })
  }

  if (!pageId) {
    return (
      <Empty
        description="请先打开一个聊天页面"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
        <Spin />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <Empty
        description="没有消息可导出"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    )
  }

  return (
    <div>
      {/* Selection mode */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 13 }}>选择模式</div>
        <Radio.Group
          value={selectionMode}
          onChange={(e) => handleModeChange(e.target.value)}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <Radio value="current-branch">当前分支</Radio>
          <Radio value="all-branches">所有分支</Radio>
          <Radio value="topic-messages" disabled={topics.length === 0}>
            Topic 消息
          </Radio>
          <Radio value="free-select">自由选择</Radio>
        </Radio.Group>
      </div>

      {/* Topic selector (for topic-messages mode) */}
      {selectionMode === 'topic-messages' && topics.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 13 }}>选择 Topic</div>
          <Radio.Group
            value={selectedTopicId}
            onChange={(e) => handleTopicSelect(e.target.value)}
            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            {topics.map((topic) => (
              <Radio key={topic.id} value={topic.id}>
                {topic.name}
              </Radio>
            ))}
          </Radio.Group>
        </div>
      )}

      {/* Message tree (for free-select mode) */}
      {selectionMode === 'free-select' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 13 }}>
            选择消息 ({selectedMessageIds.length}/{messages.length})
          </div>
          <Tree
            checkable
            selectable={false}
            checkedKeys={selectedMessageIds}
            onCheck={(checked) => handleTreeCheck(checked as React.Key[])}
            treeData={treeData}
            height={300}
            style={{ background: 'var(--ant-color-bg-container)' }}
          />
        </div>
      )}

      {/* Selection summary */}
      <div
        style={{
          padding: 12,
          background: 'var(--ant-color-bg-layout)',
          borderRadius: 6,
          fontSize: 13
        }}
      >
        已选择 <strong>{selectedMessageIds.length}</strong> 条消息
      </div>
    </div>
  )
}

/**
 * Get message IDs in the current branch (from root to leaf)
 */
function getCurrentBranchIds(messages: ChatMessage[], leafMessageId?: string): string[] {
  if (!leafMessageId) return []

  const messageMap = new Map(messages.map((m) => [m.id, m]))
  const path: string[] = []

  let currentId: string | undefined = leafMessageId
  while (currentId) {
    path.unshift(currentId)
    const message = messageMap.get(currentId)
    currentId = message?.parentMessageId
  }

  return path
}

/**
 * Get message IDs within a topic range
 */
function getTopicMessageIds(
  messages: ChatMessage[],
  startMessageId: string,
  endMessageId?: string
): string[] {
  const messageMap = new Map(messages.map((m) => [m.id, m]))
  const result: string[] = []
  const visited = new Set<string>()

  function collectDescendants(id: string): void {
    if (visited.has(id)) return
    visited.add(id)

    const msg = messageMap.get(id)
    if (msg) {
      result.push(id)

      if (endMessageId && id === endMessageId) return

      for (const m of messages) {
        if (m.parentMessageId === id) {
          collectDescendants(m.id)
        }
      }
    }
  }

  collectDescendants(startMessageId)
  return result
}

/**
 * Build tree data for Ant Design Tree component
 */
function buildMessageTree(messages: ChatMessage[]): DataNode[] {
  const childrenMap = new Map<string | undefined, ChatMessage[]>()

  // Group messages by parent
  for (const message of messages) {
    const parentId = message.parentMessageId
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(message)
  }

  // Sort children by branchIndex
  for (const children of childrenMap.values()) {
    children.sort((a, b) => (a.branchIndex ?? 0) - (b.branchIndex ?? 0))
  }

  // Build tree recursively
  function buildNode(message: ChatMessage): DataNode {
    const children = childrenMap.get(message.id) ?? []
    const roleLabel = message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : '⚙️'
    const preview = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')

    return {
      key: message.id,
      title: `${roleLabel} ${message.title || preview}`,
      children: children.length > 0 ? children.map(buildNode) : undefined
    }
  }

  // Start from root messages (no parent)
  const roots = childrenMap.get(undefined) ?? []
  return roots.map(buildNode)
}
