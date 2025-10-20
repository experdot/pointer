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
  App
} from 'antd'
import { FolderOutlined, PlusOutlined, HeartFilled, CalendarOutlined } from '@ant-design/icons'
import { useFavoritesStore } from '../../../stores/favoritesStore'
import { FavoriteItem } from '../../../types/type'
import { formatExactDateTime } from '../../../utils/timeFormatter'

const { TextArea } = Input
const { Text, Title } = Typography

interface AddToFavoritesModalProps {
  visible: boolean
  onClose: () => void
  pageId: string
  pageTitle: string
  onSuccess?: () => void
}

export default function AddToFavoritesModal({
  visible,
  onClose,
  pageId,
  pageTitle,
  onSuccess
}: AddToFavoritesModalProps) {
  const { message } = App.useApp()
  const { folders, items, favoriteCurrentPage, createFolder } = useFavoritesStore()

  // 表单状态
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined)
  const [customTitle, setCustomTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // 查找该页面相关的已有收藏项
  const existingFavorites = useMemo(() => {
    return items.filter((item) => item.type === 'page' && item.source?.pageId === pageId)
  }, [items, pageId])

  // 重置表单
  useEffect(() => {
    if (visible) {
      setCustomTitle(pageTitle)
      setDescription('')
      setTags([])
      setSelectedFolderId(undefined)
      setIsCreatingFolder(false)
      setNewFolderName('')
    }
  }, [visible, pageTitle])

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
      message.warning('请输入文件夹名称')
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
      message.success('文件夹创建成功')
    } catch (error) {
      console.error('创建文件夹失败:', error)
      message.error('创建文件夹失败')
    }
  }

  // 处理添加到收藏
  const handleAddToFavorites = () => {
    try {
      if (!customTitle.trim()) {
        message.warning('请输入标题')
        return
      }

      const favoriteId = favoriteCurrentPage(pageId, selectedFolderId, customTitle.trim())

      // 如果有描述或标签，更新收藏项
      if (description.trim() || tags.length > 0) {
        useFavoritesStore.getState().updateFavorite(favoriteId, {
          description: description.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined
        })
      }

      message.success('添加到收藏成功')
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('添加到收藏失败:', error)
      message.error('添加到收藏失败，请重试')
    }
  }

  // 格式化收藏项显示
  const renderFavoriteItem = (item: FavoriteItem) => {
    const folderName = item.folderId
      ? folders.find((f) => f.id === item.folderId)?.name || '未知文件夹'
      : '根目录'

    return (
      <List.Item>
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <HeartFilled style={{ color: '#ff4d4f', fontSize: '14px' }} />
            <Text strong>{item.title}</Text>
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
      title="添加到收藏"
      open={visible}
      onCancel={onClose}
      onOk={handleAddToFavorites}
      width={600}
      okText="添加"
      cancelText="取消"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 已有收藏项提示 */}
        {existingFavorites.length > 0 && (
          <>
            <div>
              <Text type="warning" strong>
                此会话已有 {existingFavorites.length} 个收藏项：
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
