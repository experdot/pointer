import React, { useState, useMemo, useEffect } from 'react'
import {
  Modal,
  Input,
  Select,
  Divider,
  Button,
  Space,
  List,
  Typography,
  Tag,
  Empty,
  App,
  Switch
} from 'antd'
import {
  FolderOutlined,
  PlusOutlined,
  HeartFilled,
  CalendarOutlined,
  MessageOutlined
} from '@ant-design/icons'
import { useFavoritesStore } from '../../../stores/favoritesStore'
import { FavoriteItem, ChatMessage } from '../../../types/type'
import { formatExactDateTime } from '../../../utils/timeFormatter'

const { TextArea } = Input
const { Text, Title } = Typography

interface AddMessageToFavoritesModalProps {
  visible: boolean
  onClose: () => void
  chatId: string
  messageId: string
  message: ChatMessage
  pageTitle: string
  onSuccess?: () => void
}

export default function AddMessageToFavoritesModal({
  visible,
  onClose,
  chatId,
  messageId,
  message,
  pageTitle,
  onSuccess
}: AddMessageToFavoritesModalProps) {
  const { message: messageApi } = App.useApp()
  const { folders, items, favoriteMessage, createFolder } = useFavoritesStore()

  // 表单状态
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined)
  const [customTitle, setCustomTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [includeContext, setIncludeContext] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // 查找该消息相关的已有收藏项
  const existingFavorites = useMemo(() => {
    return items.filter(
      (item) =>
        (item.type === 'message' || item.type === 'text-fragment') &&
        item.source?.pageId === chatId &&
        item.source?.messageId === messageId
    )
  }, [items, chatId, messageId])

  // 重置表单
  useEffect(() => {
    if (visible) {
      // 使用消息内容的前30个字符作为默认标题
      const defaultTitle = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
      setCustomTitle(defaultTitle)
      setDescription('')
      setTags([])
      setIncludeContext(false)
      setSelectedFolderId(undefined)
      setIsCreatingFolder(false)
      setNewFolderName('')
    }
  }, [visible, message])

  // 文件夹选项
  const folderOptions = useMemo(() => {
    const buildFolderOptions = (parentId?: string, level = 0): any[] => {
      const childFolders = folders
        .filter((f) => f.parentId === parentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      const result: any[] = []
      childFolders.forEach((folder) => {
        result.push({
          label: '  '.repeat(level) + (level > 0 ? '└ ' : '') + folder.name,
          value: folder.id
        })
        result.push(...buildFolderOptions(folder.id, level + 1))
      })
      return result
    }

    return [{ label: '根目录', value: undefined }, ...buildFolderOptions()]
  }, [folders])

  // 处理创建新文件夹
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      messageApi.warning('请输入文件夹名称')
      return
    }

    try {
      const folderId = createFolder({
        name: newFolderName.trim(),
        parentId: selectedFolderId
      })
      setSelectedFolderId(folderId)
      setIsCreatingFolder(false)
      setNewFolderName('')
      messageApi.success('文件夹创建成功')
    } catch (error) {
      console.error('创建文件夹失败:', error)
      messageApi.error('创建文件夹失败')
    }
  }

  // 处理添加到收藏
  const handleAddToFavorites = () => {
    try {
      if (!customTitle.trim()) {
        messageApi.warning('请输入标题')
        return
      }

      const favoriteId = favoriteMessage(
        chatId,
        messageId,
        includeContext,
        selectedFolderId,
        customTitle.trim()
      )

      // 如果有描述或标签，更新收藏项
      if (description.trim() || tags.length > 0) {
        useFavoritesStore.getState().updateFavorite(favoriteId, {
          description: description.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined
        })
      }

      messageApi.success('添加到收藏成功')
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('添加到收藏失败:', error)
      messageApi.error('添加到收藏失败，请重试')
    }
  }

  // 格式化收藏项显示
  const renderFavoriteItem = (item: FavoriteItem) => {
    const folderName = item.folderId
      ? folders.find((f) => f.id === item.folderId)?.name || '未知文件夹'
      : '根目录'

    const typeLabel =
      item.type === 'message' ? '消息' : item.type === 'text-fragment' ? '文本片段' : item.type

    return (
      <List.Item>
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <HeartFilled style={{ color: '#ff4d4f', fontSize: '14px' }} />
            <Text strong>{item.title}</Text>
            <Tag color="blue">{typeLabel}</Tag>
            {item.starred && <Tag color="red">星标</Tag>}
          </div>
          {item.description && (
            <Text
              type="secondary"
              style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}
            >
              {item.description}
            </Text>
          )}
          <Space size="small" style={{ fontSize: '12px' }}>
            <Text type="secondary">
              <FolderOutlined /> {folderName}
            </Text>
            <Text type="secondary">
              <CalendarOutlined /> {formatExactDateTime(item.createdAt)}
            </Text>
          </Space>
          {item.tags && item.tags.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              {item.tags.map((tag) => (
                <Tag key={tag} style={{ fontSize: '11px' }}>
                  {tag}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </List.Item>
    )
  }

  return (
    <Modal
      title="添加消息到收藏"
      open={visible}
      onCancel={onClose}
      onOk={handleAddToFavorites}
      width={600}
      okText="添加"
      cancelText="取消"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 消息预览 */}
        <div
          style={{
            padding: '12px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            maxHeight: '120px',
            overflow: 'auto'
          }}
        >
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Space>
              <MessageOutlined />
              <Text strong>消息预览</Text>
              <Tag color={message.role === 'user' ? 'green' : 'blue'}>
                {message.role === 'user' ? '用户' : 'AI助手'}
              </Tag>
            </Space>
            <Text
              style={{
                fontSize: '12px',
                display: 'block',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {message.content.length > 200
                ? message.content.slice(0, 200) + '...'
                : message.content}
            </Text>
          </Space>
        </div>

        {/* 已有收藏项提示 */}
        {existingFavorites.length > 0 && (
          <>
            <div>
              <Text type="warning" strong>
                此消息已有 {existingFavorites.length} 个收藏项：
              </Text>
              <List
                size="small"
                dataSource={existingFavorites}
                renderItem={renderFavoriteItem}
                style={{
                  marginTop: '8px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}
              />
              <Text
                type="secondary"
                style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}
              >
                您可以继续添加新的收藏项
              </Text>
            </div>
            <Divider style={{ margin: 0 }} />
          </>
        )}

        {/* 标题 */}
        <div>
          <Text strong>标题 *</Text>
          <Input
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="输入收藏标题"
            maxLength={100}
            style={{ marginTop: '8px' }}
          />
        </div>

        {/* 包含上下文开关 */}
        <div>
          <Space>
            <Switch checked={includeContext} onChange={setIncludeContext} />
            <Text>包含上下文消息（前后各2条）</Text>
          </Space>
          <Text
            type="secondary"
            style={{ fontSize: '12px', display: 'block', marginTop: '4px', marginLeft: '50px' }}
          >
            启用后，将保存该消息前后各2条消息作为上下文参考
          </Text>
        </div>

        {/* 文件夹选择 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>文件夹</Text>
            {!isCreatingFolder && (
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setIsCreatingFolder(true)}
              >
                新建文件夹
              </Button>
            )}
          </div>
          {isCreatingFolder ? (
            <Space.Compact style={{ width: '100%', marginTop: '8px' }}>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="输入文件夹名称"
                onPressEnter={handleCreateFolder}
              />
              <Button type="primary" onClick={handleCreateFolder}>
                创建
              </Button>
              <Button
                onClick={() => {
                  setIsCreatingFolder(false)
                  setNewFolderName('')
                }}
              >
                取消
              </Button>
            </Space.Compact>
          ) : (
            <Select
              value={selectedFolderId}
              onChange={setSelectedFolderId}
              options={folderOptions}
              style={{ width: '100%', marginTop: '8px' }}
              placeholder="选择文件夹"
            />
          )}
        </div>

        {/* 描述 */}
        <div>
          <Text strong>描述</Text>
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="添加描述（可选）"
            rows={3}
            maxLength={500}
            style={{ marginTop: '8px' }}
          />
        </div>

        {/* 标签 */}
        <div>
          <Text strong>标签</Text>
          <Select
            mode="tags"
            value={tags}
            onChange={setTags}
            placeholder="添加标签（可选）"
            style={{ width: '100%', marginTop: '8px' }}
            maxTagCount={5}
          />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            按回车添加标签
          </Text>
        </div>
      </div>
    </Modal>
  )
}
