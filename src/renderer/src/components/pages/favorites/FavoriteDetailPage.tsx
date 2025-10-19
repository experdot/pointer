import React, { useMemo, useState, useEffect } from 'react'
import {
  Card,
  Typography,
  Tag,
  Space,
  Button,
  Descriptions,
  Empty,
  Divider,
  message,
  Collapse,
  Image
} from 'antd'
import {
  ClockCircleOutlined,
  EyeOutlined,
  StarFilled,
  StarOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  FileOutlined,
  MessageOutlined,
  FontSizeOutlined,
  BulbOutlined,
  UserOutlined,
  RobotOutlined,
  FileImageOutlined
} from '@ant-design/icons'
import { useFavoritesStore } from '../../../stores/favoritesStore'
import { usePagesStore } from '../../../stores/pagesStore'
import { useTabsStore } from '../../../stores/tabsStore'
import { Markdown } from '../../common/markdown/Markdown'
import { RelativeTime } from '../../common/RelativeTime'
import { ChatMessage, FileAttachment } from '../../../types/type'
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
      )}

      {/* 主要内容 */}
      <Card size="small" className="message-card">
        <div className="message-body">
          <Markdown content={message.content} />
        </div>
      </Card>
    </div>
  )
}

export default function FavoriteDetailPage({ favoriteId }: FavoriteDetailPageProps) {
  const {
    getFavoriteById,
    togglePinFavorite,
    deleteFavorite,
    checkSourceExists,
    incrementViewCount
  } = useFavoritesStore()
  const { pages } = usePagesStore()
  const { openTab, closeTab } = useTabsStore()

  const favorite = useMemo(() => {
    const fav = getFavoriteById(favoriteId)
    if (fav) {
      // 增加查看次数
      incrementViewCount(favoriteId)
    }
    return fav
  }, [favoriteId, getFavoriteById])

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

  // 处理置顶切换
  const handleTogglePin = () => {
    togglePinFavorite(favoriteId)
  }

  // 处理删除
  const handleDelete = () => {
    deleteFavorite(favoriteId)
    closeTab(`favorite-${favoriteId}`)
    message.success('已删除收藏')
  }

  // 渲染图标
  const renderIcon = () => {
    switch (favorite.type) {
      case 'page':
        return <FileOutlined style={{ fontSize: 24, color: '#1890ff' }} />
      case 'message':
        return <MessageOutlined style={{ fontSize: 24, color: '#52c41a' }} />
      case 'text-fragment':
        return <FontSizeOutlined style={{ fontSize: 24, color: '#faad14' }} />
      default:
        return <FileOutlined style={{ fontSize: 24 }} />
    }
  }

  // 渲染类型标签
  const renderTypeTag = () => {
    const typeMap = {
      page: { text: '页面', color: 'blue' },
      message: { text: '消息', color: 'green' },
      'text-fragment': { text: '文本片段', color: 'orange' }
    }
    const typeInfo = typeMap[favorite.type]
    return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>
  }

  // 渲染内容
  const renderContent = () => {
    switch (favorite.type) {
      case 'page':
        if ('pageSnapshot' in favorite.data) {
          const { pageSnapshot } = favorite.data
          return (
            <div className="favorite-page-content">
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
                  <Divider orientation="left">
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
                <Tag icon={<LinkOutlined />} color="processing">
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
                  <Divider orientation="left">
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
                <Tag icon={<LinkOutlined />} color="processing">
                  来自: {pageTitle}
                </Tag>
              </div>

              {/* 选中的文本 */}
              <Card
                size="small"
                className="selected-text-card"
                title={
                  <Space>
                    <FontSizeOutlined />
                    <span>选中的文本</span>
                  </Space>
                }
              >
                <div className="selected-text-highlight">
                  <Markdown content={text} />
                </div>
              </Card>

              {/* 完整消息 */}
              <Divider orientation="left">完整消息</Divider>
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
      <div className="favorite-header">
        <div className="favorite-header-left">
          {renderIcon()}
          <div className="favorite-title-section">
            <div className="favorite-title-row">
              <Title level={3} style={{ margin: 0 }}>
                {favorite.title}
              </Title>
              {favorite.pinned && <StarFilled style={{ color: '#faad14', fontSize: 20 }} />}
            </div>
            <Space size="small" style={{ marginTop: 8 }}>
              {renderTypeTag()}
              {favorite.tags?.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </Space>
          </div>
        </div>

        <div className="favorite-actions">
          <Button
            icon={favorite.pinned ? <StarFilled /> : <StarOutlined />}
            onClick={handleTogglePin}
          >
            {favorite.pinned ? '取消置顶' : '置顶'}
          </Button>
          {sourceExists && (
            <Button icon={<LinkOutlined />} onClick={handleNavigateToSource}>
              跳转到源
            </Button>
          )}
          <Button icon={<DeleteOutlined />} danger onClick={handleDelete}>
            删除
          </Button>
        </div>
      </div>

      {/* 元信息 */}
      <div className="favorite-meta">
        <Space split={<Divider type="vertical" />}>
          <span>
            <ClockCircleOutlined /> 收藏于:{' '}
            <RelativeTime timestamp={favorite.createdAt} />
          </span>
          <span>
            <EyeOutlined /> 查看: {favorite.viewCount || 0} 次
          </span>
          {favorite.lastViewedAt && (
            <span>
              上次查看: <RelativeTime timestamp={favorite.lastViewedAt} />
            </span>
          )}
        </Space>
      </div>

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

      {/* 主要内容 */}
      <div className="favorite-main-content">{renderContent()}</div>

      {/* 溯源信息 */}
      {favorite.source && (
        <Card
          size="small"
          title="溯源信息"
          style={{ marginTop: 16 }}
          extra={
            sourceExists ? <Tag color="success">源存在</Tag> : <Tag color="error">源已删除</Tag>
          }
        >
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="源类型">
              {favorite.source.type === 'page' ? '页面' : '消息'}
            </Descriptions.Item>
            {favorite.source.pageTitle && (
              <Descriptions.Item label="源页面">{favorite.source.pageTitle}</Descriptions.Item>
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
  )
}
