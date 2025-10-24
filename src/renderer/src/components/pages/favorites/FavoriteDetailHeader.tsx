import React, { useState, useRef, useEffect } from 'react'
import { Button, Space, App, Tooltip, Input, Dropdown } from 'antd'
import {
  StarOutlined,
  StarFilled,
  EditOutlined,
  LinkOutlined,
  DeleteOutlined,
  MoreOutlined,
  ClockCircleOutlined,
  ExportOutlined
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { FavoriteItem, ChatMessage } from '../../../types/type'
import { RelativeTime } from '../../common/RelativeTime'
import { useFavoritesStore } from '../../../stores/favoritesStore'
import { usePagesStore } from '../../../stores/pagesStore'
import { useTabsStore } from '../../../stores/tabsStore'
import ExportModal, { ExportSettings } from '../chat/ExportModal'
import { formatExactDateTime } from '../../../utils/timeFormatter'

interface FavoriteDetailHeaderProps {
  favoriteId: string
  sourceExists: boolean
  onNavigateToSource: () => void
}

export default function FavoriteDetailHeader({
  favoriteId,
  sourceExists,
  onNavigateToSource
}: FavoriteDetailHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isHoveringTitle, setIsHoveringTitle] = useState(false)
  const [isExportModalVisible, setIsExportModalVisible] = useState(false)
  const inputRef = useRef<any>(null)
  const { message } = App.useApp()
  const { getFavoriteById, toggleStarFavorite, updateFavorite, deleteFavorite } = useFavoritesStore()
  const { closeTab } = useTabsStore()

  // 直接从 store 获取最新的 favorite 数据，确保状态同步
  const favorite = getFavoriteById(favoriteId)
  const [editingTitle, setEditingTitle] = useState(favorite?.title || '')

  // 当进入编辑状态时，自动聚焦输入框
  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingTitle])

  // 更新编辑中的标题
  useEffect(() => {
    if (favorite) {
      setEditingTitle(favorite.title)
    }
  }, [favorite?.title])

  // 处理编辑标题
  const handleEditTitle = () => {
    setIsEditingTitle(true)
  }

  // 保存标题
  const handleSaveTitle = () => {
    if (!favorite) return
    const trimmedTitle = editingTitle.trim()
    if (trimmedTitle && trimmedTitle !== favorite.title) {
      updateFavorite(favorite.id, { title: trimmedTitle })
      message.success('标题已更新')
    }
    setIsEditingTitle(false)
    setIsHoveringTitle(false)
  }

  // 取消编辑
  const handleCancelEdit = () => {
    if (favorite) {
      setEditingTitle(favorite.title)
    }
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

  // 处理星标切换
  const handleToggleStar = () => {
    if (!favorite) return
    toggleStarFavorite(favorite.id)
  }

  // 处理删除
  const handleDelete = () => {
    if (!favorite) return
    deleteFavorite(favorite.id)
    closeTab(`favorite-${favorite.id}`)
    message.success('已删除收藏')
  }

  if (!favorite) {
    return null
  }

  // 获取要导出的消息
  const getExportMessages = (): ChatMessage[] => {
    if (favorite.type === 'page' && 'pageSnapshot' in favorite.data) {
      return favorite.data.pageSnapshot.messages || []
    } else if (favorite.type === 'message' && 'message' in favorite.data) {
      // 包含主消息和上下文消息
      const messages: ChatMessage[] = [favorite.data.message]
      if (favorite.data.contextMessages) {
        messages.push(...favorite.data.contextMessages)
      }
      return messages
    } else if (favorite.type === 'text-fragment' && 'fullMessage' in favorite.data) {
      return [favorite.data.fullMessage]
    }
    return []
  }

  // 处理导出
  const handleExport = async (selectedMessageIds: string[], exportSettings: ExportSettings) => {
    if (selectedMessageIds.length === 0) {
      message.warning('请选择要导出的消息')
      return
    }

    try {
      const allMessages = getExportMessages()
      const selectedMessages = allMessages.filter((msg) => selectedMessageIds.includes(msg.id))

      // 根据时间戳排序消息
      selectedMessages.sort((a, b) => a.timestamp - b.timestamp)

      // 生成导出内容
      let exportContent = `# ${favorite.title}\n\n`
      if (exportSettings.includeMetadata) {
        exportContent += `收藏类型: ${getTypeText()}\n`
        exportContent += `导出时间: ${formatExactDateTime(Date.now())}\n`
        exportContent += `消息数量: ${selectedMessages.length}\n\n`
      }
      exportContent += '---\n\n'

      selectedMessages.forEach((msg, index) => {
        const role = msg.role === 'user' ? '用户' : 'AI助手'
        const timestamp = exportSettings.includeTimestamp ? formatExactDateTime(msg.timestamp) : ''
        const model = exportSettings.includeModelName && msg.modelId ? ` (${msg.modelId})` : ''

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
      const fileName = `${favorite.title}_${timeString}.txt`

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

  // 处理打开导出弹窗
  const handleOpenExport = () => {
    const messages = getExportMessages()
    if (messages.length === 0) {
      message.warning('没有可导出的消息')
      return
    }
    setIsExportModalVisible(true)
  }

  // 渲染类型标签文本
  const getTypeText = () => {
    const typeMap = {
      page: '页面',
      message: '消息',
      'text-fragment': '文本片段'
    }
    return typeMap[favorite.type] || favorite.type
  }

  // 构建元数据提示内容
  const getMetadataTooltip = () => {
    const metadata: string[] = []

    // 基本信息
    metadata.push(`类型: ${getTypeText()}`)
    metadata.push(`收藏时间: ${new Date(favorite.createdAt).toLocaleString('zh-CN')}`)

    // 标签
    if (favorite.tags && favorite.tags.length > 0) {
      metadata.push(`\n--- 标签 ---`)
      metadata.push(favorite.tags.join(', '))
    }

    // 溯源信息
    if (favorite.source) {
      metadata.push(`\n--- 溯源信息 ---`)
      metadata.push(`源类型: ${favorite.source.type === 'page' ? '页面' : '消息'}`)
      if (favorite.source.pageTitle) {
        metadata.push(`源页面: ${favorite.source.pageTitle}`)
      }
      metadata.push(`状态: ${sourceExists ? '源存在' : '源已删除'}`)
    }

    return metadata.join('\n')
  }

  const moreOptions: MenuProps['items'] = [
    {
      key: 'navigate',
      label: '跳转到源',
      icon: <LinkOutlined />,
      onClick: onNavigateToSource,
      disabled: !sourceExists
    },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: handleDelete
    }
  ]

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
                <h3 className="chat-title" style={{ cursor: 'help', margin: 0 }}>
                  {favorite.title}
                </h3>
              </Tooltip>
              <Tooltip title={favorite.starred ? '取消星标' : '添加星标'}>
                <Button
                  type="text"
                  size="small"
                  icon={favorite.starred ? <StarFilled /> : <StarOutlined />}
                  onClick={handleToggleStar}
                  style={{
                    opacity: isHoveringTitle || favorite.starred ? 1 : 0,
                    transition: 'opacity 0.2s',
                    visibility: isHoveringTitle || favorite.starred ? 'visible' : 'hidden',
                    color: favorite.starred ? '#faad14' : undefined
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
            {/* 导出按钮 */}
            {getExportMessages().length > 0 && (
              <Button icon={<ExportOutlined />} type="text" onClick={handleOpenExport}>
                导出
              </Button>
            )}

            {/* 更多选项按钮 */}
            <Dropdown menu={{ items: moreOptions }} trigger={['click']}>
              <Button type="text" icon={<MoreOutlined />}></Button>
            </Dropdown>
          </Space>
        </div>
      </div>

      {/* 导出弹窗 */}
      <ExportModal
        visible={isExportModalVisible}
        onClose={() => setIsExportModalVisible(false)}
        chatTitle={favorite.title}
        messages={getExportMessages()}
        currentPathMessages={getExportMessages()}
        selectMode="all"
        onExport={handleExport}
        llmConfigs={[]}
      />
    </>
  )
}
