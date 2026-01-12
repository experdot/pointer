import { useEffect, useState, useMemo } from 'react'
import { Select, Checkbox, Empty, Spin } from 'antd'
import { FolderOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons'
import { useMessagesStore } from '../../../../stores/messagesStore'
import type {
  SourceSelectorProps,
  MessagesSourceData,
  MessageSelectionMode
} from '../../../../features/export/types'
import type { ChatMessage, Topic } from '../../../../types/type'
import type { CheckboxChangeEvent } from 'antd/es/checkbox'

interface MessageGroup {
  topic?: Topic
  messages: ChatMessage[]
}

interface MessagesSourceSelectorProps extends SourceSelectorProps<MessagesSourceData> {
  pageId?: string
}

// Selection mode options for Select
const SELECTION_MODE_OPTIONS = [
  { value: 'current-branch', label: '当前分支' },
  { value: 'all-branches', label: '所有分支' },
  { value: 'free-select', label: '自由选择' },
  { value: 'topic-messages', label: 'Topic 消息' }
]

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

  // Get current branch messages
  const branchMessages = useMemo(() => {
    const branchIds = getCurrentBranchIds(messages, leafMessageId)
    return branchIds.map((id) => messages.find((m) => m.id === id)).filter((m): m is ChatMessage => !!m)
  }, [messages, leafMessageId])

  // Group messages by topic
  const groupedMessages = useMemo((): MessageGroup[] => {
    const groups: MessageGroup[] = []
    let currentGroup: MessageGroup = { messages: [] }

    for (const msg of branchMessages) {
      const startingTopic = topics.find((t) => t.startMessageId === msg.id)

      if (startingTopic) {
        if (currentGroup.messages.length > 0) {
          groups.push(currentGroup)
        }
        currentGroup = { topic: startingTopic, messages: [msg] }
      } else {
        currentGroup.messages.push(msg)
      }

      const endingTopic = topics.find((t) => t.endMessageId === msg.id)
      if (endingTopic && currentGroup.topic?.id === endingTopic.id) {
        groups.push(currentGroup)
        currentGroup = { messages: [] }
      }
    }

    if (currentGroup.messages.length > 0) {
      groups.push(currentGroup)
    }

    return groups
  }, [branchMessages, topics])

  // Selection mode options based on whether topics exist
  const selectionModeOptions = useMemo(() => {
    if (topics.length > 0) {
      return SELECTION_MODE_OPTIONS
    }
    return SELECTION_MODE_OPTIONS.filter((opt) => opt.value !== 'topic-messages')
  }, [topics.length])

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
        // Initialize with current branch
        newSelectedIds = getCurrentBranchIds(messages, leafMessageId)
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

  // Handle select all checkbox
  const handleSelectAll = (e: CheckboxChangeEvent): void => {
    if (!pageId) return
    const newSelectedIds = e.target.checked ? branchMessages.map((m) => m.id) : []
    onChange({
      type: 'messages',
      pageId,
      selectionMode: 'free-select',
      selectedMessageIds: newSelectedIds
    })
  }

  // Handle single item checkbox
  const handleItemCheck = (messageId: string, checked: boolean): void => {
    if (!pageId) return
    const newSelectedIds = checked
      ? [...selectedMessageIds, messageId]
      : selectedMessageIds.filter((id) => id !== messageId)
    onChange({
      type: 'messages',
      pageId,
      selectionMode: 'free-select',
      selectedMessageIds: newSelectedIds
    })
  }

  // Handle topic group select all
  const handleTopicSelectAll = (group: MessageGroup, checked: boolean): void => {
    if (!pageId) return
    const groupIds = group.messages.map((m) => m.id)
    const newSelectedIds = checked
      ? [...new Set([...selectedMessageIds, ...groupIds])]
      : selectedMessageIds.filter((id) => !groupIds.includes(id))
    onChange({
      type: 'messages',
      pageId,
      selectionMode: 'free-select',
      selectedMessageIds: newSelectedIds
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
    return <Empty description="请先打开一个聊天页面" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
        <Spin />
      </div>
    )
  }

  if (messages.length === 0) {
    return <Empty description="没有消息可导出" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }

  return (
    <div>
      {/* Selection mode */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 13 }}>选择模式</div>
        <Select
          value={selectionMode}
          onChange={(value) => handleModeChange(value as MessageSelectionMode)}
          options={selectionModeOptions}
          style={{ width: '100%' }}
        />
      </div>

      {/* Topic selector (for topic-messages mode) */}
      {selectionMode === 'topic-messages' && topics.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 13 }}>选择 Topic</div>
          <Select
            value={selectedTopicId}
            onChange={(value) => handleTopicSelect(value)}
            options={topics.map((topic) => ({
              value: topic.id,
              label: topic.name
            }))}
            placeholder="请选择 Topic"
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* Message list (for free-select mode) */}
      {selectionMode === 'free-select' && (
        <div className="free-select-list" style={{ marginBottom: 16 }}>
          <div className="free-select-list__header">
            <Checkbox
              indeterminate={
                selectedMessageIds.length > 0 && selectedMessageIds.length < branchMessages.length
              }
              checked={selectedMessageIds.length === branchMessages.length && branchMessages.length > 0}
              onChange={handleSelectAll}
            >
              全选 ({selectedMessageIds.length}/{branchMessages.length})
            </Checkbox>
          </div>
          <div className="free-select-list__content">
            {groupedMessages.map((group, groupIndex) => (
              <div key={group.topic?.id || `group-${groupIndex}`} className="free-select-group">
                {group.topic && (
                  <div className="free-select-group__header">
                    <Checkbox
                      indeterminate={
                        group.messages.some((m) => selectedMessageIds.includes(m.id)) &&
                        !group.messages.every((m) => selectedMessageIds.includes(m.id))
                      }
                      checked={group.messages.every((m) => selectedMessageIds.includes(m.id))}
                      onChange={(e) => handleTopicSelectAll(group, e.target.checked)}
                    />
                    <FolderOutlined className="free-select-group__icon" />
                    <span className="free-select-group__name">{group.topic.name}</span>
                  </div>
                )}
                {group.messages.map((message) => {
                  const preview =
                    message.title ||
                    message.content.slice(0, 40) + (message.content.length > 40 ? '...' : '')
                  return (
                    <div
                      key={message.id}
                      className={`free-select-item ${group.topic ? 'free-select-item--indented' : ''}`}
                    >
                      <Checkbox
                        checked={selectedMessageIds.includes(message.id)}
                        onChange={(e) => handleItemCheck(message.id, e.target.checked)}
                      />
                      <span className="free-select-item__icon">
                        {message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                      </span>
                      <span className="free-select-item__text">{preview}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
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
