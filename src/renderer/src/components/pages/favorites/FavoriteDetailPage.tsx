import React, { useMemo } from 'react'
import { Card, Typography, Tag, Space, Button, Descriptions, Empty, Divider, message } from 'antd'
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
  FontSizeOutlined
} from '@ant-design/icons'
import { useFavoritesStore } from '../../../stores/favoritesStore'
import { usePagesStore } from '../../../stores/pagesStore'
import { useTabsStore } from '../../../stores/tabsStore'
import { Markdown } from '../../common/markdown/Markdown'
import './favorite-detail-page.css'

const { Title, Text, Paragraph } = Typography

interface FavoriteDetailPageProps {
  favoriteId: string
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
                <div className="messages-preview">
                  <Divider>
                    会话内容
                    <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
                      (当前分支，共 {pageSnapshot.messages.length} 条消息)
                    </Text>
                  </Divider>
                  <div className="favorite-messages-list">
                    {pageSnapshot.messages.map((msg, index) => (
                      <Card
                        key={msg.id}
                        size="small"
                        style={{ marginBottom: 12 }}
                        title={
                          <Space>
                            <Tag color={msg.role === 'user' ? 'green' : 'blue'}>
                              {msg.role === 'user' ? '用户' : 'AI'}
                            </Tag>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              {new Date(msg.timestamp).toLocaleString('zh-CN')}
                            </Text>
                          </Space>
                        }
                      >
                        {msg.reasoning_content && (
                          <>
                            <div style={{
                              color: '#666',
                              backgroundColor: '#fafafa',
                              padding: '8px 12px',
                              borderRadius: '4px',
                              marginBottom: '12px',
                              border: '1px solid #f0f0f0'
                            }}>
                              <Text strong style={{ fontSize: '12px', color: '#1890ff' }}>💡 思考过程</Text>
                              <div style={{ marginTop: '8px' }}>
                                <Markdown content={msg.reasoning_content} />
                              </div>
                            </div>
                          </>
                        )}
                        <Markdown content={msg.content} />
                      </Card>
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
              <Card size="small" title={`来自: ${pageTitle}`} style={{ marginBottom: 16 }}>
                <div className="message-content">
                  <Tag color={msg.role === 'user' ? 'green' : 'blue'} style={{ marginBottom: 8 }}>
                    {msg.role === 'user' ? '用户' : 'AI'}
                  </Tag>
                  <div style={{ marginTop: 8 }}>
                    <Markdown content={msg.content} />
                  </div>
                  {msg.reasoning_content && (
                    <>
                      <Divider>推理过程</Divider>
                      <div style={{ color: '#666', backgroundColor: '#fafafa', padding: '8px 12px', borderRadius: '4px' }}>
                        <Markdown content={msg.reasoning_content} />
                      </div>
                    </>
                  )}
                </div>
              </Card>

              {contextMessages && contextMessages.length > 0 && (
                <>
                  <Divider>上下文消息</Divider>
                  <div className="context-messages">
                    {contextMessages.map((ctxMsg) => (
                      <Card key={ctxMsg.id} size="small" style={{ marginBottom: 8 }}>
                        <Tag color={ctxMsg.role === 'user' ? 'green' : 'blue'} style={{ marginBottom: 8 }}>
                          {ctxMsg.role === 'user' ? '用户' : 'AI'}
                        </Tag>
                        <div style={{ marginTop: 8 }}>
                          <Markdown content={ctxMsg.content} />
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        }
        return null

      case 'text-fragment':
        if ('text' in favorite.data) {
          const { text, highlightedText, fullMessage, pageTitle } = favorite.data
          return (
            <div className="favorite-text-fragment-content">
              <Card size="small" title="选中的文本" style={{ marginBottom: 16 }}>
                <div
                  style={{
                    background: '#fff7e6',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #ffd591'
                  }}
                >
                  <Markdown content={text} />
                </div>
              </Card>

              <Card size="small" title={`完整消息 (来自: ${pageTitle})`}>
                <Tag color={fullMessage.role === 'user' ? 'green' : 'blue'} style={{ marginBottom: 8 }}>
                  {fullMessage.role === 'user' ? '用户' : 'AI'}
                </Tag>
                <div style={{ marginTop: 8 }}>
                  <Markdown content={highlightedText} />
                </div>
              </Card>
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
            {new Date(favorite.createdAt).toLocaleString('zh-CN')}
          </span>
          <span>
            <EyeOutlined /> 查看: {favorite.viewCount || 0} 次
          </span>
          {favorite.lastViewedAt && (
            <span>上次查看: {new Date(favorite.lastViewedAt).toLocaleString('zh-CN')}</span>
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
