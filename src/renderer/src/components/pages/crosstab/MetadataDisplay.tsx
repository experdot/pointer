import React, { useState } from 'react'
import { Card, Button, Typography, Tag, Space, Spin, Divider, Collapse } from 'antd'
import {
  EditOutlined,
  BorderOutlined,
  BulbOutlined,
  LoadingOutlined,
  UpOutlined,
  DownOutlined,
} from '@ant-design/icons'
import { CrosstabMetadata, CrosstabAxisDimension, CrosstabValueDimension } from '../../../types'

const { Text, Title } = Typography

interface MetadataDisplayProps {
  metadata: CrosstabMetadata | null
  onEditMetadata: () => void
  onGenerateTopicSuggestions?: () => void
  onGenerateDimensionSuggestions?: (dimensionId: string, dimensionType: 'horizontal' | 'vertical') => void
  onSelectTopicSuggestion?: (suggestion: string) => void
  onSelectDimensionSuggestion?: (dimensionId: string, suggestion: string) => void
  isGeneratingTopicSuggestions?: boolean
  isGeneratingDimensionSuggestions?: { [dimensionId: string]: boolean }
}

export default function MetadataDisplay({
  metadata,
  onEditMetadata,
  onGenerateTopicSuggestions,
  onGenerateDimensionSuggestions,
  onSelectTopicSuggestion,
  onSelectDimensionSuggestion,
  isGeneratingTopicSuggestions,
  isGeneratingDimensionSuggestions
}: MetadataDisplayProps) {
  const [topicSuggestionsCollapsed, setTopicSuggestionsCollapsed] = useState(false)
  const [dimensionSuggestionsCollapsed, setDimensionSuggestionsCollapsed] = useState<{[key: string]: boolean}>({})

  if (!metadata) {
    return (
      <Card className="tab-card">
        <div className="empty-state">
          <BorderOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <div>
            <Text type="secondary">尚未生成多维度主题结构</Text>
            <br />
            <Text type="secondary">请先在"输入主题"页面输入主题并点击"分析主题"按钮</Text>
          </div>
        </div>
      </Card>
    )
  }

  const renderDimensionSuggestions = (
    dimension: CrosstabAxisDimension,
    dimensionType: 'horizontal' | 'vertical'
  ) => {
    const isGenerating = isGeneratingDimensionSuggestions?.[dimension.id] || false
    const suggestions = dimension.suggestions || []
    const isCollapsed = dimensionSuggestionsCollapsed[dimension.id] || false

    if (suggestions.length === 0 && !isGenerating) {
      return null
    }

    return (
      <div className="suggestions-container" style={{ marginTop: 8 }}>
        <div className="suggestions-header">
          <div className="suggestions-header-content">
            <Button
              type="link"
              size="small"
              icon={isCollapsed ? <DownOutlined /> : <UpOutlined />}
              onClick={() => setDimensionSuggestionsCollapsed(prev => ({ ...prev, [dimension.id]: !prev[dimension.id] }))}
            >
              {isCollapsed ? '展开' : '收起'}候选项
            </Button>
            <span className="suggestions-count">
              {isGenerating ? '生成中...' : `${suggestions.length} 个候选项`}
            </span>
          </div>
        </div>
        
        {!isCollapsed && (
          <div className="suggestions-content">
            {isGenerating && (
              <div className="suggestion-loading">
                <Spin size="small" />
                <Text type="secondary">正在生成候选项...</Text>
              </div>
            )}
            
            {suggestions.length > 0 && (
              <div className="suggestions-list">
                {suggestions.map((suggestion, index) => (
                  <Tag
                    key={index}
                    className="suggestion-tag"
                    onClick={() => onSelectDimensionSuggestion?.(dimension.id, suggestion)}
                  >
                    {suggestion}
                  </Tag>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderAxisDimensions = (
    dimensions: CrosstabAxisDimension[],
    axisName: string,
    dimensionType: 'horizontal' | 'vertical'
  ) => {
    if (dimensions.length === 0) {
      return (
        <div className="metadata-item">
          <Text type="secondary">暂无{axisName}维度</Text>
        </div>
      )
    }

    return (
      <div className="dimensions-container">
        {dimensions.map((dimension, index) => (
          <Card
            key={dimension.id}
            size="small"
            title={`${axisName}维度 ${index + 1}: ${dimension.name}`}
            extra={
              <Button
                type="link"
                size="small"
                icon={isGeneratingDimensionSuggestions?.[dimension.id] ? <LoadingOutlined /> : <BulbOutlined />}
                onClick={() => onGenerateDimensionSuggestions?.(dimension.id, dimensionType)}
                disabled={isGeneratingDimensionSuggestions?.[dimension.id]}
              >
                {isGeneratingDimensionSuggestions?.[dimension.id] ? '生成中...' : '启发'}
              </Button>
            }
            style={{ marginBottom: 12 }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {dimension.description && (
                <Text type="secondary">{dimension.description}</Text>
              )}
              
              {dimension.values.length > 0 && (
                <div>
                  <Text strong>当前值：</Text>
                  <div style={{ marginTop: 4 }}>
                    {dimension.values.map((value, idx) => (
                      <Tag key={idx} style={{ marginBottom: 4 }}>
                        {value}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}
              
              {renderDimensionSuggestions(dimension, dimensionType)}
            </Space>
          </Card>
        ))}
      </div>
    )
  }

  const renderValueDimensions = (dimensions: CrosstabValueDimension[]) => {
    if (dimensions.length === 0) {
      return (
        <div className="metadata-item">
          <Text type="secondary">暂无值维度</Text>
        </div>
      )
    }

    return (
      <div className="dimensions-container">
        {dimensions.map((dimension, index) => (
          <Card
            key={dimension.id}
            size="small"
            title={`值维度 ${index + 1}: ${dimension.name}`}
            style={{ marginBottom: 12 }}
          >
            <Text type="secondary">{dimension.description}</Text>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <Card
      title="多维度主题结构分析"
      className="tab-card"
      extra={
        <Button type="text" icon={<EditOutlined />} onClick={onEditMetadata} size="small">
          编辑
        </Button>
      }
    >
      <div className="metadata-display">
        {/* 主题部分 */}
        <div className="metadata-item">
          <div className="metadata-item-content">
            <Title level={5}>主题</Title>
            <Text>{metadata.topic}</Text>
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
        {(metadata.topicSuggestions || isGeneratingTopicSuggestions) && (
          <div className="suggestions-container">
            <div className="suggestions-header">
              <div className="suggestions-header-content">
                <Button
                  type="link"
                  size="small"
                  icon={topicSuggestionsCollapsed ? <DownOutlined /> : <UpOutlined />}
                  onClick={() => setTopicSuggestionsCollapsed(!topicSuggestionsCollapsed)}
                >
                  {topicSuggestionsCollapsed ? '展开' : '收起'}主题候选项
                </Button>
                <span className="suggestions-count">
                  {isGeneratingTopicSuggestions ? '生成中...' : `${metadata.topicSuggestions?.length || 0} 个候选项`}
                </span>
              </div>
            </div>
            
            {!topicSuggestionsCollapsed && (
              <div className="suggestions-content">
                {isGeneratingTopicSuggestions && (
                  <div className="suggestion-loading">
                    <Spin size="small" />
                    <Text type="secondary">正在生成主题候选项...</Text>
                  </div>
                )}
                
                {metadata.topicSuggestions && metadata.topicSuggestions.length > 0 && (
                  <div className="suggestions-list">
                    {metadata.topicSuggestions.map((suggestion, index) => (
                      <Tag
                        key={index}
                        className="suggestion-tag"
                        onClick={() => onSelectTopicSuggestion?.(suggestion)}
                      >
                        {suggestion}
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <Divider />

        {/* 横轴维度 */}
        <div className="metadata-section">
          <Title level={5}>横轴维度</Title>
          {renderAxisDimensions(metadata.horizontalDimensions, '横轴', 'horizontal')}
        </div>

        <Divider />

        {/* 纵轴维度 */}
        <div className="metadata-section">
          <Title level={5}>纵轴维度</Title>
          {renderAxisDimensions(metadata.verticalDimensions, '纵轴', 'vertical')}
        </div>

        <Divider />

        {/* 值维度 */}
        <div className="metadata-section">
          <Title level={5}>值维度</Title>
          {renderValueDimensions(metadata.valueDimensions)}
        </div>
      </div>
    </Card>
  )
}
