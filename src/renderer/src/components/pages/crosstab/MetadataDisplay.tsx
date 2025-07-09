import React, { useState } from 'react'
import { Card, Button, Typography, Tag, Space, Spin } from 'antd'
import {
  EditOutlined,
  BorderOutlined,
  BulbOutlined,
  LoadingOutlined,
  UpOutlined,
  DownOutlined
} from '@ant-design/icons'
import { CrosstabMetadata } from '../../../types'

const { Text } = Typography

interface MetadataDisplayProps {
  metadata: CrosstabMetadata | null
  onEditMetadata: () => void
  onGenerateTopicSuggestions?: () => void
  onGenerateHorizontalSuggestions?: () => void
  onGenerateVerticalSuggestions?: () => void
  onGenerateValueSuggestions?: () => void
  onSelectTopicSuggestion?: (suggestion: string) => void
  onSelectHorizontalSuggestion?: (suggestion: string) => void
  onSelectVerticalSuggestion?: (suggestion: string) => void
  onSelectValueSuggestion?: (suggestion: string) => void
  isGeneratingTopicSuggestions?: boolean
  isGeneratingHorizontalSuggestions?: boolean
  isGeneratingVerticalSuggestions?: boolean
  isGeneratingValueSuggestions?: boolean
}

export default function MetadataDisplay({
  metadata,
  onEditMetadata,
  onGenerateTopicSuggestions,
  onGenerateHorizontalSuggestions,
  onGenerateVerticalSuggestions,
  onGenerateValueSuggestions,
  onSelectTopicSuggestion,
  onSelectHorizontalSuggestion,
  onSelectVerticalSuggestion,
  onSelectValueSuggestion,
  isGeneratingTopicSuggestions,
  isGeneratingHorizontalSuggestions,
  isGeneratingVerticalSuggestions,
  isGeneratingValueSuggestions
}: MetadataDisplayProps) {
  const [topicSuggestionsCollapsed, setTopicSuggestionsCollapsed] = useState(false)
  const [horizontalSuggestionsCollapsed, setHorizontalSuggestionsCollapsed] = useState(false)
  const [verticalSuggestionsCollapsed, setVerticalSuggestionsCollapsed] = useState(false)
  const [valueSuggestionsCollapsed, setValueSuggestionsCollapsed] = useState(false)
  if (!metadata) {
    return (
      <Card className="tab-card">
        <div className="empty-state">
          <BorderOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <div>
            <Text type="secondary">尚未生成主题结构</Text>
            <br />
            <Text type="secondary">请先在"输入主题"页面输入主题并点击"分析主题"按钮</Text>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card
      title="主题结构分析"
      className="tab-card"
      extra={
        <Button type="text" icon={<EditOutlined />} onClick={onEditMetadata} size="small">
          编辑
        </Button>
      }
    >
      <div className="metadata-display">
        <div className="metadata-item">
          <div className="metadata-item-content">
            <strong>主题：</strong>
            <span>{metadata.Topic}</span>
          </div>
          <div className="metadata-item-actions">
            <Button
              type="link"
              size="small"
              icon={isGeneratingTopicSuggestions ? <LoadingOutlined /> : <BulbOutlined />}
              onClick={onGenerateTopicSuggestions}
              disabled={isGeneratingTopicSuggestions}
            >
              {isGeneratingTopicSuggestions ? '生成中...' : '启发'}
            </Button>
          </div>
        </div>

        {/* 主题候选项 */}
        {(metadata.TopicSuggestions || isGeneratingTopicSuggestions) && (
          <div className="suggestions-container">
            <div className="suggestions-header">
              <div className="suggestions-header-content">
                <Text type="secondary">主题候选项：</Text>
              </div>
              <div className="suggestions-header-actions">
                <Button
                  type="text"
                  size="small"
                  icon={topicSuggestionsCollapsed ? <DownOutlined /> : <UpOutlined />}
                  onClick={() => setTopicSuggestionsCollapsed(!topicSuggestionsCollapsed)}
                  style={{ fontSize: '12px' }}
                >
                  {topicSuggestionsCollapsed ? '展开' : '收起'}
                </Button>
              </div>
            </div>
            {!topicSuggestionsCollapsed && (
              <div className="suggestions-content">
                {isGeneratingTopicSuggestions ? (
                  <div className="suggestions-loading">
                    <Spin size="small" />
                    <span style={{ marginLeft: 8 }}>正在生成主题候选项...</span>
                  </div>
                ) : (
                  <Space wrap>
                    {metadata.TopicSuggestions?.map((suggestion, index) => (
                      <Tag
                        key={index}
                        color={suggestion === metadata.Topic ? 'blue' : 'green'}
                        className={suggestion === metadata.Topic ? 'current-selection' : ''}
                        style={{
                          cursor: suggestion === metadata.Topic ? 'default' : 'pointer',
                          padding: '4px 8px',
                          fontSize: '13px',
                          borderRadius: '4px',
                          transition: 'all 0.3s'
                        }}
                        onClick={() =>
                          suggestion !== metadata.Topic && onSelectTopicSuggestion?.(suggestion)
                        }
                      >
                        {suggestion} {suggestion === metadata.Topic && '(当前)'}
                      </Tag>
                    ))}
                  </Space>
                )}
              </div>
            )}
          </div>
        )}
        <div className="metadata-item">
          <div className="metadata-item-content">
            <strong>横轴：</strong>
            <span>{metadata.HorizontalAxis}</span>
          </div>
          <div className="metadata-item-actions">
            <Button
              type="link"
              size="small"
              icon={isGeneratingHorizontalSuggestions ? <LoadingOutlined /> : <BulbOutlined />}
              onClick={onGenerateHorizontalSuggestions}
              disabled={isGeneratingHorizontalSuggestions}
            >
              {isGeneratingHorizontalSuggestions ? '生成中...' : '启发'}
            </Button>
          </div>
        </div>

        {/* 横轴候选项 */}
        {(metadata.HorizontalAxisSuggestions || isGeneratingHorizontalSuggestions) && (
          <div className="suggestions-container">
            <div className="suggestions-header">
              <div className="suggestions-header-content">
                <Text type="secondary">横轴候选项：</Text>
              </div>
              <div className="suggestions-header-actions">
                <Button
                  type="text"
                  size="small"
                  icon={horizontalSuggestionsCollapsed ? <DownOutlined /> : <UpOutlined />}
                  onClick={() => setHorizontalSuggestionsCollapsed(!horizontalSuggestionsCollapsed)}
                  style={{ fontSize: '12px' }}
                >
                  {horizontalSuggestionsCollapsed ? '展开' : '收起'}
                </Button>
              </div>
            </div>
            {!horizontalSuggestionsCollapsed && (
              <div className="suggestions-content">
                {isGeneratingHorizontalSuggestions ? (
                  <div className="suggestions-loading">
                    <Spin size="small" />
                    <span style={{ marginLeft: 8 }}>正在生成横轴候选项...</span>
                  </div>
                ) : (
                  <Space wrap>
                    {metadata.HorizontalAxisSuggestions?.map((suggestion, index) => (
                      <Tag
                        key={index}
                        color={suggestion === metadata.HorizontalAxis ? 'blue' : 'green'}
                        className={
                          suggestion === metadata.HorizontalAxis ? 'current-selection' : ''
                        }
                        style={{
                          cursor: suggestion === metadata.HorizontalAxis ? 'default' : 'pointer',
                          padding: '4px 8px',
                          fontSize: '13px',
                          borderRadius: '4px',
                          transition: 'all 0.3s'
                        }}
                        onClick={() =>
                          suggestion !== metadata.HorizontalAxis &&
                          onSelectHorizontalSuggestion?.(suggestion)
                        }
                      >
                        {suggestion} {suggestion === metadata.HorizontalAxis && '(当前)'}
                      </Tag>
                    ))}
                  </Space>
                )}
              </div>
            )}
          </div>
        )}

        <div className="metadata-item">
          <div className="metadata-item-content">
            <strong>纵轴：</strong>
            <span>{metadata.VerticalAxis}</span>
          </div>
          <div className="metadata-item-actions">
            <Button
              type="link"
              size="small"
              icon={isGeneratingVerticalSuggestions ? <LoadingOutlined /> : <BulbOutlined />}
              onClick={onGenerateVerticalSuggestions}
              disabled={isGeneratingVerticalSuggestions}
            >
              {isGeneratingVerticalSuggestions ? '生成中...' : '启发'}
            </Button>
          </div>
        </div>

        {/* 纵轴候选项 */}
        {(metadata.VerticalAxisSuggestions || isGeneratingVerticalSuggestions) && (
          <div className="suggestions-container">
            <div className="suggestions-header">
              <div className="suggestions-header-content">
                <Text type="secondary">纵轴候选项：</Text>
              </div>
              <div className="suggestions-header-actions">
                <Button
                  type="text"
                  size="small"
                  icon={verticalSuggestionsCollapsed ? <DownOutlined /> : <UpOutlined />}
                  onClick={() => setVerticalSuggestionsCollapsed(!verticalSuggestionsCollapsed)}
                  style={{ fontSize: '12px' }}
                >
                  {verticalSuggestionsCollapsed ? '展开' : '收起'}
                </Button>
              </div>
            </div>
            {!verticalSuggestionsCollapsed && (
              <div className="suggestions-content">
                {isGeneratingVerticalSuggestions ? (
                  <div className="suggestions-loading">
                    <Spin size="small" />
                    <span style={{ marginLeft: 8 }}>正在生成纵轴候选项...</span>
                  </div>
                ) : (
                  <Space wrap>
                    {metadata.VerticalAxisSuggestions?.map((suggestion, index) => (
                      <Tag
                        key={index}
                        color={suggestion === metadata.VerticalAxis ? 'blue' : 'green'}
                        className={suggestion === metadata.VerticalAxis ? 'current-selection' : ''}
                        style={{
                          cursor: suggestion === metadata.VerticalAxis ? 'default' : 'pointer',
                          padding: '4px 8px',
                          fontSize: '13px',
                          borderRadius: '4px',
                          transition: 'all 0.3s'
                        }}
                        onClick={() =>
                          suggestion !== metadata.VerticalAxis &&
                          onSelectVerticalSuggestion?.(suggestion)
                        }
                      >
                        {suggestion} {suggestion === metadata.VerticalAxis && '(当前)'}
                      </Tag>
                    ))}
                  </Space>
                )}
              </div>
            )}
          </div>
        )}

        <div className="metadata-item">
          <div className="metadata-item-content">
            <strong>值的含义：</strong>
            <span>{metadata.Value}</span>
          </div>
          <div className="metadata-item-actions">
            <Button
              type="link"
              size="small"
              icon={isGeneratingValueSuggestions ? <LoadingOutlined /> : <BulbOutlined />}
              onClick={onGenerateValueSuggestions}
              disabled={isGeneratingValueSuggestions}
            >
              {isGeneratingValueSuggestions ? '生成中...' : '启发'}
            </Button>
          </div>
        </div>

        {/* 值候选项 */}
        {(metadata.ValueSuggestions || isGeneratingValueSuggestions) && (
          <div className="suggestions-container">
            <div className="suggestions-header">
              <div className="suggestions-header-content">
                <Text type="secondary">值的含义候选项：</Text>
              </div>
              <div className="suggestions-header-actions">
                <Button
                  type="text"
                  size="small"
                  icon={valueSuggestionsCollapsed ? <DownOutlined /> : <UpOutlined />}
                  onClick={() => setValueSuggestionsCollapsed(!valueSuggestionsCollapsed)}
                  style={{ fontSize: '12px' }}
                >
                  {valueSuggestionsCollapsed ? '展开' : '收起'}
                </Button>
              </div>
            </div>
            {!valueSuggestionsCollapsed && (
              <div className="suggestions-content">
                {isGeneratingValueSuggestions ? (
                  <div className="suggestions-loading">
                    <Spin size="small" />
                    <span style={{ marginLeft: 8 }}>正在生成值的含义候选项...</span>
                  </div>
                ) : (
                  <Space wrap>
                    {metadata.ValueSuggestions?.map((suggestion, index) => (
                      <Tag
                        key={index}
                        color={suggestion === metadata.Value ? 'blue' : 'green'}
                        className={suggestion === metadata.Value ? 'current-selection' : ''}
                        style={{
                          cursor: suggestion === metadata.Value ? 'default' : 'pointer',
                          padding: '4px 8px',
                          fontSize: '13px',
                          borderRadius: '4px',
                          transition: 'all 0.3s'
                        }}
                        onClick={() =>
                          suggestion !== metadata.Value && onSelectValueSuggestion?.(suggestion)
                        }
                      >
                        {suggestion} {suggestion === metadata.Value && '(当前)'}
                      </Tag>
                    ))}
                  </Space>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
