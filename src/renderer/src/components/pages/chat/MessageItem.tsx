import React, { useRef, useEffect } from 'react'
import { Avatar, App } from 'antd'
import { UserOutlined, RobotOutlined, CopyOutlined, MessageOutlined, PlusCircleOutlined, HeartOutlined } from '@ant-design/icons'
import { ChatMessage, LLMConfig } from '../../../types/type'
import { useStreamingMessage } from '../../../stores/messagesStore'
import SingleMessageExportContainer from './SingleMessageExportContainer'
import ImagePreviewModal, { ImageExportWidth } from './ImagePreviewModal'
import { useMessageActions } from './messageItem/useMessageActions'
import { useMessageImageExport } from './messageItem/useMessageImageExport'
import { useReasoningContent } from './messageItem/useReasoningContent'
import { MessageHeader } from './messageItem/MessageHeader'
import { MessageContent } from './messageItem/MessageContent'
import { MessageEditForm } from './messageItem/MessageEditForm'
import { CollapsedMessagePreview } from './messageItem/CollapsedMessagePreview'
import { MessageActionButtons } from './messageItem/MessageActionButtons'

interface MessageItemProps {
  message: ChatMessage
  chatId: string
  isLoading?: boolean
  isLastMessage?: boolean
  llmConfigs?: LLMConfig[]
  hasChildBranches?: boolean
  branchIndex?: number
  branchCount?: number
  onBranchPrevious?: (messageId: string) => void
  onBranchNext?: (messageId: string) => void
  hasChildren?: boolean
  onRetry?: (messageId: string) => void
  onContinue?: (messageId: string) => void
  onEdit?: (messageId: string, newContent: string) => void
  onEditAndResend?: (messageId: string, newContent: string) => void
  onToggleBookmark?: (messageId: string) => void
  onAddToFavorites?: (messageId: string) => void
  onFavoriteTextFragment?: (messageId: string, text: string, startOffset: number, endOffset: number) => void
  onModelChange?: (messageId: string, newModelId: string) => void
  onDelete?: (messageId: string) => void
  onQuote?: (text: string) => void
  onCreateNewChat?: (text: string) => void
  isCollapsed?: boolean
  onToggleCollapse?: (messageId: string) => void
  searchQuery?: string
  getCurrentMatch?: () => { messageId: string; startIndex: number; endIndex: number } | null
  getHighlightInfo?: (
    text: string,
    messageId: string
  ) => { text: string; highlights: Array<{ start: number; end: number; isCurrentMatch: boolean }> }
  currentMatchIndex?: number
}

const IMAGE_WIDTH_CONFIG: Record<ImageExportWidth, number> = {
  small: 375,
  medium: 600,
  large: 800
}

