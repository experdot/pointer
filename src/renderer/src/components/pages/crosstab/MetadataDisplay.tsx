import React, { useState } from 'react'
import { Card, Button, Typography, Tag, Space, Spin, Divider, Input, Popconfirm, Tooltip } from 'antd'
import {
  EditOutlined,
  BorderOutlined,
  BulbOutlined,
  LoadingOutlined,
  UpOutlined,
  DownOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { CrosstabMetadata, CrosstabAxisDimension, CrosstabValueDimension } from '../../../types'
import { v4 as uuidv4 } from 'uuid'

const { Text, Title } = Typography
const { TextArea } = Input

interface MetadataDisplayProps {
  metadata: CrosstabMetadata | null
  onUpdateMetadata: (metadata: CrosstabMetadata) => void
  onGenerateTopicSuggestions?: () => void
  onSelectTopicSuggestion?: (suggestion: string) => void
  isGeneratingTopicSuggestions?: boolean
}

export default function MetadataDisplay({
  metadata,
  onUpdateMetadata,
  onGenerateTopicSuggestions,
  onSelectTopicSuggestion,
  isGeneratingTopicSuggestions
}: MetadataDisplayProps) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [topicSuggestionsCollapsed, setTopicSuggestionsCollapsed] = useState(false)

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

  const updateMetadata = (updates: Partial<CrosstabMetadata>) => {
    onUpdateMetadata({ ...metadata, ...updates })
  }

  const startEdit = (field: string, value: string) => {
    setEditingField(field)
    setEditValue(value)
  }

  const saveEdit = () => {
    if (!editingField) return

    if (editingField === 'topic') {
      updateMetadata({ topic: editValue })
    } else if (editingField.startsWith('horizontal_')) {
      const [, dimensionId, fieldType] = editingField.split('_')
      const dimensions = metadata.horizontalDimensions.map(dim => 
        dim.id === dimensionId ? { ...dim, [fieldType]: editValue } : dim
      )
      updateMetadata({ horizontalDimensions: dimensions })
    } else if (editingField.startsWith('vertical_')) {
      const [, dimensionId, fieldType] = editingField.split('_')
      const dimensions = metadata.verticalDimensions.map(dim => 
        dim.id === dimensionId ? { ...dim, [fieldType]: editValue } : dim
      )
      updateMetadata({ verticalDimensions: dimensions })
    } else if (editingField.startsWith('value_')) {
      const [, dimensionId, fieldType] = editingField.split('_')
      const dimensions = metadata.valueDimensions.map(dim => 
        dim.id === dimensionId ? { ...dim, [fieldType]: editValue } : dim
      )
      updateMetadata({ valueDimensions: dimensions })
    }

    setEditingField(null)
    setEditValue('')
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditValue('')
  }

  const addHorizontalDimension = () => {
    const newDimension: CrosstabAxisDimension = {
      id: uuidv4(),
      name: '新横轴维度',
      description: '',
      values: [],
      order: metadata.horizontalDimensions.length + 1
    }
    updateMetadata({
      horizontalDimensions: [...metadata.horizontalDimensions, newDimension]
    })
  }

  const addVerticalDimension = () => {
    const newDimension: CrosstabAxisDimension = {
      id: uuidv4(),
      name: '新纵轴维度',
      description: '',
      values: [],
      order: metadata.verticalDimensions.length + 1
    }
    updateMetadata({
      verticalDimensions: [...metadata.verticalDimensions, newDimension]
    })
  }

  const addValueDimension = () => {
    const newDimension: CrosstabValueDimension = {
      id: uuidv4(),
      name: '新值维度',
      description: ''
    }
    updateMetadata({
      valueDimensions: [...metadata.valueDimensions, newDimension]
    })
  }

  const deleteHorizontalDimension = (dimensionId: string) => {
    const dimensions = metadata.horizontalDimensions.filter(dim => dim.id !== dimensionId)
    updateMetadata({ horizontalDimensions: dimensions })
  }

  const deleteVerticalDimension = (dimensionId: string) => {
    const dimensions = metadata.verticalDimensions.filter(dim => dim.id !== dimensionId)
    updateMetadata({ verticalDimensions: dimensions })
  }

  const deleteValueDimension = (dimensionId: string) => {
    const dimensions = metadata.valueDimensions.filter(dim => dim.id !== dimensionId)
    updateMetadata({ valueDimensions: dimensions })
  }

  const renderEditableField = (
    value: string,
    field: string,
    placeholder: string,
    isTextArea: boolean = false
  ) => {
    const isEditing = editingField === field

    if (isEditing) {
      return (
        <Space.Compact style={{ width: '100%' }}>
          {isTextArea ? (
            <TextArea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ flex: 1 }}
            />
          ) : (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              style={{ flex: 1 }}
            />
          )}
          <Button type="primary" size="small" icon={<SaveOutlined />} onClick={saveEdit} />
          <Button size="small" icon={<CloseOutlined />} onClick={cancelEdit} />
        </Space.Compact>
      )
    }

         return (
       <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
         <Text style={{ wordBreak: 'break-word', flex: 1 }}>{value || placeholder}</Text>
         <Tooltip title="编辑">
           <Button
             type="text"
             size="small"
             icon={<EditOutlined />}
             onClick={() => startEdit(field, value)}
           />
         </Tooltip>
       </div>
     )
  }

  const renderAxisDimensions = (
    dimensions: CrosstabAxisDimension[],
    axisName: string,
    dimensionType: 'horizontal' | 'vertical'
  ) => {
    const deleteFunction = dimensionType === 'horizontal' ? deleteHorizontalDimension : deleteVerticalDimension
    const addFunction = dimensionType === 'horizontal' ? addHorizontalDimension : addVerticalDimension

    return (
      <div className="dimensions-container">
        {dimensions.map((dimension, index) => (
          <Card
            key={dimension.id}
            size="small"
            title={`${axisName}维度 ${index + 1}`}
            extra={
              <Popconfirm
                title="确定要删除这个维度吗？"
                onConfirm={() => deleteFunction(dimension.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="text" danger size="small" icon={<DeleteOutlined />} />
              </Popconfirm>
            }
            style={{ marginBottom: 12 }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <Text type="secondary" style={{ fontSize: '12px', minWidth: '40px' }}>名称：</Text>
                <div style={{ flex: 1 }}>
                  {renderEditableField(
                    dimension.name,
                    `${dimensionType}_${dimension.id}_name`,
                    '请输入维度名称'
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <Text type="secondary" style={{ fontSize: '12px', minWidth: '40px' }}>描述：</Text>
                <div style={{ flex: 1 }}>
                  {renderEditableField(
                    dimension.description || '',
                    `${dimensionType}_${dimension.id}_description`,
                    '请输入维度描述',
                    true
                  )}
                </div>
              </div>
              
              {dimension.values.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <Text strong style={{ fontSize: '12px', minWidth: '40px' }}>当前值：</Text>
                  <div style={{ flex: 1 }}>
                    {dimension.values.map((value, idx) => (
                      <Tag key={idx} style={{ marginBottom: 4 }}>
                        {value}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}
            </Space>
          </Card>
        ))}
        
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addFunction}
          style={{ width: '100%', marginTop: 8 }}
        >
          添加{axisName}维度
        </Button>
        
        {dimensions.length === 0 && (
          <div className="metadata-item">
            <Text type="secondary">暂无{axisName}维度</Text>
          </div>
        )}
      </div>
    )
  }

  const renderValueDimensions = (dimensions: CrosstabValueDimension[]) => {
    return (
      <div className="dimensions-container">
        {dimensions.map((dimension, index) => (
          <Card
            key={dimension.id}
            size="small"
            title={`值维度 ${index + 1}`}
            extra={
              <Popconfirm
                title="确定要删除这个值维度吗？"
                onConfirm={() => deleteValueDimension(dimension.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="text" danger size="small" icon={<DeleteOutlined />} />
              </Popconfirm>
            }
            style={{ marginBottom: 12 }}
          >
                         <Space direction="vertical" style={{ width: '100%' }}>
               <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                 <Text type="secondary" style={{ fontSize: '12px', minWidth: '40px' }}>名称：</Text>
                 <div style={{ flex: 1 }}>
                   {renderEditableField(
                     dimension.name,
                     `value_${dimension.id}_name`,
                     '请输入值维度名称'
                   )}
                 </div>
               </div>
               
               <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                 <Text type="secondary" style={{ fontSize: '12px', minWidth: '40px' }}>描述：</Text>
                 <div style={{ flex: 1 }}>
                   {renderEditableField(
                     dimension.description,
                     `value_${dimension.id}_description`,
                     '请输入值维度描述',
                     true
                   )}
                 </div>
               </div>
             </Space>
          </Card>
        ))}
        
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addValueDimension}
          style={{ width: '100%', marginTop: 8 }}
        >
          添加值维度
        </Button>
        
        {dimensions.length === 0 && (
          <div className="metadata-item">
            <Text type="secondary">暂无值维度</Text>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card
      title="多维度主题结构分析"
      className="tab-card"
    >
      <div className="metadata-display">
        {/* 主题部分 */}
        <div className="metadata-item">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
            <Title level={5} style={{ margin: 0, minWidth: '60px' }}>主题</Title>
            <div style={{ flex: 1 }}>
              {renderEditableField(metadata.topic, 'topic', '请输入主题')}
            </div>
            <div>
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
