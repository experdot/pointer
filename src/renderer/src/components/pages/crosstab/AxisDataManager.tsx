import React, { useState } from 'react'
import { Card, Button, Input, Space, Tooltip, Popconfirm, Typography, Collapse, Tag, Divider } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  UndoOutlined,
  ColumnWidthOutlined,
  DownOutlined,
  UpOutlined
} from '@ant-design/icons'
import { CrosstabMetadata, CrosstabAxisDimension } from '../../../types'

const { Text, Title } = Typography
const { Panel } = Collapse

interface AxisDataManagerProps {
  metadata: CrosstabMetadata | null
  onUpdateDimension: (dimensionId: string, dimensionType: 'horizontal' | 'vertical', updates: Partial<CrosstabAxisDimension>) => void
  onGenerateDimensionValues: (dimensionId: string, dimensionType: 'horizontal' | 'vertical') => void
  isGeneratingDimensionValues?: { [dimensionId: string]: boolean }
}

export default function AxisDataManager({
  metadata,
  onUpdateDimension,
  onGenerateDimensionValues,
  isGeneratingDimensionValues
}: AxisDataManagerProps) {
  const [editingDimensionId, setEditingDimensionId] = useState<string | null>(null)
  const [editingValueIndex, setEditingValueIndex] = useState<{ dimensionId: string; valueIndex: number } | null>(null)
  const [newValueInputs, setNewValueInputs] = useState<{ [dimensionId: string]: string }>({})

  const handleEditDimensionValue = (dimensionId: string, dimensionType: 'horizontal' | 'vertical', valueIndex: number, newValue: string) => {
    const currentDimension = getDimensionById(dimensionId, dimensionType)
    if (currentDimension && newValue.trim()) {
      const newValues = [...currentDimension.values]
      newValues[valueIndex] = newValue.trim()
      onUpdateDimension(dimensionId, dimensionType, { values: newValues })
    }
    setEditingValueIndex(null)
  }

  const handleDeleteDimensionValue = (dimensionId: string, dimensionType: 'horizontal' | 'vertical', valueIndex: number) => {
    const currentDimension = getDimensionById(dimensionId, dimensionType)
    if (currentDimension) {
      const newValues = currentDimension.values.filter((_, index) => index !== valueIndex)
      onUpdateDimension(dimensionId, dimensionType, { values: newValues })
    }
  }

  const handleAddDimensionValue = (dimensionId: string, dimensionType: 'horizontal' | 'vertical') => {
    const newValue = newValueInputs[dimensionId]
    if (newValue && newValue.trim()) {
      const currentDimension = getDimensionById(dimensionId, dimensionType)
      if (currentDimension) {
        const newValues = [...currentDimension.values, newValue.trim()]
        onUpdateDimension(dimensionId, dimensionType, { values: newValues })
        setNewValueInputs(prev => ({ ...prev, [dimensionId]: '' }))
      }
    }
  }

  const getDimensionById = (dimensionId: string, dimensionType: 'horizontal' | 'vertical'): CrosstabAxisDimension | null => {
    if (!metadata) return null
    const dimensions = dimensionType === 'horizontal' ? metadata.horizontalDimensions : metadata.verticalDimensions
    return dimensions.find(dim => dim.id === dimensionId) || null
  }

  const renderDimensionValues = (dimension: CrosstabAxisDimension, dimensionType: 'horizontal' | 'vertical') => {
    const isGenerating = isGeneratingDimensionValues?.[dimension.id] || false

    if (dimension.values.length === 0 && !isGenerating) {
      return (
        <div style={{ textAlign: 'center', padding: '16px' }}>
          <Text type="secondary">暂无数据</Text>
          <br />
          <Button
            type="primary"
            size="small"
            style={{ marginTop: 8 }}
            onClick={() => onGenerateDimensionValues(dimension.id, dimensionType)}
            loading={isGenerating}
          >
            生成数据
          </Button>
        </div>
      )
    }

    return (
      <div>
        {/* 现有值列表 */}
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            {dimension.values.map((value, index) => (
              <div key={index} style={{ position: 'relative' }}>
                {editingValueIndex?.dimensionId === dimension.id && editingValueIndex?.valueIndex === index ? (
                  <Input
                    size="small"
                    defaultValue={value}
                    onPressEnter={(e) => handleEditDimensionValue(dimension.id, dimensionType, index, e.currentTarget.value)}
                    onBlur={(e) => handleEditDimensionValue(dimension.id, dimensionType, index, e.currentTarget.value)}
                    autoFocus
                  />
                ) : (
                  <Tag
                    style={{ cursor: 'pointer' }}
                    onClick={() => setEditingValueIndex({ dimensionId: dimension.id, valueIndex: index })}
                  >
                    {value}
                    <Popconfirm
                      title="确定要删除这个值吗？"
                      onConfirm={() => handleDeleteDimensionValue(dimension.id, dimensionType, index)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <DeleteOutlined 
                        style={{ marginLeft: 4, color: '#ff4d4f' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>
                  </Tag>
                )}
              </div>
            ))}
          </Space>
        </div>

        {/* 添加新值 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            size="small"
            placeholder="添加新值"
            value={newValueInputs[dimension.id] || ''}
            onChange={(e) => setNewValueInputs(prev => ({ ...prev, [dimension.id]: e.target.value }))}
            onPressEnter={() => handleAddDimensionValue(dimension.id, dimensionType)}
          />
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleAddDimensionValue(dimension.id, dimensionType)}
          >
            添加
          </Button>
        </div>

        {/* 生成按钮 */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button
            type="dashed"
            size="small"
            onClick={() => onGenerateDimensionValues(dimension.id, dimensionType)}
            loading={isGenerating}
          >
            {isGenerating ? '生成中...' : '重新生成所有数据'}
          </Button>
        </div>
      </div>
    )
  }

  const renderDimensionCard = (dimension: CrosstabAxisDimension, dimensionType: 'horizontal' | 'vertical') => {
    return (
      <Card
        key={dimension.id}
        size="small"
        title={
          <Space>
            <span>{dimension.name}</span>
            {dimension.description && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                ({dimension.description})
              </Text>
            )}
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        {renderDimensionValues(dimension, dimensionType)}
      </Card>
    )
  }

  const renderAxisSection = (
    dimensions: CrosstabAxisDimension[],
    dimensionType: 'horizontal' | 'vertical',
    title: string
  ) => {
    if (dimensions.length === 0) {
      return (
        <Card className="axis-card">
          <div className="empty-state">
            <ColumnWidthOutlined style={{ fontSize: 32, color: '#d9d9d9' }} />
            <div>
              <Text type="secondary">暂无{title}维度</Text>
              <br />
              <Text type="secondary">请先在元数据中添加{title}维度</Text>
            </div>
          </div>
        </Card>
      )
    }

    return (
      <Card
        title={`${title}数据 (${dimensions.length}个维度)`}
        className="axis-card"
      >
        <div className="dimensions-container">
          {dimensions.map((dimension) => renderDimensionCard(dimension, dimensionType))}
        </div>
      </Card>
    )
  }

  if (!metadata) {
    return (
      <Card className="tab-card">
        <div className="empty-state">
          <ColumnWidthOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <div>
            <Text type="secondary">尚未生成多维度轴数据</Text>
            <br />
            <Text type="secondary">请先完成主题分析，然后生成各维度的数据</Text>
          </div>
        </div>
      </Card>
    )
  }

  const hasAnyDimensionData = 
    metadata.horizontalDimensions.some(dim => dim.values.length > 0) ||
    metadata.verticalDimensions.some(dim => dim.values.length > 0)

  if (!hasAnyDimensionData) {
    return (
      <Card className="tab-card">
        <div className="empty-state">
          <ColumnWidthOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <div>
            <Text type="secondary">尚未生成轴数据</Text>
            <br />
            <Text type="secondary">请使用各维度卡片中的"生成数据"按钮来生成轴数据</Text>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="axis-data-container">
      {/* 横轴数据 */}
      {renderAxisSection(metadata.horizontalDimensions, 'horizontal', '横轴')}

      {/* 纵轴数据 */}
      {renderAxisSection(metadata.verticalDimensions, 'vertical', '纵轴')}
    </div>
  )
}
