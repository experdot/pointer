import React, { useState, useEffect } from 'react'
import { Button, Dropdown, Space, Typography, Tooltip, Input, Badge, Modal, TreeSelect } from 'antd'
import {
  FolderOutlined,
  FolderOpenOutlined,
  MessageOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  FolderAddOutlined,
  CopyOutlined,
  SearchOutlined,
  FolderOpenFilled
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Page, PageFolder } from '../../../../types/type'

const { Text } = Typography

interface ChatHistoryTreeNodeProps {
  type: 'folder' | 'chat'
  data: PageFolder | Page
  isEditing?: boolean
  onEdit?: () => void
  onDelete?: () => void
  onClear?: () => void
  onCopy?: () => void
  onCreate?: (type: 'folder' | 'chat') => void
  onChatClick?: (chatId: string) => void
  onSaveEdit?: (nodeId: string, nodeType: 'folder' | 'chat', newValue: string) => void
  onStartEdit?: () => void
  onEndEdit?: () => void
  onFindInFolder?: () => void
  onMoveTo?: (targetFolderId: string | undefined) => void
  allFolders?: PageFolder[]
}

const ChatHistoryTreeNode = React.memo(function ChatHistoryTreeNode({
  type,
  data,
  isEditing,
  onEdit,
  onDelete,
  onClear,
  onCopy,
  onCreate,
  onChatClick,
  onSaveEdit,
  onStartEdit,
  onEndEdit,
  onFindInFolder,
  onMoveTo,
  allFolders = []
}: ChatHistoryTreeNodeProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isInlineEditing, setIsInlineEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [selectedTargetFolder, setSelectedTargetFolder] = useState<string | undefined>(undefined)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (type === 'chat' && onChatClick) {
      onChatClick(data.id)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    startInlineEdit()
  }

  const startInlineEdit = () => {
    const currentName = getName()
    setEditValue(currentName)
    setIsInlineEditing(true)
    onStartEdit?.()
  }

  const handleSaveEdit = () => {
    if (editValue.trim() && onSaveEdit) {
      onSaveEdit(data.id, type, editValue.trim())
    }
    setIsInlineEditing(false)
    onEndEdit?.()
  }

  const handleCancelEdit = () => {
    setIsInlineEditing(false)
    setEditValue('')
    onEndEdit?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const handleShowMoveModal = () => {
    // 初始化选中值为当前所在的文件夹
    if (type === 'folder') {
      const parentId = (data as PageFolder).parentId
      setSelectedTargetFolder(parentId === undefined ? 'ROOT' : parentId)
    } else {
      const folderId = (data as Page).folderId
      setSelectedTargetFolder(folderId === undefined ? 'ROOT' : folderId)
    }

    setShowMoveModal(true)
  }

  const handleConfirmMove = () => {
    if (onMoveTo) {
      // 将'ROOT'转换为undefined表示根目录
      const targetFolder = selectedTargetFolder === 'ROOT' ? undefined : selectedTargetFolder
      onMoveTo(targetFolder)
    }
    setShowMoveModal(false)
  }

  const handleCancelMove = () => {
    setShowMoveModal(false)
    setSelectedTargetFolder(undefined)
  }

  // 构建文件夹树数据（用于TreeSelect）
  const buildFolderTreeData = () => {
    const buildTree = (parentId?: string): any[] => {
      const children = allFolders
        .filter(folder => {
          // 过滤掉当前节点（不能移动到自己）
          if (type === 'folder' && folder.id === data.id) {
            return false
          }
          // 如果是文件夹，还要过滤掉所有子文件夹（防止循环引用）
          if (type === 'folder') {
            let current = folder
            while (current.parentId) {
              if (current.parentId === data.id) {
                return false
              }
              current = allFolders.find(f => f.id === current.parentId)!
              if (!current) break
            }
          }
          return folder.parentId === parentId
        })
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      return children.map(folder => ({
        title: folder.name,
        value: folder.id,
        children: buildTree(folder.id)
      }))
    }

    return buildTree()
  }

  const getMenuItems = (): MenuProps['items'] => {
    if (type === 'folder') {
      return [
        {
          key: 'addChat',
          label: '新建聊天',
          icon: <MessageOutlined />,
          onClick: () => onCreate?.('chat')
        },
        {
          key: 'addFolder',
          label: '新建文件夹',
          icon: <FolderAddOutlined />,
          onClick: () => onCreate?.('folder')
        },
        {
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          onClick: () => startInlineEdit()
        },
        {
          key: 'moveTo',
          label: '移动至...',
          icon: <FolderOpenFilled />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation()
            handleShowMoveModal()
          }
        },
        {
          type: 'divider'
        },
        {
          key: 'findInFolder',
          label: '在文件夹中查找',
          icon: <SearchOutlined />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation()
            onFindInFolder?.()
          }
        },
        {
          type: 'divider'
        },
        {
          key: 'clear',
          label: '清空文件夹',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: (e) => {
            e?.domEvent?.stopPropagation()
            onClear?.()
          }
        },
        {
          key: 'delete',
          label: '删除文件夹',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: (e) => {
            e?.domEvent?.stopPropagation()
            onDelete?.()
          }
        }
      ]
    } else {
      return [
        {
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          onClick: () => startInlineEdit()
        },
        {
          key: 'copy',
          label: '复制聊天',
          icon: <CopyOutlined />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation()
            onCopy?.()
          }
        },
        {
          key: 'moveTo',
          label: '移动至...',
          icon: <FolderOpenFilled />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation()
            handleShowMoveModal()
          }
        },
        {
          type: 'divider'
        },
        {
          key: 'delete',
          label: '删除聊天',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: (e) => {
            e?.domEvent?.stopPropagation()
            onDelete?.()
          }
        }
      ]
    }
  }

  const getIcon = () => {
    if (type === 'folder') {
      const folder = data as PageFolder
      return folder.expanded ? <FolderOpenOutlined /> : <FolderOutlined />
    }
    return <MessageOutlined />
  }

  const getName = () => {
    return type === 'folder' ? (data as PageFolder).name : (data as Page).title
  }

  // 获取聊天状态指示器的颜色和状态文本
  const getChatStatus = () => {
    if (type !== 'chat') return null

    const chat = data as Page
    const messageCount = chat.messages?.length || 0
    const hasStreamingMessage = !!chat.streamingMessage
    const hasStreamingInMessages = chat.messages?.some((msg) => msg.isStreaming) || false
    const isStreaming = hasStreamingMessage || hasStreamingInMessages

    if (isStreaming) {
      return {
        status: 'processing' as const, // 蓝色，带动画
        text: '正在生成中'
      }
    } else if (messageCount > 1) {
      return {
        status: 'success' as const, // 绿色
        text: '已完成对话'
      }
    } else {
      return {
        status: 'default' as const, // 灰色
        text: '未开始对话'
      }
    }
  }

  const chatStatus = getChatStatus()

  return (
    <div
      className={`tree-node tree-node-${type}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      draggable={false}
      onMouseDown={(e) => {
        // 阻止编辑状态下的拖动
        if (isInlineEditing) {
          e.stopPropagation()
        }
      }}
    >
      <div className="tree-node-content">
        <div className="tree-node-icon">{getIcon()}</div>
        {chatStatus && (
          <Tooltip title={chatStatus.text}>
            <Badge status={chatStatus.status} />
          </Tooltip>
        )}
        <div className="tree-node-title">
          {isInlineEditing ? (
            <Input
              size="small"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={(e) => {
                handleSaveEdit()
              }}
              onKeyDown={handleKeyDown}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{ width: '100%' }}
            />
          ) : (
            <Text
              ellipsis
              style={{
                display: 'block',
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {getName()}
            </Text>
          )}
        </div>
      </div>

      {(isHovered || isEditing) && (
        <div className="tree-node-actions">
          {type === 'folder' && onCreate && (
            <>
              <Tooltip title="新建文件夹">
                <Button
                  type="text"
                  size="small"
                  icon={<FolderAddOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreate('folder')
                  }}
                />
              </Tooltip>
              <Tooltip title="新建聊天">
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreate('chat')
                  }}
                />
              </Tooltip>
            </>
          )}
          <Dropdown menu={{ items: getMenuItems() }} trigger={['click']} placement="bottomRight">
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        </div>
      )}

      {/* 移动到文件夹的模态框 */}
      <Modal
        title={`移动${type === 'folder' ? '文件夹' : '聊天'}至...`}
        open={showMoveModal}
        onOk={handleConfirmMove}
        onCancel={handleCancelMove}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        key={showMoveModal ? `modal-${allFolders.length}` : 'modal-closed'}
      >
        <div style={{ marginBottom: 16 }}>
          <TreeSelect
            style={{ width: '100%' }}
            value={selectedTargetFolder}
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
            placeholder="选择目标文件夹"
            allowClear
            treeDefaultExpandAll
            treeData={[
              {
                title: '根目录',
                value: 'ROOT',
                selectable: true,
                children: buildFolderTreeData()
              }
            ]}
            onChange={(value) => setSelectedTargetFolder(value === 'ROOT' ? undefined : value)}
          />
        </div>
        <div style={{ color: '#666', fontSize: '12px' }}>
          {type === 'folder'
            ? '注意：不能将文件夹移动到自身或其子文件夹中'
            : '提示：选择目标文件夹后，聊天将被移动到该文件夹中'}
        </div>
      </Modal>
    </div>
  )
}, (prevProps, nextProps) => {
  // 自定义比较函数，只在关键属性变化时重新渲染
  if (
    prevProps.type !== nextProps.type ||
    prevProps.data.id !== nextProps.data.id ||
    prevProps.isEditing !== nextProps.isEditing
  ) {
    return false
  }

  // 检查 allFolders 是否变化（用于移动功能）
  if (prevProps.allFolders?.length !== nextProps.allFolders?.length) {
    return false
  }

  if (prevProps.type === 'folder') {
    const prevFolder = prevProps.data as PageFolder
    const nextFolder = nextProps.data as PageFolder
    return prevFolder.name === nextFolder.name && prevFolder.expanded === nextFolder.expanded
  } else {
    const prevPage = prevProps.data as Page
    const nextPage = nextProps.data as Page

    // 检查标题是否变化
    if (prevPage.title !== nextPage.title) {
      return false
    }

    // 检查消息数量是否变化
    if (prevPage.messages?.length !== nextPage.messages?.length) {
      return false
    }

    // 检查 streamingMessage 状态是否变化
    if (!!(prevPage.streamingMessage) !== !!(nextPage.streamingMessage)) {
      return false
    }

    // 检查是否有任何消息的 isStreaming 状态发生变化
    // 需要更精确的比较：计算实际的流式消息数量
    const prevStreamingCount = prevPage.messages?.filter(msg => msg.isStreaming)?.length || 0
    const nextStreamingCount = nextPage.messages?.filter(msg => msg.isStreaming)?.length || 0

    if (prevStreamingCount !== nextStreamingCount) {
      return false
    }

    return true
  }
})

export default ChatHistoryTreeNode
