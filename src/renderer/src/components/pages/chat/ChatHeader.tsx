import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Button, Dropdown, Space, App, Tooltip, Input } from 'antd'
import { ExportOutlined, DownOutlined, UpOutlined, BranchesOutlined, EditOutlined, StarOutlined, StarFilled } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { ChatMessage, Page, PageFolder } from '../../../types/type'
import { MessageTree } from './messageTree'
import { formatExactDateTime } from '../../../utils/timeFormatter'
import ExportModal, { ExportSettings } from './ExportModal'
import { usePagesStore } from '../../../stores/pagesStore'
import { useFavoritesStore } from '../../../stores/favoritesStore'

interface ChatHeaderProps {
  chatId: string
  chatTitle?: string
  messages: ChatMessage[]
  currentPath?: string[]
  // 消息折叠相关
  allMessagesCollapsed?: boolean
  onCollapseAll?: () => void
  onExpandAll?: () => void
  onCollapseAI?: () => void
  // 消息树相关
  messageTreeCollapsed?: boolean
  onToggleMessageTree?: () => void
  // LLM配置
  llmConfigs?: Array<{ id: string; name: string }>
  // 聊天页面对象
  chat?: Page
}

export default function ChatHeader({
  chatId,
  chatTitle,
  messages,
  currentPath = [],
  onCollapseAll,
  onExpandAll,
  onCollapseAI,
  messageTreeCollapsed = false,
  onToggleMessageTree,
  llmConfigs = [],
  chat
}: ChatHeaderProps) {
  const [isExportModalVisible, setIsExportModalVisible] = useState(false)
  const [selectMode, setSelectMode] = useState<'all' | 'current-path'>('current-path')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editingTitle, setEditingTitle] = useState(chatTitle || '')
  const [isHoveringTitle, setIsHoveringTitle] = useState(false)
  const inputRef = useRef<any>(null)
  const { message, modal } = App.useApp()
  const { updatePage } = usePagesStore()
  const { favoriteCurrentPage, items: favoriteItems } = useFavoritesStore()

  // 检查当前会话是否已被收藏
  const isFavorited = useMemo(() => {
    return favoriteItems.some(item =>
      item.type === 'page' &&
      item.source?.pageId === chatId
    )
  }, [favoriteItems, chatId])

  // 创建消息树实例
  const messageTree = useMemo(() => {
    return new MessageTree(messages)
  }, [messages])

  // 当进入编辑状态时，自动聚焦输入框
  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingTitle])

  // 更新编辑中的标题
  useEffect(() => {
    setEditingTitle(chatTitle || '')
  }, [chatTitle])

  // 处理编辑标题
  const handleEditTitle = () => {
    setIsEditingTitle(true)
  }

  // 保存标题
  const handleSaveTitle = () => {
    const trimmedTitle = editingTitle.trim()
    if (trimmedTitle && trimmedTitle !== chatTitle) {
      updatePage(chatId, { title: trimmedTitle })
      message.success('标题已更新')
    }
    setIsEditingTitle(false)
    setIsHoveringTitle(false)
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingTitle(chatTitle || '')
    setIsEditingTitle(false)
    setIsHoveringTitle(false)
  }

  // 处理按键事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  // 处理收藏会话
  const handleFavoritePage = () => {
    try {
      if (isFavorited) {
        message.info('此会话已在收藏夹中')
        return
      }

      const favoriteId = favoriteCurrentPage(chatId, undefined, chatTitle)
      modal.success({
        title: '添加成功',
        content: '会话已添加到收藏夹',
        okText: '确定'
      })
    } catch (error) {
      console.error('添加收藏失败:', error)
      modal.error({
        title: '添加失败',
        content: '添加到收藏夹失败，请重试',
        okText: '确定'
      })
    }
  }

  // 获取当前路径的消息
  const currentPathMessages = useMemo(() => {
    if (currentPath.length > 0) {
      return currentPath
        .map((id) => messages.find((msg) => msg.id === id))
        .filter(Boolean) as ChatMessage[]
    } else {
      return messageTree.getCurrentPathMessages()
    }
  }, [messages, currentPath, messageTree])

  const exportOptions: MenuProps['items'] = [
    {
      key: 'current-path',
      label: '导出当前对话路径',
      onClick: () => {
        setSelectMode('current-path')
        setIsExportModalVisible(true)
      }
    },
    {
      key: 'all-messages',
      label: '导出所有消息',
      onClick: () => {
        setSelectMode('all')
        setIsExportModalVisible(true)
      }
    }
  ]

  const collapseOptions: MenuProps['items'] = [
    {
      key: 'collapse-all',
      label: '折叠全部消息',
      onClick: onCollapseAll
    },
    {
      key: 'expand-all',
      label: '展开全部消息',
      onClick: onExpandAll
    },
    {
      key: 'collapse-ai',
      label: '仅折叠AI消息',
      onClick: onCollapseAI
    }
  ]

  const handleExport = async (selectedMessageIds: string[], exportSettings: ExportSettings) => {
    if (selectedMessageIds.length === 0) {
      message.warning('请选择要导出的消息')
      return
    }

    try {
      const selectedMessages = messages.filter((msg) => selectedMessageIds.includes(msg.id))

      // 根据时间戳排序消息
      selectedMessages.sort((a, b) => a.timestamp - b.timestamp)

      // 生成导出内容
      let exportContent = `# ${chatTitle || '聊天记录'}\n\n`
      if (exportSettings.includeMetadata) {
        exportContent += `导出时间: ${formatExactDateTime(Date.now())}\n`
        exportContent += `消息数量: ${selectedMessages.length}\n\n`
      }
      exportContent += '---\n\n'

      selectedMessages.forEach((msg, index) => {
        const role = msg.role === 'user' ? '用户' : 'AI助手'
        const timestamp = exportSettings.includeTimestamp ? formatExactDateTime(msg.timestamp) : ''
        const getModelDisplayName = (modelId?: string) => {
          if (!modelId) return ''
          const config = llmConfigs.find(config => config.id === modelId)
          return config?.name || modelId
        }
        const model = exportSettings.includeModelName && msg.modelId ? ` (${getModelDisplayName(msg.modelId)})` : ''

        exportContent += `## ${index + 1}. ${role}${model}\n`
        if (exportSettings.includeTimestamp) {
          exportContent += `时间: ${timestamp}\n\n`
        } else {
          exportContent += '\n'
        }

        if (exportSettings.includeReasoningContent && msg.reasoning_content) {
          exportContent += `**思考过程:**\n${msg.reasoning_content}\n\n`
        }

        exportContent += `${msg.content}\n\n`
        exportContent += '---\n\n'
      })

      // 使用 Electron 的文件系统API保存文件
      const now = new Date()
      const timeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
      const fileName = `${chatTitle || '聊天记录'}_${timeString}.txt`

      // 调用主进程保存文件
      const result = await window.api.saveFile({
        content: exportContent,
        defaultPath: fileName,
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'Markdown Files', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.success) {
        message.success(`导出成功: ${result.filePath}`)
        setIsExportModalVisible(false)
      } else if (result.cancelled) {
        // 用户取消了保存
      } else {
        message.error(`导出失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Export failed:', error)
      message.error('导出失败，请重试')
    }
  }


  // 获取文件夹路径
  const getFolderPath = (folderId: string | undefined): string => {
    const { folders } = usePagesStore.getState()
    if (!folderId) return '根目录'

    const path: string[] = []
    let currentFolderId: string | undefined = folderId

    while (currentFolderId) {
      const folder = folders.find(f => f.id === currentFolderId)
      if (!folder) break
      path.unshift(folder.name)
      currentFolderId = folder.parentId
    }

    return path.length > 0 ? path.join(' / ') : '根目录'
  }

  // 构建元数据提示内容
  const getMetadataTooltip = () => {
    if (!chat) return null

    const metadata: string[] = []

    // 基本信息
    metadata.push(`类型: ${chat.type === 'regular' ? '普通聊天' : chat.type === 'crosstab' ? '交叉表' : chat.type === 'object' ? '对象' : chat.type}`)
    metadata.push(`创建时间: ${formatExactDateTime(chat.createdAt)}`)
    metadata.push(`更新时间: ${formatExactDateTime(chat.updatedAt)}`)

    // 文件夹路径
    metadata.push(`文件夹: ${getFolderPath(chat.folderId)}`)

    // 固定信息
    if (chat.pinned) {
      metadata.push(`状态: 已固定`)
    }

    // 溯源信息
    if (chat.lineage) {
      metadata.push(`\n--- 溯源信息 ---`)
      const sourceMap = {
        'user': '用户创建',
        'object_to_crosstab': '对象→交叉表',
        'crosstab_to_chat': '交叉表→聊天',
        'object_to_chat': '对象→聊天',
        'chat_to_object': '聊天→对象',
        'other': '其他'
      }
      metadata.push(`来源: ${sourceMap[chat.lineage.source] || chat.lineage.source}`)
      if (chat.lineage.sourcePageId) {
        metadata.push(`源页面ID: ${chat.lineage.sourcePageId}`)
      }
      if (chat.lineage.description) {
        metadata.push(`描述: ${chat.lineage.description}`)
      }
      if (chat.lineage.generatedAt) {
        metadata.push(`生成时间: ${formatExactDateTime(chat.lineage.generatedAt)}`)
      }
      if (chat.lineage.generatedPageIds?.length > 0) {
        metadata.push(`衍生页面数: ${chat.lineage.generatedPageIds.length}`)
      }
    }

    // 消息统计
    if (messages.length > 0) {
      metadata.push(`\n--- 消息统计 ---`)
      metadata.push(`总消息数: ${messages.length}`)
      const userMessages = messages.filter(m => m.role === 'user').length
      const assistantMessages = messages.filter(m => m.role === 'assistant').length
      metadata.push(`用户消息: ${userMessages}`)
      metadata.push(`AI消息: ${assistantMessages}`)

      // 书签消息
      const bookmarkedMessages = messages.filter(m => m.isBookmarked).length
      if (bookmarkedMessages > 0) {
        metadata.push(`书签消息: ${bookmarkedMessages}`)
      }

      // 当前路径信息
      if (currentPath && currentPath.length > 0) {
        metadata.push(`当前对话路径: ${currentPath.length} 条消息`)
      }
    }

    return metadata.join('\n')
  }

  return (
    <>
      <div className="chat-header">
        <div className="chat-header-left">
          {isEditingTitle ? (
            <Input
              ref={inputRef}
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleKeyDown}
              style={{
                fontSize: '14px',
                fontWeight: 'bold',
                width: '300px'
              }}
              placeholder="输入标题"
            />
          ) : (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={() => setIsHoveringTitle(true)}
              onMouseLeave={() => setIsHoveringTitle(false)}
            >
              <Tooltip
                title={<pre style={{ margin: 0, fontSize: '12px' }}>{getMetadataTooltip()}</pre>}
                placement="bottomLeft"
                overlayStyle={{ maxWidth: '400px' }}
              >
                <h3 className="chat-title" style={{ cursor: 'help', margin: 0 }}>{chatTitle || '未命名聊天'}</h3>
              </Tooltip>
              <Tooltip title={isFavorited ? '已收藏' : '收藏会话'}>
                <Button
                  type="text"
                  size="small"
                  icon={isFavorited ? <StarFilled /> : <StarOutlined />}
                  onClick={handleFavoritePage}
                  style={{
                    opacity: isHoveringTitle || isFavorited ? 1 : 0,
                    transition: 'opacity 0.2s',
                    visibility: isHoveringTitle || isFavorited ? 'visible' : 'hidden',
                    color: isFavorited ? '#faad14' : undefined
                  }}
                />
              </Tooltip>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={handleEditTitle}
                style={{
                  opacity: isHoveringTitle ? 1 : 0,
                  transition: 'opacity 0.2s',
                  visibility: isHoveringTitle ? 'visible' : 'hidden'
                }}
              />
            </div>
          )}
        </div>
        <div className="chat-header-right">
          <Space>
            {/* 消息树切换按钮 */}
            {onToggleMessageTree && (
              <Button
                type="text"
                size="small"
                icon={<BranchesOutlined />}
                onClick={onToggleMessageTree}
                title={messageTreeCollapsed ? '展开消息树' : '收起消息树'}
              >
                消息树
              </Button>
            )}
            {/* 消息折叠/展开下拉按钮 */}
            {messages.length > 0 && (
              <Dropdown menu={{ items: collapseOptions }} trigger={['click']}>
                <Button type="text" size="small" icon={<DownOutlined />}>
                  折叠展开
                </Button>
              </Dropdown>
            )}
            <Dropdown menu={{ items: exportOptions }} trigger={['click']}>
              <Button icon={<ExportOutlined />} type="text">
                导出
              </Button>
            </Dropdown>
          </Space>
        </div>
      </div>

      <ExportModal
        visible={isExportModalVisible}
        onClose={() => setIsExportModalVisible(false)}
        chatTitle={chatTitle}
        messages={messages}
        currentPathMessages={currentPathMessages}
        selectMode={selectMode}
        onExport={handleExport}
        llmConfigs={llmConfigs}
      />
    </>
  )
}
