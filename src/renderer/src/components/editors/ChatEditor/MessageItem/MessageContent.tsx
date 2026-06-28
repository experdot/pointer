import React, { useState, useMemo, useCallback } from 'react'
import type { MenuProps } from 'antd'
import {
  CopyOutlined,
  EnterOutlined,
  ExportOutlined,
  EditOutlined,
  ReloadOutlined,
  ArrowDownOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  ProfileOutlined,
  TagOutlined,
  FolderOutlined
} from '@ant-design/icons'
import { MessageEditMode } from './MessageEditMode'
import { MessageViewMode } from './MessageViewMode'
import { useConfirmDialog } from '../../../common/ConfirmDialog'
import { tableToMarkdown, getSelectedText } from './utils'
import type { MessageContentProps, ContextMenuInfo } from './types'
import { getShortcutLabel } from '../../../../utils/shortcutPresentation'

export const MessageContent = React.memo(function MessageContent({
  message,
  displayContent,
  isUser,
  isAssistant,
  isLeaf,
  isStreaming,
  isEditing,
  editContent,
  editAttachments,
  collapsed,
  collapsedPreview,
  topic,
  onEditContentChange,
  onEditAttachmentsChange,
  onCancelEdit,
  onSaveEdit,
  onEditAndResend,
  onToggleCollapse,
  onStartEdit,
  onRetry,
  onContinue,
  onDelete,
  onStartTitleEdit,
  onStartTopicEdit,
  topicCallbacks,
  exportCallbacks,
  onQuote
}: MessageContentProps): React.JSX.Element {
  const { showDeleteConfirm } = useConfirmDialog()
  const [contextMenuInfo, setContextMenuInfo] = useState<ContextMenuInfo>({ type: 'default' })

  const handleCopy = useCallback(() => {
    const selected = getSelectedText()
    navigator.clipboard.writeText(selected || displayContent)
  }, [displayContent])

  const handleQuote = useCallback(() => {
    const selected = getSelectedText()
    onQuote?.(selected || displayContent)
  }, [displayContent, onQuote])

  const handleDelete = useCallback(() => {
    showDeleteConfirm({
      onOk: onDelete
    })
  }, [onDelete, showDeleteConfirm])

  const contextualExportItem = useMemo<NonNullable<MenuProps['items']>[number] | null>(() => {
    if (contextMenuInfo.type === 'code' && contextMenuInfo.content) {
      return {
        key: 'export-code',
        label: '导出代码块',
        icon: <ExportOutlined />,
        onClick: () => {
          exportCallbacks.onExportCode?.(contextMenuInfo.content!, contextMenuInfo.language || 'text')
        }
      }
    }

    if (contextMenuInfo.type === 'table' && contextMenuInfo.content) {
      return {
        key: 'export-table',
        label: '导出表格',
        icon: <ExportOutlined />,
        onClick: () => {
          exportCallbacks.onExportTable?.(contextMenuInfo.content!)
        }
      }
    }

    if (contextMenuInfo.type === 'text' && contextMenuInfo.content) {
      return {
        key: 'export-text',
        label: '导出选中文本',
        icon: <ExportOutlined />,
        onClick: () => {
          exportCallbacks.onExportText?.(contextMenuInfo.content!)
        }
      }
    }

    return null
  }, [contextMenuInfo, exportCallbacks])

  // 检测右键点击的元素类型
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const selectedText = getSelectedText()

    // 检测代码块
    const codeBlock = target.closest('pre')
    if (codeBlock) {
      const codeElement = codeBlock.querySelector('code')
      const codeContent = codeElement?.textContent || codeBlock.textContent || ''
      const langClass = codeElement?.className?.match(/language-(\w+)/)?.[1] || 'text'
      setContextMenuInfo({ type: 'code', content: codeContent, language: langClass })
      return
    }

    // 检测表格
    const table = target.closest('table')
    if (table) {
      const tableMarkdown = tableToMarkdown(table as HTMLTableElement)
      setContextMenuInfo({ type: 'table', content: tableMarkdown })
      return
    }

    // 检测选中文本
    if (selectedText.trim()) {
      setContextMenuInfo({ type: 'text', content: selectedText })
      return
    }

    // 默认
    setContextMenuInfo({ type: 'default' })
  }, [])

  // 动态生成右键菜单项
  const contextMenuItems: MenuProps['items'] = useMemo(() => {
    const operationChildren: NonNullable<MenuProps['items']> = []

    if (!isStreaming) {
      operationChildren.push({
        key: 'edit',
        label: '编辑',
        icon: <EditOutlined />,
        onClick: onStartEdit
      })
    }

    if (isAssistant && !isStreaming) {
      operationChildren.push({
        key: 'retry',
        label: '重试',
        icon: <ReloadOutlined />,
        onClick: onRetry
      })
    }

    if (isUser && isLeaf && !isStreaming) {
      operationChildren.push({
        key: 'continue',
        label: '继续生成',
        icon: <ArrowDownOutlined />,
        onClick: onContinue
      })
    }

    if (!isStreaming) {
      operationChildren.push({
        key: 'delete',
        label: '删除',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: handleDelete
      })
    }

    const outlineChildren: NonNullable<MenuProps['items']> = [
      {
        key: 'set-title',
        label: message.title ? '编辑标题' : '添加标题',
        icon: <TagOutlined />,
        onClick: onStartTitleEdit
      },
      topic
        ? {
            key: 'edit-topic',
            label: '编辑分组',
            icon: <FolderOutlined />,
            onClick: onStartTopicEdit
          }
        : {
            key: 'set-topic',
            label: '添加分组',
            icon: <FolderOutlined />,
            onClick: () => {
              const topicName = message.title || displayContent.slice(0, 15).replace(/\s+/g, ' ')
              topicCallbacks.onCreateTopic?.(message.id, topicName)
            }
          }
    ]

    const exportChildren: NonNullable<MenuProps['items']> = [
      {
        key: 'export',
        label: '导出整条消息',
        icon: <ExportOutlined />,
        onClick: () => {
          exportCallbacks.onExport?.(message.id)
        }
      },
      ...(contextualExportItem ? [contextualExportItem] : [])
    ]

    const items: MenuProps['items'] = [
      {
        key: 'copy',
        label: '复制',
        icon: <CopyOutlined />,
        extra: getShortcutLabel('messageCopy'),
        onClick: handleCopy
      },
      {
        key: 'quote',
        label: '引用',
        icon: <EnterOutlined />,
        onClick: handleQuote
      }
    ]

    if (operationChildren.length > 0) {
      items.push({ type: 'divider' })
      items.push({
        key: 'actions',
        label: '操作',
        icon: <AppstoreOutlined />,
        children: operationChildren
      })
    }

    items.push({
      key: 'outline',
      label: '大纲',
      icon: <ProfileOutlined />,
      children: outlineChildren
    })

    items.push({ type: 'divider' })

    items.push({
      key: 'export-group',
      label: '导出',
      icon: <ExportOutlined />,
      children: exportChildren
    })

    return items
  }, [
    displayContent,
    exportCallbacks,
    handleCopy,
    handleDelete,
    handleQuote,
    isAssistant,
    isLeaf,
    isStreaming,
    isUser,
    message.id,
    message.title,
    onContinue,
    onRetry,
    onStartEdit,
    onStartTitleEdit,
    onStartTopicEdit,
    topic,
    topicCallbacks,
    contextualExportItem
  ])

  if (isEditing) {
    return (
      <MessageEditMode
        content={editContent}
        attachments={editAttachments}
        isUser={isUser}
        onContentChange={onEditContentChange}
        onAttachmentsChange={onEditAttachmentsChange}
        onCancel={onCancelEdit}
        onSave={onSaveEdit}
        onSaveAndResend={isUser ? onEditAndResend : undefined}
      />
    )
  }

  return (
    <MessageViewMode
      displayContent={displayContent}
      isAssistant={isAssistant}
      isStreaming={isStreaming}
      collapsed={collapsed}
      collapsedPreview={collapsedPreview}
      contextMenuItems={contextMenuItems}
      onContextMenu={handleContextMenu}
      onExpandCollapsed={() => onToggleCollapse()}
    />
  )
})
