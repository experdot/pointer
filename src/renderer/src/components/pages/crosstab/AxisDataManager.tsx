import React, { useState } from 'react'
import { Card, Button, Input, Space, Popconfirm, Typography, List, Tooltip, message } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  ColumnWidthOutlined,
  EditOutlined,
  HolderOutlined,
  SaveOutlined,
  CloseOutlined
} from '@ant-design/icons'
import { CrosstabMetadata, CrosstabAxisDimension } from '../../../types/type'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const { Text } = Typography

interface AxisDataManagerProps {
  metadata: CrosstabMetadata | null
  onUpdateDimension: (
    dimensionId: string,
    dimensionType: 'horizontal' | 'vertical',
    updates: Partial<CrosstabAxisDimension>
  ) => void
  onGenerateDimensionValues: (dimensionId: string, dimensionType: 'horizontal' | 'vertical') => void
  isGeneratingDimensionValues?: { [dimensionId: string]: boolean }
}

interface SortableItemProps {
  id: string
  value: string
  index: number
  isEditing: boolean
  onEdit: () => void
  onSave: (newValue: string) => void
  onCancel: () => void
  onDelete: () => void
  editingValue: string
  setEditingValue: (value: string) => void
}

const SortableItem: React.FC<SortableItemProps> = ({
  id,
  value,
  index,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  editingValue,
  setEditingValue
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div ref={setNodeRef} style={style}>
      <List.Item
        actions={[
          <Tooltip title="拖动排序">
            <Button
              type="text"
              size="small"
              icon={<HolderOutlined />}
              {...attributes}
              {...listeners}
              style={{ cursor: 'grab' }}
            />
          </Tooltip>,
          isEditing ? (
            <Space>
              <Button
                type="text"
                size="small"
                icon={<SaveOutlined />}
                onClick={() => onSave(editingValue)}
                style={{ color: '#52c41a' }}
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={onCancel}
                style={{ color: '#ff4d4f' }}
              />
            </Space>
          ) : (
            <Space>
              <Button type="text" size="small" icon={<EditOutlined />} onClick={onEdit} />
              <Popconfirm
                title="确定要删除这个值吗？"
                onConfirm={onDelete}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  style={{ color: '#ff4d4f' }}
                />
              </Popconfirm>
            </Space>
          )
        ]}
      >
        <List.Item.Meta
          title={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: 8, color: '#666', fontSize: '12px' }}>{index + 1}.</span>
              {isEditing ? (
                <Input
                  size="small"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onPressEnter={() => onSave(editingValue)}
                  style={{ width: '200px' }}
                  autoFocus
                />
              ) : (
                <Text>{value}</Text>
              )}
            </div>
          }
        />
      </List.Item>
    </div>
  )
}

