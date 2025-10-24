import { useState, useCallback } from 'react'
import { ChatMessage, FileAttachment } from '../../../../types/type'
import { usePagesStore } from '../../../../stores/pagesStore'

interface UseMessageActionsProps {
  message: ChatMessage
  chatId: string
  onRetry?: (messageId: string) => void
  onContinue?: (messageId: string) => void
  onEdit?: (messageId: string, newContent: string) => void
  onEditAndResend?: (messageId: string, newContent: string, newAttachments?: FileAttachment[]) => void
  onToggleStar?: (messageId: string) => void
  onAddToFavorites?: (messageId: string) => void
  onModelChange?: (messageId: string, newModelId: string) => void
  onDelete?: (messageId: string) => void
  onQuote?: (text: string) => void
  onCreateNewChat?: (text: string) => void
  onToggleCollapse?: (messageId: string) => void
  onBranchPrevious?: (messageId: string) => void
  onBranchNext?: (messageId: string) => void
}

export function useMessageActions(props: UseMessageActionsProps) {
  const { message } = props
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [editAttachments, setEditAttachments] = useState<FileAttachment[]>(message.attachments || [])

  const handleRetry = useCallback(() => {
    props.onRetry?.(message.id)
  }, [props.onRetry, message.id])

  const handleContinue = useCallback(() => {
    props.onContinue?.(message.id)
  }, [props.onContinue, message.id])

  const handleEdit = useCallback(() => {
    setIsEditing(true)
    setEditContent(message.content)
    setEditAttachments(message.attachments || [])
  }, [message.content, message.attachments])

  const handleSaveEdit = useCallback(() => {
    if (editContent.trim()) {
      // 更新消息内容和附件
      const { updatePage } = usePagesStore.getState()
      const chat = usePagesStore.getState().pages.find(p => p.id === props.chatId)

      if (chat && chat.messages) {
        const updatedMessages = chat.messages.map((msg: ChatMessage) =>
          msg.id === message.id
            ? { ...msg, content: editContent, attachments: editAttachments, timestamp: Date.now() }
            : msg
        )
        updatePage(props.chatId, { messages: updatedMessages })
      }

      setIsEditing(false)
    }
  }, [message.id, editContent, editAttachments, props.chatId])

  const handleSaveAndResend = useCallback(() => {
    // 保存并重发会创建新分支，不修改原消息
    // 将编辑后的附件传递给 onEditAndResend，让它在创建新分支时使用
    props.onEditAndResend?.(message.id, editContent, editAttachments)
    setIsEditing(false)
  }, [props.onEditAndResend, message.id, editContent, editAttachments])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditContent(message.content)
    setEditAttachments(message.attachments || [])
  }, [message.content, message.attachments])

  const handleToggleStar = useCallback(() => {
    props.onToggleStar?.(message.id)
  }, [props.onToggleStar, message.id])

  const handleAddToFavorites = useCallback(() => {
    props.onAddToFavorites?.(message.id)
  }, [props.onAddToFavorites, message.id])

  const handleModelChange = useCallback(
    (newModelId: string) => {
      props.onModelChange?.(message.id, newModelId)
    },
    [props.onModelChange, message.id]
  )

  const handleBranchPrevious = useCallback(() => {
    props.onBranchPrevious?.(message.id)
  }, [props.onBranchPrevious, message.id])

  const handleBranchNext = useCallback(() => {
    props.onBranchNext?.(message.id)
  }, [props.onBranchNext, message.id])

  const handleToggleCollapse = useCallback(() => {
    props.onToggleCollapse?.(message.id)
  }, [props.onToggleCollapse, message.id])

  const handleDelete = useCallback(() => {
    props.onDelete?.(message.id)
  }, [props.onDelete, message.id])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content)
  }, [message.content])

  const handleContextMenuCopy = useCallback(() => {
    const selection = window.getSelection()
    const selectedText = selection?.toString()

    if (selectedText && selectedText.trim()) {
      navigator.clipboard.writeText(selectedText)
    } else {
      navigator.clipboard.writeText(message.content)
    }
  }, [message.content])

  const handleQuote = useCallback(() => {
    const selection = window.getSelection()
    const selectedText = selection?.toString()

    if (selectedText && selectedText.trim()) {
      props.onQuote?.(selectedText)
      selection?.removeAllRanges()
    } else {
      props.onQuote?.(message.content)
    }
  }, [props.onQuote, message.content])

  const handleCreateNewChat = useCallback(() => {
    const selection = window.getSelection()
    const selectedText = selection?.toString()

    if (selectedText && selectedText.trim()) {
      props.onCreateNewChat?.(selectedText)
      selection?.removeAllRanges()
    } else {
      props.onCreateNewChat?.(message.content)
    }
  }, [props.onCreateNewChat, message.content])

  return {
    // Editing state
    isEditing,
    editContent,
    setEditContent,
    editAttachments,
    setEditAttachments,

    // Actions
    handleRetry,
    handleContinue,
    handleEdit,
    handleSaveEdit,
    handleSaveAndResend,
    handleCancelEdit,
    handleToggleStar,
    handleAddToFavorites,
    handleModelChange,
    handleBranchPrevious,
    handleBranchNext,
    handleToggleCollapse,
    handleDelete,
    handleCopy,
    handleContextMenuCopy,
    handleQuote,
    handleCreateNewChat
  }
}
