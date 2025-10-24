import React, { useMemo, useState, useEffect } from 'react'
import {
  Card,
  Typography,
  Tag,
  Space,
  Descriptions,
  Empty,
  Divider,
  message,
  Collapse,
  Image,
  Dropdown,
  App
} from 'antd'
import type { MenuProps } from 'antd'
import {
  LinkOutlined,
  MessageOutlined,
  FontSizeOutlined,
  BulbOutlined,
  UserOutlined,
  RobotOutlined,
  FileImageOutlined,
  CopyOutlined,
  PlusCircleOutlined
} from '@ant-design/icons'
import { useFavoritesStore } from '../../../stores/favoritesStore'
import { usePagesStore } from '../../../stores/pagesStore'
import { useTabsStore } from '../../../stores/tabsStore'
import { Markdown } from '../../common/markdown/Markdown'
import { RelativeTime } from '../../common/RelativeTime'
import { ChatMessage } from '../../../types/type'
import FavoriteDetailHeader from './FavoriteDetailHeader'
import './favorite-detail-page.css'

const { Title, Text, Paragraph } = Typography

interface FavoriteDetailPageProps {
  favoriteId: string
}

// 消息预览组件 - 与 MessageContent 保持一致的样式
interface MessagePreviewProps {
  message: ChatMessage
  showContext?: boolean
}

