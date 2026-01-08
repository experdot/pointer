import React, { useState, useMemo, useCallback } from 'react'
import type { MenuProps } from 'antd'
import {
  CopyOutlined,
  EnterOutlined,
  ExportOutlined,
  TagOutlined,
  FolderOutlined
} from '@ant-design/icons'
import { MessageEditMode } from './MessageEditMode'
import { MessageViewMode } from './MessageViewMode'
import { tableToMarkdown, getSelectedText } from './utils'
import type { MessageContentProps, ContextMenuInfo } from './types'

export const MessageContent = React.memo(function MessageContent({
  message,
  displayContent,
  isUser,
  isAssistant,
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
  onStartTitleEdit,
  onStartTopicEdit,
  topicCallbacks,
  exportCallbacks,
  onQuote
}: MessageContentProps): React.JSX.Element {
  const [contextMenuInfo, setContextMenuInfo] = useState<ContextMenuInfo>({ type: 'default' })

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
    const items: MenuProps['items'] = [
      {
        key: 'copy',
        label: '复制',
        icon: <CopyOutlined />,
        onClick: () => {
          const selected = getSelectedText()
          navigator.clipboard.writeText(selected || displayContent)
        }
      },
      {
        key: 'quote',
        label: '引用',
        icon: <EnterOutlined />,
        onClick: () => {
          const selected = getSelectedText()
          onQuote?.(selected || displayContent)
        }
      }
    ]

    // 根据上下文添加导出选项
    if (contextMenuInfo.type === 'code' && contextMenuInfo.content) {
      items.push({
        key: 'export-code',
        label: '导出代码块',
        icon: <ExportOutlined />,
        onClick: () => {
          exportCallbacks.onExportCode?.(
            contextMenuInfo.content!,
            contextMenuInfo.language || 'text'
          )
        }
      })
    } else if (contextMenuInfo.type === 'table' && contextMenuInfo.content) {
      items.push({
        key: 'export-table',
        label: '导出表格',
        icon: <ExportOutlined />,
        onClick: () => {
          exportCallbacks.onExportTable?.(contextMenuInfo.content!)
        }
      })
    } else if (contextMenuInfo.type === 'text' && contextMenuInfo.content) {
      items.push({
        key: 'export-text',
        label: '导出选中文本',
        icon: <ExportOutlined />,
        onClick: () => {
          exportCallbacks.onExportText?.(contextMenuInfo.content!)
        }
      })
    }

    // 导出整条消息
    items.push({
      key: 'export',
      label: '导出整条消息',
      icon: <ExportOutlined />,
      onClick: () => {
        exportCallbacks.onExport?.(message.id)
      }
    })

    items.push({ type: 'divider' })

    items.push({
      key: 'set-title',
      label: message.title ? '编辑标题' : '添加标题',
      icon: <TagOutlined />,
      onClick: onStartTitleEdit
    })

    items.push({ type: 'divider' })

    items.push(
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
    )

    return items
  }, [
    contextMenuInfo,
    displayContent,
    message.id,
    message.title,
    topic,
    onQuote,
    exportCallbacks,
    topicCallbacks,
    onStartTitleEdit,
    onStartTopicEdit
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