const MessageItem = React.memo(
  function MessageItem({
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
    hasChildren = false,
    onRetry,
    onContinue,
    onEdit,
    onEditAndResend,
    onToggleBookmark,
    onAddToFavorites,
    onFavoriteTextFragment,
    onModelChange,
    onDelete,
    onQuote,
    onCreateNewChat,
    isCollapsed = false,
    onToggleCollapse,
    searchQuery,
    getCurrentMatch,
    getHighlightInfo,
    currentMatchIndex
  }: MessageItemProps) {
    const messageRef = useRef<HTMLDivElement>(null)
    const editContainerRef = useRef<HTMLDivElement>(null)

    // 订阅流式消息状态
    const streamingMessage = useStreamingMessage(chatId, message.id)

    // 获取当前应该显示的内容和推理内容
    const currentContent = streamingMessage?.content || message.content
    const currentReasoningContent = streamingMessage?.reasoning_content || message.reasoning_content
    const isCurrentlyStreaming =
      message.isStreaming || (streamingMessage && streamingMessage.content !== message.content)

    // 使用自定义 hooks
    const messageActions = useMessageActions({
      message,
      chatId,
      onRetry,
      onContinue,
      onEdit,
      onEditAndResend,
      onToggleBookmark,
      onAddToFavorites,
      onModelChange,
      onDelete,
      onQuote,
      onCreateNewChat,
      onToggleCollapse,
      onBranchPrevious,
      onBranchNext
    })

    const imageExport = useMessageImageExport()

    const { reasoningExpanded, handleReasoningExpandChange } = useReasoningContent({
      reasoningContent: currentReasoningContent,
      isStreaming: isCurrentlyStreaming,
      currentContent
    })

    // 当进入编辑状态时，滚动到编辑框
    useEffect(() => {
      if (messageActions.isEditing && editContainerRef.current) {
        setTimeout(() => {
          if (editContainerRef.current) {
            editContainerRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            })

            const textarea = editContainerRef.current.querySelector('textarea')
            if (textarea) {
              textarea.focus()
              textarea.setSelectionRange(textarea.value.length, textarea.value.length)
            }
          }
        }, 100)
      }
    }, [messageActions.isEditing])

    // 处理收藏文本片段
    const handleFavoriteTextFragment = () => {
      const selection = window.getSelection()
      const selectedText = selection?.toString()

      if (selectedText && selectedText.trim() && onFavoriteTextFragment) {
        // 计算选中文本在消息内容中的偏移量
        const content = message.content
        const startOffset = content.indexOf(selectedText)
        const endOffset = startOffset + selectedText.length

        if (startOffset !== -1) {
          onFavoriteTextFragment(message.id, selectedText, startOffset, endOffset)
          selection?.removeAllRanges()
        }
      }
    }

    // 右键菜单项 - 使用函数生成以便动态检查选中文本
    const getContextMenuItems = () => {
      const selection = window.getSelection()
      const selectedText = selection?.toString() || ''
      const hasSelection = selectedText.trim().length > 0

      return [
        {
          key: 'copy',
          label: '复制',
          icon: <CopyOutlined />,
          onClick: messageActions.handleContextMenuCopy
        },
        {
          key: 'quote',
          label: '引用',
          icon: <MessageOutlined />,
          onClick: messageActions.handleQuote,
          disabled: !onQuote
        },
        {
          key: 'favoriteText',
          label: '收藏',
          icon: <HeartOutlined />,
          onClick: handleFavoriteTextFragment,
          disabled: !onFavoriteTextFragment || !hasSelection
        },
        {
          type: 'divider'
        },
        {
          key: 'newChat',
          label: '新建对话',
          icon: <PlusCircleOutlined />,
          onClick: messageActions.handleCreateNewChat,
          disabled: !onCreateNewChat
        }
      ]
    }

    const currentLLMConfig = llmConfigs.find((config) => config.id === message.modelId)

    return (
      <>
        <div
          ref={messageRef}
          data-message-id={message.id}
          className={`message-item ${message.role === 'user' ? 'user-message' : 'assistant-message'}${message.isBookmarked ? ' bookmarked' : ''}${message.hasError ? ' has-error' : ''}`}
        >
          <div className="message-avatar">
            <Avatar
              icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              style={{
                backgroundColor: message.role === 'user' ? '#87d068' : '#1890ff'
              }}
            />
          </div>
          <div
            className={
              messageActions.isEditing ? 'message-content message-content-editing' : 'message-content'
            }
          >
            <MessageHeader
              role={message.role}
              modelId={message.modelId}
              timestamp={message.timestamp}
              isCollapsed={isCollapsed}
              isLoading={isLoading}
              llmConfigs={llmConfigs}
              hasChildBranches={hasChildBranches}
              branchIndex={branchIndex}
              branchCount={branchCount}
              onModelChange={messageActions.handleModelChange}
              onBranchPrevious={messageActions.handleBranchPrevious}
              onBranchNext={messageActions.handleBranchNext}
              onToggleCollapse={messageActions.handleToggleCollapse}
            />

            {/* 消息内容区域 - 可折叠，但编辑状态优先级最高 */}
            {(!isCollapsed || messageActions.isEditing) && (
              <>
                {messageActions.isEditing ? (
                  <MessageEditForm
                    editContent={messageActions.editContent}
                    isUserMessage={message.role === 'user'}
                    isLoading={isLoading}
                    onContentChange={messageActions.setEditContent}
                    onSave={messageActions.handleSaveEdit}
                    onSaveAndResend={messageActions.handleSaveAndResend}
                    onCancel={messageActions.handleCancelEdit}
                    containerRef={editContainerRef}
                    attachments={messageActions.editAttachments}
                    onAttachmentsChange={messageActions.setEditAttachments}
                  />
                ) : (
                  <MessageContent
                    currentContent={currentContent}
                    currentReasoningContent={currentReasoningContent}
                    isCurrentlyStreaming={isCurrentlyStreaming}
                    reasoningExpanded={reasoningExpanded}
                    onReasoningExpandChange={handleReasoningExpandChange}
                    contextMenuItems={getContextMenuItems}
                    searchQuery={searchQuery}
                    messageId={message.id}
                    getCurrentMatch={getCurrentMatch}
                    getHighlightInfo={getHighlightInfo}
                    currentMatchIndex={currentMatchIndex}
                    attachments={message.attachments}
                  />
                )}
              </>
            )}

            {/* 折叠状态下的预览 - 编辑状态时不显示 */}
            {isCollapsed && !messageActions.isEditing && (
              <CollapsedMessagePreview
                content={currentContent}
                hasReasoningContent={!!currentReasoningContent}
              />
            )}

            <div className={`message-actions ${isLastMessage ? 'visible' : ''}`}>
              <MessageActionButtons
                role={message.role}
                isBookmarked={message.isBookmarked || false}
                isCurrentlyStreaming={isCurrentlyStreaming}
                isEditing={messageActions.isEditing}
                hasChildren={hasChildren}
                isLoading={isLoading}
                onCopy={messageActions.handleCopy}
                onCopyAsImage={imageExport.handleCopyAsImage}
                onToggleBookmark={messageActions.handleToggleBookmark}
                onAddToFavorites={onAddToFavorites ? messageActions.handleAddToFavorites : undefined}
                onEdit={messageActions.handleEdit}
                onRetry={onRetry ? messageActions.handleRetry : undefined}
                onContinue={onContinue ? messageActions.handleContinue : undefined}
                onDelete={onDelete ? messageActions.handleDelete : undefined}
              />
            </div>
          </div>
        </div>

        {/* 只在需要时渲染导出容器 */}
        {imageExport.shouldRenderExportContainer && (
          <SingleMessageExportContainer
            message={message}
            llmConfig={currentLLMConfig}
            width={IMAGE_WIDTH_CONFIG[imageExport.imageExportWidth]}
            containerRef={imageExport.exportContentRef}
          />
        )}

        {/* 图片预览Modal */}
        {imageExport.isImagePreviewVisible && (
          <ImagePreviewModal
            visible={imageExport.isImagePreviewVisible}
            onClose={imageExport.closeImagePreview}
            imageUrl={imageExport.previewImageUrl}
            onSave={imageExport.handleSaveImage}
            onCopy={imageExport.handleCopyImageToClipboard}
            imageWidth={imageExport.imageExportWidth}
            onWidthChange={imageExport.handleWidthChange}
            isRegenerating={imageExport.isRegeneratingImage}
            onImageEdited={imageExport.handleImageEdited}
          />
        )}
      </>
    )
  },
  (prevProps, nextProps) => {
    // 自定义比较函数，避免不必要的重渲染
    if (prevProps.message.id !== nextProps.message.id) return false

    // 如果消息内容或流式状态发生变化，需要重新渲染
    if (
      prevProps.message.content !== nextProps.message.content ||
      prevProps.message.reasoning_content !== nextProps.message.reasoning_content ||
      prevProps.message.isStreaming !== nextProps.message.isStreaming ||
      prevProps.message.isBookmarked !== nextProps.message.isBookmarked ||
      prevProps.message.modelId !== nextProps.message.modelId ||
      prevProps.message.attachments !== nextProps.message.attachments ||
      prevProps.message.hasError !== nextProps.message.hasError
    ) {
      return false
    }

    // 如果搜索查询改变或currentMatchIndex改变，需要重新渲染
    if (
      prevProps.searchQuery !== nextProps.searchQuery ||
      prevProps.currentMatchIndex !== nextProps.currentMatchIndex
    ) {
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
      prevProps.hasChildren === nextProps.hasChildren &&
      prevProps.llmConfigs === nextProps.llmConfigs
    )
  }
)

export default MessageItem