const MessagePreview: React.FC<MessagePreviewProps> = ({ message, showContext = true }) => {
  const [reasoningExpanded, setReasoningExpanded] = useState<string[]>([])
  const [attachmentUrls, setAttachmentUrls] = useState<Map<string, string>>(new Map())
  const { message: messageApi } = App.useApp()
  const { openTab } = useTabsStore()

  // 加载附件的预览 URL
  useEffect(() => {
    const loadAttachments = async () => {
      if (!message.attachments || message.attachments.length === 0) {
        setAttachmentUrls(new Map())
        return
      }

      const newUrls = new Map<string, string>()

      for (const attachment of message.attachments) {
        if (attachment.type.startsWith('image/')) {
          try {
            const result = await window.api.attachment.read(attachment.localPath)
            if (result.success && result.content) {
              const url = `data:${attachment.type};base64,${result.content}`
              newUrls.set(attachment.id, url)
            }
          } catch (error) {
            console.error('加载附件失败:', error)
          }
        }
      }

      setAttachmentUrls(newUrls)
    }

    loadAttachments()
  }, [message.attachments])

  // 处理复制
  const handleCopy = () => {
    const selection = window.getSelection()
    const selectedText = selection?.toString()

    if (selectedText && selectedText.trim()) {
      // 如果有选中文本，复制选中内容
      navigator.clipboard.writeText(selectedText)
      messageApi.success('已复制选中内容')
    } else {
      // 否则复制整个消息
      navigator.clipboard.writeText(message.content)
      messageApi.success('已复制消息内容')
    }
  }

  // 处理新建对话
  const handleCreateNewChat = () => {
    const selection = window.getSelection()
    const selectedText = selection?.toString()
    const contentToUse = selectedText && selectedText.trim() ? selectedText : message.content

    // 生成对话标题（取前30个字符）
    const title = contentToUse.length > 30 ? contentToUse.substring(0, 30) + '...' : contentToUse

    // 创建新对话并打开
    const { createChatWithInitialMessage } = usePagesStore.getState()
    const newChatId = createChatWithInitialMessage(title, contentToUse, undefined, undefined)

    // 切换到新创建的对话
    openTab(newChatId)

    messageApi.success('已创建新对话')
  }

  // 处理复制文本片段
  const handleCopyTextFragment = (content: string) => {
    const selection = window.getSelection()
    const selectedText = selection?.toString()

    if (selectedText && selectedText.trim()) {
      // 如果有选中文本，复制选中内容
      navigator.clipboard.writeText(selectedText)
      messageApi.success('已复制选中内容')
    } else {
      // 否则复制整个文本片段
      navigator.clipboard.writeText(content)
      messageApi.success('已复制文本片段')
    }
  }

  // 处理从文本片段新建对话
  const handleCreateNewChatFromTextFragment = (content: string) => {
    const selection = window.getSelection()
    const selectedText = selection?.toString()
    const contentToUse = selectedText && selectedText.trim() ? selectedText : content

    // 生成对话标题（取前30个字符）
    const title = contentToUse.length > 30 ? contentToUse.substring(0, 30) + '...' : contentToUse

    // 创建新对话并打开
    const { createChatWithInitialMessage } = usePagesStore.getState()
    const newChatId = createChatWithInitialMessage(title, contentToUse, undefined, undefined)

    // 切换到新创建的对话
    openTab(newChatId)

    messageApi.success('已创建新对话')
  }

  // 右键菜单项
  const getContextMenuItems = (): MenuProps['items'] => {
    return [
      {
        key: 'copy',
        label: '复制',
        icon: <CopyOutlined />,
        onClick: handleCopy
      },
      {
        type: 'divider'
      },
      {
        key: 'newChat',
        label: '新建对话',
        icon: <PlusCircleOutlined />,
        onClick: handleCreateNewChat
      }
    ]
  }

  return (
    <div className="favorite-message-preview">
      {/* 消息角色标签 */}
      <div className="message-preview-header">
        <Space>
          <Tag
            icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
            color={message.role === 'user' ? 'green' : 'blue'}
          >
            {message.role === 'user' ? '用户' : 'AI'}
          </Tag>
          <RelativeTime timestamp={message.timestamp} style={{ fontSize: '12px' }} />
        </Space>
      </div>

      {/* 文件附件显示 */}
      {message.attachments && message.attachments.length > 0 && (
        <div className="message-attachments">
          {message.attachments.map((attachment) => (
            <div key={attachment.id} className="attachment-item">
              {attachment.type.startsWith('image/') && attachmentUrls.get(attachment.id) ? (
                <div>
                  <Image
                    src={attachmentUrls.get(attachment.id)}
                    alt={attachment.name}
                    width={120}
                    height={120}
                    style={{ objectFit: 'cover', borderRadius: 2 }}
                    preview={{
                      mask: <div style={{ fontSize: 12 }}>预览</div>
                    }}
                  />
                  <div className="attachment-name">{attachment.name}</div>
                </div>
              ) : (
                <Space>
                  <FileImageOutlined />
                  <span style={{ fontSize: 12 }}>{attachment.name}</span>
                </Space>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 推理内容 */}
      {message.reasoning_content && (
        <Dropdown menu={{ items: getContextMenuItems() }} trigger={['contextMenu']}>
          <Card size="small" className="message-reasoning-card">
            <Collapse
              size="small"
              ghost
              activeKey={reasoningExpanded}
              onChange={(keys) => setReasoningExpanded(Array.isArray(keys) ? keys : [keys])}
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
                    <div className="reasoning-content">
                      <Markdown content={message.reasoning_content} />
                    </div>
                  )
                }
              ]}
            />
          </Card>
        </Dropdown>
      )}

      {/* 主要内容 */}
      <Dropdown menu={{ items: getContextMenuItems() }} trigger={['contextMenu']}>
        <Card size="small" className="message-card">
          <div className="message-body">
            <Markdown content={message.content} />
          </div>
        </Card>
      </Dropdown>
    </div>
  )
}

export default function FavoriteDetailPage({ favoriteId }: FavoriteDetailPageProps) {
  const { getFavoriteById, checkSourceExists } = useFavoritesStore()
  const { openTab } = useTabsStore()
  const { message: messageApi } = App.useApp()

  const favorite = useMemo(() => {
    return getFavoriteById(favoriteId)
  }, [favoriteId, getFavoriteById])

  // 处理复制文本片段
  const handleCopyTextFragment = (content: string) => {
    const selection = window.getSelection()
    const selectedText = selection?.toString()

    if (selectedText && selectedText.trim()) {
      // 如果有选中文本，复制选中内容
      navigator.clipboard.writeText(selectedText)
      messageApi.success('已复制选中内容')
    } else {
      // 否则复制整个文本片段
      navigator.clipboard.writeText(content)
      messageApi.success('已复制文本片段')
    }
  }

  // 处理从文本片段新建对话
  const handleCreateNewChatFromTextFragment = (content: string) => {
    const selection = window.getSelection()
    const selectedText = selection?.toString()
    const contentToUse = selectedText && selectedText.trim() ? selectedText : content

    // 生成对话标题（取前30个字符）
    const title = contentToUse.length > 30 ? contentToUse.substring(0, 30) + '...' : contentToUse

    // 创建新对话并打开
    const { createChatWithInitialMessage } = usePagesStore.getState()
    const newChatId = createChatWithInitialMessage(title, contentToUse, undefined, undefined)

    // 切换到新创建的对话
    openTab(newChatId)

    messageApi.success('已创建新对话')
  }

  // 获取文本片段的右键菜单项
  const getTextFragmentContextMenuItems = (content: string): MenuProps['items'] => {
    return [
      {
        key: 'copy',
        label: '复制',
        icon: <CopyOutlined />,
        onClick: () => handleCopyTextFragment(content)
      },
      {
        type: 'divider'
      },
      {
        key: 'newChat',
        label: '新建对话',
        icon: <PlusCircleOutlined />,
        onClick: () => handleCreateNewChatFromTextFragment(content)
      }
    ]
  }

  if (!favorite) {
    return (
      <div className="favorite-detail-page">
        <Empty description="收藏项不存在" />
      </div>
    )
  }

  const sourceExists = favorite.source ? checkSourceExists(favorite.source) : false

  // 处理跳转到源
  const handleNavigateToSource = () => {
    if (!favorite.source || !sourceExists) {
      message.warning('源已不存在')
      return
    }

    const { type, pageId, messageId } = favorite.source

    if (type === 'page' && pageId) {
      openTab(pageId)
    } else if (type === 'message' && pageId) {
      // 打开页面并选中消息
      const { updatePage } = usePagesStore.getState()
      updatePage(pageId, { selectedMessageId: messageId })
      openTab(pageId)
    }
  }

  
  // 渲染内容
  const renderContent = () => {
    switch (favorite.type) {
      case 'page':
        if ('pageSnapshot' in favorite.data) {
          const { pageSnapshot } = favorite.data
          // 获取源页面标题
          const sourcePageTitle = favorite.source?.pageTitle || pageSnapshot.title || '未命名页面'

          return (
            <div className="favorite-page-content">
              {/* 来源页面信息 */}
              {favorite.source && (
                <div className="source-info" style={{ marginBottom: 16 }}>
                  <Tag
                    icon={<LinkOutlined />}
                    color={sourceExists ? 'processing' : 'default'}
                    style={{
                      cursor: sourceExists ? 'pointer' : 'not-allowed',
                      textDecoration: sourceExists ? 'none' : 'line-through',
                      opacity: sourceExists ? 1 : 0.6
                    }}
                    onClick={sourceExists ? handleNavigateToSource : undefined}
                  >
                    来自: {sourcePageTitle}
                  </Tag>
                </div>
              )}

              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="页面类型">
                  {pageSnapshot.type === 'regular' && '普通聊天'}
                  {pageSnapshot.type === 'crosstab' && '交叉分析'}
                  {pageSnapshot.type === 'object' && '对象页面'}
                  {pageSnapshot.type === 'settings' && '设置'}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {new Date(pageSnapshot.createdAt).toLocaleString('zh-CN')}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {new Date(pageSnapshot.updatedAt).toLocaleString('zh-CN')}
                </Descriptions.Item>
                {pageSnapshot.type === 'regular' && pageSnapshot.messages && (
                  <Descriptions.Item label="消息数量">
                    {pageSnapshot.messages.length} 条
                  </Descriptions.Item>
                )}
              </Descriptions>

              {pageSnapshot.type === 'regular' && pageSnapshot.messages && (
                <div className="messages-preview-section">
                  <Divider orientation="center">
                    <Space>
                      <MessageOutlined />
                      <span>会话内容</span>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        (当前分支，共 {pageSnapshot.messages.length} 条消息)
                      </Text>
                    </Space>
                  </Divider>
                  <div className="favorite-messages-list">
                    {pageSnapshot.messages.map((msg, index) => (
                      <MessagePreview key={msg.id} message={msg} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        }
        return null

      case 'message':
        if ('message' in favorite.data) {
          const { message: msg, contextMessages, pageTitle } = favorite.data
          return (
            <div className="favorite-message-content">
              {/* 来源页面信息 */}
              <div className="source-info">
                <Tag
                  icon={<LinkOutlined />}
                  color={sourceExists ? 'processing' : 'default'}
                  style={{
                    cursor: sourceExists ? 'pointer' : 'not-allowed',
                    textDecoration: sourceExists ? 'none' : 'line-through',
                    opacity: sourceExists ? 1 : 0.6
                  }}
                  onClick={sourceExists ? handleNavigateToSource : undefined}
                >
                  来自: {pageTitle}
                </Tag>
              </div>

              {/* 主要消息 */}
              <div className="main-message">
                <MessagePreview message={msg} />
              </div>

              {/* 上下文消息 */}
              {contextMessages && contextMessages.length > 0 && (
                <div className="context-messages-section">
                  <Divider orientation="center">
                    <Space>
                      <MessageOutlined />
                      <span>上下文消息</span>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        ({contextMessages.length} 条)
                      </Text>
                    </Space>
                  </Divider>
                  <div className="context-messages-list">
                    {contextMessages.map((ctxMsg) => (
                      <MessagePreview key={ctxMsg.id} message={ctxMsg} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        }
        return null

      case 'text-fragment':
        if ('text' in favorite.data) {
          const { text, fullMessage, pageTitle } = favorite.data
          return (
            <div className="favorite-text-fragment-content">
              {/* 来源页面信息 */}
              <div className="source-info">
                <Tag
                  icon={<LinkOutlined />}
                  color={sourceExists ? 'processing' : 'default'}
                  style={{
                    cursor: sourceExists ? 'pointer' : 'not-allowed',
                    textDecoration: sourceExists ? 'none' : 'line-through',
                    opacity: sourceExists ? 1 : 0.6
                  }}
                  onClick={sourceExists ? handleNavigateToSource : undefined}
                >
                  来自: {pageTitle}
                </Tag>
              </div>

              {/* 选中的文本 */}
              <div className="selected-text-container">
                <div className="selected-text-label">
                  <Space>
                    <FontSizeOutlined />
                    <span>选中的文本</span>
                  </Space>
                </div>
                <Dropdown menu={{ items: getTextFragmentContextMenuItems(text) }} trigger={['contextMenu']}>
                  <div className="selected-text-highlight">
                    <Markdown content={text} />
                  </div>
                </Dropdown>
              </div>

              {/* 完整消息 */}
              <Divider orientation="center">完整消息</Divider>
              <MessagePreview message={fullMessage} />
            </div>
          )
        }
        return null

      default:
        return null
    }
  }

  return (
    <div className="favorite-detail-page">
      {/* 头部信息 */}
      <FavoriteDetailHeader
        favoriteId={favoriteId}
        sourceExists={sourceExists}
        onNavigateToSource={handleNavigateToSource}
      />

      {/* 主要内容区域 */}
      <div className="favorite-main-content">
        {/* 描述 */}
        {favorite.description && (
          <Card size="small" title="描述" style={{ marginBottom: 16 }}>
            <Markdown content={favorite.description} />
          </Card>
        )}

        {/* 笔记 */}
        {favorite.notes && (
          <Card size="small" title="笔记" style={{ marginBottom: 16 }}>
            <Markdown content={favorite.notes} />
          </Card>
        )}

        {/* 内容 */}
        {renderContent()}

        {/* 溯源信息 */}
        {favorite.source && (
          <Card
            size="small"
            title="溯源信息"
            style={{ marginTop: 16 }}
            extra={
              <Tag
                icon={<LinkOutlined />}
                color={sourceExists ? 'success' : 'error'}
                style={{
                  cursor: sourceExists ? 'pointer' : 'not-allowed',
                  textDecoration: sourceExists ? 'none' : 'line-through'
                }}
                onClick={sourceExists ? handleNavigateToSource : undefined}
              >
                {sourceExists ? '跳转到源' : '源已删除'}
              </Tag>
            }
          >
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="源类型">
                {favorite.source.type === 'page' ? '页面' : '消息'}
              </Descriptions.Item>
              {favorite.source.pageTitle && (
                <Descriptions.Item label="源页面">
                  <span
                    style={{
                      textDecoration: sourceExists ? 'none' : 'line-through',
                      opacity: sourceExists ? 1 : 0.6
                    }}
                  >
                    {favorite.source.pageTitle}
                  </span>
                </Descriptions.Item>
              )}
              {favorite.source.pageType && (
                <Descriptions.Item label="页面类型">
                  {favorite.source.pageType === 'regular' && '普通聊天'}
                  {favorite.source.pageType === 'crosstab' && '交叉分析'}
                  {favorite.source.pageType === 'object' && '对象页面'}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="收藏时间">
                {new Date(favorite.source.timestamp).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </div>
    </div>
  )
}