export default function AxisDataManager({
  metadata,
  onUpdateDimension,
  onGenerateDimensionValues,
  isGeneratingDimensionValues
}: AxisDataManagerProps) {
  const [editingItem, setEditingItem] = useState<{
    dimensionId: string
    valueIndex: number
  } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [newValueInputs, setNewValueInputs] = useState<{ [dimensionId: string]: string }>({})

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = (
    event: any,
    dimensionId: string,
    dimensionType: 'horizontal' | 'vertical'
  ) => {
    const { active, over } = event

    if (active.id !== over.id) {
      const currentDimension = getDimensionById(dimensionId, dimensionType)
      if (currentDimension) {
        const oldIndex = currentDimension.values.findIndex(
          (_, index) => `${dimensionId}-${index}` === active.id
        )
        const newIndex = currentDimension.values.findIndex(
          (_, index) => `${dimensionId}-${index}` === over.id
        )

        const newValues = arrayMove(currentDimension.values, oldIndex, newIndex)
        onUpdateDimension(dimensionId, dimensionType, { values: newValues })
      }
    }
  }

  const handleEditStart = (dimensionId: string, valueIndex: number, currentValue: string) => {
    setEditingItem({ dimensionId, valueIndex })
    setEditingValue(currentValue)
  }

  const handleEditSave = (
    dimensionId: string,
    dimensionType: 'horizontal' | 'vertical',
    valueIndex: number
  ) => {
    if (editingValue.trim()) {
      const currentDimension = getDimensionById(dimensionId, dimensionType)
      if (currentDimension) {
        const newValues = [...currentDimension.values]
        newValues[valueIndex] = editingValue.trim()
        onUpdateDimension(dimensionId, dimensionType, { values: newValues })
        message.success('修改成功')
      }
    }
    setEditingItem(null)
    setEditingValue('')
  }

  const handleEditCancel = () => {
    setEditingItem(null)
    setEditingValue('')
  }

  const handleDeleteDimensionValue = (
    dimensionId: string,
    dimensionType: 'horizontal' | 'vertical',
    valueIndex: number
  ) => {
    const currentDimension = getDimensionById(dimensionId, dimensionType)
    if (currentDimension) {
      const newValues = currentDimension.values.filter((_, index) => index !== valueIndex)
      onUpdateDimension(dimensionId, dimensionType, { values: newValues })
      message.success('删除成功')
    }
  }

  const handleAddDimensionValue = (
    dimensionId: string,
    dimensionType: 'horizontal' | 'vertical'
  ) => {
    const newValue = newValueInputs[dimensionId]
    if (newValue && newValue.trim()) {
      const currentDimension = getDimensionById(dimensionId, dimensionType)
      if (currentDimension) {
        const newValues = [...currentDimension.values, newValue.trim()]
        onUpdateDimension(dimensionId, dimensionType, { values: newValues })
        setNewValueInputs((prev) => ({ ...prev, [dimensionId]: '' }))
        message.success('添加成功')
      }
    }
  }

  const getDimensionById = (
    dimensionId: string,
    dimensionType: 'horizontal' | 'vertical'
  ): CrosstabAxisDimension | null => {
    if (!metadata) return null
    const dimensions =
      dimensionType === 'horizontal' ? metadata.horizontalDimensions : metadata.verticalDimensions
    return dimensions.find((dim) => dim.id === dimensionId) || null
  }

  const renderDimensionValues = (
    dimension: CrosstabAxisDimension,
    dimensionType: 'horizontal' | 'vertical'
  ) => {
    const isGenerating = isGeneratingDimensionValues?.[dimension.id] || false

    return (
      <div>
        {/* 值列表 */}
        {dimension.values.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleDragEnd(event, dimension.id, dimensionType)}
            >
              <SortableContext
                items={dimension.values.map((_, index) => `${dimension.id}-${index}`)}
                strategy={verticalListSortingStrategy}
              >
                <List
                  size="small"
                  bordered
                  dataSource={dimension.values}
                  renderItem={(value, index) => (
                    <SortableItem
                      key={`${dimension.id}-${index}`}
                      id={`${dimension.id}-${index}`}
                      value={value}
                      index={index}
                      isEditing={
                        editingItem?.dimensionId === dimension.id &&
                        editingItem?.valueIndex === index
                      }
                      onEdit={() => handleEditStart(dimension.id, index, value)}
                      onSave={() => handleEditSave(dimension.id, dimensionType, index)}
                      onCancel={handleEditCancel}
                      onDelete={() =>
                        handleDeleteDimensionValue(dimension.id, dimensionType, index)
                      }
                      editingValue={editingValue}
                      setEditingValue={setEditingValue}
                    />
                  )}
                />
              </SortableContext>
            </DndContext>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px', marginBottom: 16 }}>
            <Text type="secondary">暂无数据，请添加或生成数据</Text>
          </div>
        )}

        {/* 添加新值 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Input
            size="small"
            placeholder="添加新值"
            value={newValueInputs[dimension.id] || ''}
            onChange={(e) =>
              setNewValueInputs((prev) => ({ ...prev, [dimension.id]: e.target.value }))
            }
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
        <div style={{ textAlign: 'center' }}>
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

  const renderDimensionCard = (
    dimension: CrosstabAxisDimension,
    dimensionType: 'horizontal' | 'vertical'
  ) => {
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
      <Card title={`${title}数据 (${dimensions.length}个维度)`} className="axis-card">
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

  return (
    <div className="axis-data-container">
      {/* 横轴数据 */}
      {renderAxisSection(metadata.horizontalDimensions, 'horizontal', '横轴')}

      {/* 纵轴数据 */}
      {renderAxisSection(metadata.verticalDimensions, 'vertical', '纵轴')}
    </div>
  )
}
