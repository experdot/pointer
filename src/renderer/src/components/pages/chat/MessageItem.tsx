import React, { useState, useEffect, useRef } from 'react'
import { Avatar, Card, Typography, Button, Space, Input, Tooltip, Select, Collapse, Dropdown, Menu } from 'antd'
import {
  UserOutlined,
  RobotOutlined,
  RedoOutlined,
  EditOutlined,
  CopyOutlined,
  CheckOutlined,
  CloseOutlined,
  StarOutlined,
  StarFilled,
  SendOutlined,
  BulbOutlined,
  PictureOutlined,
  DownOutlined,
  UpOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import { ChatMessage, LLMConfig } from '../../../types/type'
import BranchNavigator from './BranchNavigator'
import { Markdown } from '../../common/markdown/Markdown'
import SearchableMarkdown from '../../common/markdown/SearchableMarkdown'
import { captureDivToClipboard } from '@renderer/utils/exporter'
import { useStreamingMessage } from '../../../stores/messagesStore'
import RelativeTime from '../../common/RelativeTime'

const { Text } = Typography
const { TextArea } = Input
const { Option } = Select

interface MessageItemProps {
  message: ChatMessage
  chatId: string // 添加chatId prop用于订阅流式消息状态
  isLoading?: boolean
  isLastMessage?: boolean
  llmConfigs?: LLMConfig[]
  // 分支导航相关（所有消息都使用兄弟分支导航）
  hasChildBranches?: boolean
  branchIndex?: number
  branchCount?: number
  onBranchPrevious?: (messageId: string) => void
  onBranchNext?: (messageId: string) => void
  // 原有的回调
  onRetry?: (messageId: string) => void
  onEdit?: (messageId: string, newContent: string) => void
  onEditAndResend?: (messageId: string, newContent: string) => void
  onToggleFavorite?: (messageId: string) => void
  onModelChange?: (messageId: string, newModelId: string) => void
  onDelete?: (messageId: string) => void
  // 折叠相关
  isCollapsed?: boolean
  onToggleCollapse?: (messageId: string) => void
  // 搜索相关
  searchQuery?: string
  getCurrentMatch?: () => { messageId: string; startIndex: number; endIndex: number } | null
  getHighlightInfo?: (text: string, messageId: string) => { text: string; highlights: Array<{ start: number; end: number; isCurrentMatch: boolean }> }
  currentMatchIndex?: number
}

const MessageItem = React.memo(function MessageItem({
  message,
  chatId,
  isLoading = false,
  isLastMessage = false,
  llmConfigs = [],
  hasChildBranches = false,
  branchIndex = 0,
  branchCount = 1,
  onBranchPrevious,
  onBranchNext,
  onRetry,
  onEdit,
  onEditAndResend,
  onToggleFavorite,
  onModelChange,
  onDelete,
  isCollapsed = false,
  onToggleCollapse,
  searchQuery,
  getCurrentMatch,
  getHighlightInfo,
  currentMatchIndex
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [reasoningExpanded, setReasoningExpanded] = useState<string[]>([])
  const messageRef = useRef<HTMLDivElement>(null)
  const editContainerRef = useRef<HTMLDivElement>(null)

  // 订阅流式消息状态
  const streamingMessage = useStreamingMessage(chatId, message.id)

  // 获取当前应该显示的内容和推理内容
  const currentContent = streamingMessage?.content || message.content
  const currentReasoningContent = streamingMessage?.reasoning_content || message.reasoning_content
  const isCurrentlyStreaming =
    message.isStreaming || (streamingMessage && streamingMessage.content !== message.content)

  // 根据消息流状态控制思考过程的展开/折叠
  useEffect(() => {
    if (currentReasoningContent) {
      if (isCurrentlyStreaming && !currentContent) {
        // 思考过程输出时自动展开（还没有最终回答内容）
        setReasoningExpanded(['reasoning_content'])
      } else {
        // 思考过程结束时自动折叠（开始输出最终回答或流结束）
        setReasoningExpanded([])
      }
    }
  }, [isCurrentlyStreaming, currentReasoningContent, currentContent])


  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent)
  }

  const handleCopyAsImage = async () => {
    if (!messageRef.current) return
    captureDivToClipboard(messageRef.current, 10, 10)
  }

  const handleRetry = () => {
    onRetry?.(message.id)
  }

  const handleEdit = () => {
    setIsEditing(true)
    setEditContent(currentContent)
  }

  // 当进入编辑状态时，滚动到编辑框
  useEffect(() => {
    if (isEditing && editContainerRef.current) {
      // 使用 setTimeout 确保 DOM 已更新
      setTimeout(() => {
        if (editContainerRef.current) {
          // 滚动到编辑容器，确保它在视口中可见
          editContainerRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          })

          // 聚焦到编辑框（通过查找 textarea 元素）
          const textarea = editContainerRef.current.querySelector('textarea')
          if (textarea) {
            textarea.focus()
            // 将光标移动到末尾
            textarea.setSelectionRange(textarea.value.length, textarea.value.length)
          }
        }
      }, 100)
    }
  }, [isEditing])

  const handleSaveEdit = () => {
    if (editContent.trim() !== currentContent) {
      onEdit?.(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleSaveAndResend = () => {
    onEditAndResend?.(message.id, editContent.trim())
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent(currentContent)
  }

  const handleToggleFavorite = () => {
    onToggleFavorite?.(message.id)
  }

  const handleModelChange = (newModelId: string) => {
    onModelChange?.(message.id, newModelId)
  }

  const handleBranchPrevious = () => {
    onBranchPrevious?.(message.id)
  }

  const handleBranchNext = () => {
    onBranchNext?.(message.id)
  }

  const handleToggleCollapse = () => {
    onToggleCollapse?.(message.id)
  }

  const handleDelete = () => {
    onDelete?.(message.id)
  }

  // 处理右键菜单复制
  const handleContextMenuCopy = () => {
    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
      // 如果有选中文本，复制选中的文本
      navigator.clipboard.writeText(selection.toString())
    } else {
      // 如果没有选中文本，复制整个消息内容
      navigator.clipboard.writeText(currentContent)
    }
  }

  // 右键菜单项
  const contextMenuItems = [
    {
      key: 'copy',
      label: '复制',
      icon: <CopyOutlined />,
      onClick: handleContextMenuCopy
    }
  ]

  // 生成折叠状态下的预览文本
  const getPreviewText = (content: string, maxLength: number = 80) => {
    if (!content) return '消息已折叠，点击展开按钮查看内容'

    // 移除markdown语法和多余的空白字符
    const cleanContent = content
      .replace(/[#*_`~\[\]]/g, '') // 移除常见的markdown符号
      .replace(/\n+/g, ' ') // 将换行符替换为空格
      .replace(/\s+/g, ' ') // 合并多个空格为一个
      .trim()

    if (cleanContent.length <= maxLength) {
      return cleanContent
    }

    // 在单词边界处截断，避免截断单词
    const truncated = cleanContent.slice(0, maxLength)
    const lastSpaceIndex = truncated.lastIndexOf(' ')

    if (lastSpaceIndex > maxLength * 0.8) {
      return truncated.slice(0, lastSpaceIndex) + '...'
    }

    return truncated + '...'
  }

  return (
    <div
      ref={messageRef}
      data-message-id={message.id}
      className={`message-item ${message.role === 'user' ? 'user-message' : 'assistant-message'}${message.isFavorited ? ' favorited' : ''}`}
    >
      <div className="message-avatar">
        <Avatar
          icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
          style={{
            backgroundColor: message.role === 'user' ? '#87d068' : '#1890ff'
          }}
        />
      </div>
      <div className={isEditing ? 'message-content message-content-editing' : 'message-content'}>
        <div className="message-header">
          <div className="message-title">
            <Text strong>{message.role === 'user' ? '您' : 'AI助手'}</Text>
            {message.role === 'assistant' && message.modelId && llmConfigs.length > 0 && (
              <Select
                value={message.modelId}
                onChange={handleModelChange}
                size="small"
                className="message-model-selector"
                disabled={isLoading}
                bordered={false}
                dropdownMatchSelectWidth={false}
              >
                {llmConfigs.map((config) => (
                  <Option key={config.id} value={config.id}>
                    {config.name}
                  </Option>
                ))}
              </Select>
            )}
            {hasChildBranches && (
              <BranchNavigator
                currentIndex={branchIndex}
                totalBranches={branchCount}
                onPrevious={handleBranchPrevious}
                onNext={handleBranchNext}
                className="message-branch-nav"
              />
            )}
            {/* 单个消息折叠按钮 */}
            <Button
              type="text"
              size="small"
              icon={isCollapsed ? <DownOutlined /> : <UpOutlined />}
              onClick={handleToggleCollapse}
              title={isCollapsed ? '展开消息' : '折叠消息'}
              className="message-collapse-btn"
            />
          </div>
          <div className="message-time">
            <RelativeTime timestamp={message.timestamp} />
          </div>
        </div>

        {/* 消息内容区域 - 可折叠，但编辑状态优先级最高 */}
        {(!isCollapsed || isEditing) && (
          <>
            {/* 推理模型思考过程展示 */}
            {currentReasoningContent && (
              <Card size="small" className="message-reasoning-card" style={{ marginBottom: 8 }}>
                <Collapse
                  size="small"
                  ghost
                  activeKey={reasoningExpanded}
                  onChange={(keys) =>
                    setReasoningExpanded(Array.isArray(keys) ? keys : [keys].filter(Boolean))
                  }
                  items={[
                    {
                      key: 'reasoning_content',
                      label: (
                        <Text type="secondary">
                          <BulbOutlined style={{ marginRight: 4 }} />
                          思考过程
                        </Text>
                      ),
                      children: (
                        <Dropdown
                          menu={{
                            items: [
                              {
                                key: 'copy-reasoning',
                                label: '复制思考过程',
                                icon: <CopyOutlined />,
                                onClick: () => navigator.clipboard.writeText(currentReasoningContent || '')
                              }
                            ]
                          }}
                          trigger={['contextMenu']}
                          disabled={isCurrentlyStreaming}
                        >
                          <div
                            style={{
                              marginBottom: 0,
                              color: '#666',
                              backgroundColor: '#fafafa',
                              padding: '8px 12px',
                              borderRadius: '4px',
                              border: '1px solid #f0f0f0',
                              userSelect: 'text',
                              cursor: 'text'
                            }}
                          >
                            <Markdown content={currentReasoningContent ?? ''} />
                          </div>
                        </Dropdown>
                      )
                    }
                  ]}
                />
              </Card>
            )}

            <Card size="small" className="message-card">
              {isEditing ? (
                <div className="message-edit-container" ref={editContainerRef}>
                  <TextArea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    autoSize={{ minRows: 2, maxRows: 16 }}
                    placeholder="编辑消息内容..."
                  />
                  <div className="message-edit-actions">
                    <Space>
                      <Button
                        type="primary"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={handleSaveEdit}
                        disabled={!editContent.trim()}
                      >
                        保存
                      </Button>
                      {message.role === 'user' && (
                        <Button
                          type="primary"
                          size="small"
                          icon={<SendOutlined />}
                          onClick={handleSaveAndResend}
                          disabled={!editContent.trim() || isLoading}
                          ghost
                        >
                          保存并重发
                        </Button>
                      )}
                      <Button size="small" icon={<CloseOutlined />} onClick={handleCancelEdit}>
                        取消
                      </Button>
                    </Space>
                  </div>
                </div>
              ) : (
                <Dropdown
                  menu={{ items: contextMenuItems }}
                  trigger={['contextMenu']}
                  disabled={isCurrentlyStreaming}
                >
                  <div
                    style={{
                      marginBottom: 0,
                      userSelect: 'text',
                      cursor: 'text'
                    }}
                  >
                    <SearchableMarkdown
                      content={currentContent ?? ''}
                      loading={isCurrentlyStreaming && !currentContent}
                      searchQuery={searchQuery}
                      messageId={message.id}
                      getCurrentMatch={getCurrentMatch}
                      getHighlightInfo={getHighlightInfo}
                      currentMatchIndex={currentMatchIndex}
                    />
                  </div>
                </Dropdown>
              )}
            </Card>
          </>
        )}

        {/* 折叠状态下的预览 - 编辑状态时不显示 */}
        {isCollapsed && !isEditing && (
          <Card size="small" className="message-card message-collapsed">
            <div className="message-preview">
              <Text type="secondary" className="message-preview-text">
                {getPreviewText(currentContent)}
              </Text>
              {currentReasoningContent && (
                <Text type="secondary" className="message-preview-reasoning">
                  <BulbOutlined style={{ marginRight: 4 }} />
                  含思考过程
                </Text>
              )}
            </div>
          </Card>
        )}

        <div className={`message-actions ${isLastMessage ? 'visible' : ''}`}>
          <div className="message-action-buttons">
            <Tooltip title="复制">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={handleCopy}
                disabled={isCurrentlyStreaming}
              />
            </Tooltip>
            <Tooltip title="复制为图片">
              <Button
                type="text"
                size="small"
                icon={<PictureOutlined />}
                onClick={handleCopyAsImage}
                disabled={isCurrentlyStreaming}
              />
            </Tooltip>
            <Tooltip title="收藏">
              <Button
                type="text"
                size="small"
                icon={message.isFavorited ? <StarFilled /> : <StarOutlined />}
                onClick={handleToggleFavorite}
                className={message.isFavorited ? 'favorited' : ''}
                disabled={isCurrentlyStreaming}
              />
            </Tooltip>
            {!isEditing && (
              <Tooltip title="编辑">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={handleEdit}
                  disabled={isCurrentlyStreaming}
                />
              </Tooltip>
            )}
            {message.role === 'assistant' && onRetry && (
              <Tooltip title="重试">
                <Button
                  type="text"
                  size="small"
                  icon={<RedoOutlined />}
                  onClick={handleRetry}
                  disabled={isLoading || isCurrentlyStreaming}
                />
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip title="删除">
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={handleDelete}
                  className="message-delete-btn"
                />
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // 自定义比较函数，避免不必要的重渲染
  // 注意：对于正在流式输出的消息，我们需要重新渲染
  if (prevProps.message.id !== nextProps.message.id) return false

  // 如果消息内容或流式状态发生变化，需要重新渲染
  if (prevProps.message.content !== nextProps.message.content ||
      prevProps.message.reasoning_content !== nextProps.message.reasoning_content ||
      prevProps.message.isStreaming !== nextProps.message.isStreaming ||
      prevProps.message.isFavorited !== nextProps.message.isFavorited ||
      prevProps.message.modelId !== nextProps.message.modelId) {
    return false
  }

  // 如果搜索查询改变或currentMatchIndex改变，需要重新渲染
  if (prevProps.searchQuery !== nextProps.searchQuery ||
      prevProps.currentMatchIndex !== nextProps.currentMatchIndex) {
    return false
  }

  // 检查其他重要属性
  return (
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.isLastMessage === nextProps.isLastMessage &&
    prevProps.isCollapsed === nextProps.isCollapsed &&
    prevProps.hasChildBranches === nextProps.hasChildBranches &&
    prevProps.branchIndex === nextProps.branchIndex &&
    prevProps.branchCount === nextProps.branchCount &&
    prevProps.llmConfigs === nextProps.llmConfigs
  )
})

export default MessageItem
