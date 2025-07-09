import React, { useState } from 'react'
import { Card, Button, Input, Space, Tooltip, Popconfirm, Typography } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  UndoOutlined,
  ColumnWidthOutlined
} from '@ant-design/icons'
import { CrosstabMetadata } from '../../../types'

const { Text } = Typography

interface AxisDataManagerProps {
  metadata: CrosstabMetadata | null
  horizontalValues: string[]
  verticalValues: string[]
  onEditHorizontalItem: (index: number, value: string) => void
  onDeleteHorizontalItem: (index: number) => void
  onAddHorizontalItem: (value: string) => void
  onEditVerticalItem: (index: number, value: string) => void
  onDeleteVerticalItem: (index: number) => void
  onAddVerticalItem: (value: string) => void
}

export default function AxisDataManager({
  metadata,
  horizontalValues,
  verticalValues,
  onEditHorizontalItem,
  onDeleteHorizontalItem,
  onAddHorizontalItem,
  onEditVerticalItem,
  onDeleteVerticalItem,
  onAddVerticalItem
}: AxisDataManagerProps) {
  const [editingHorizontalIndex, setEditingHorizontalIndex] = useState<number | null>(null)
  const [editingVerticalIndex, setEditingVerticalIndex] = useState<number | null>(null)
  const [newHorizontalValue, setNewHorizontalValue] = useState('')
  const [newVerticalValue, setNewVerticalValue] = useState('')
  const [showAddHorizontal, setShowAddHorizontal] = useState(false)
  const [showAddVertical, setShowAddVertical] = useState(false)

  const handleEditHorizontalItem = (index: number, value: string) => {
    if (value.trim()) {
      onEditHorizontalItem(index, value.trim())
    }
    setEditingHorizontalIndex(null)
  }

  const handleEditVerticalItem = (index: number, value: string) => {
    if (value.trim()) {
      onEditVerticalItem(index, value.trim())
    }
    setEditingVerticalIndex(null)
  }

  const handleAddHorizontalItem = () => {
    if (newHorizontalValue.trim()) {
      onAddHorizontalItem(newHorizontalValue.trim())
      setNewHorizontalValue('')
      setShowAddHorizontal(false)
    }
  }

  const handleAddVerticalItem = () => {
    if (newVerticalValue.trim()) {
      onAddVerticalItem(newVerticalValue.trim())
      setNewVerticalValue('')
      setShowAddVertical(false)
    }
  }

  if (horizontalValues.length === 0 && verticalValues.length === 0) {
    return (
      <Card className="tab-card">
        <div className="empty-state">
          <ColumnWidthOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <div>
            <Text type="secondary">尚未生成轴数据</Text>
            <br />
            <Text type="secondary">
              请先完成主题分析，然后使用左侧步骤中的按钮生成横轴和纵轴数据
            </Text>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="axis-data-container">
      {/* 横轴数据 */}
      {horizontalValues.length > 0 && (
        <Card
          title={`横轴数据 (${metadata?.HorizontalAxis || '横轴'})`}
          className="axis-card"
          extra={
            <Button
              type="text"
              icon={<PlusOutlined />}
              onClick={() => setShowAddHorizontal(!showAddHorizontal)}
              size="small"
            >
              添加项目
            </Button>
          }
        >
          <div className="axis-values">
            {horizontalValues.map((value, index) => (
              <div key={index} className="axis-value-item">
                {editingHorizontalIndex === index ? (
                  <Input
                    defaultValue={value}
                    size="small"
                    onPressEnter={(e) => {
                      const newValue = (e.target as HTMLInputElement).value.trim()
                      handleEditHorizontalItem(index, newValue)
                    }}
                    onBlur={(e) => {
                      const newValue = e.target.value.trim()
                      handleEditHorizontalItem(index, newValue)
                    }}
                    autoFocus
                  />
                ) : (
                  <span className="axis-value">{value}</span>
                )}
                <Space size="small" className="axis-value-actions">
                  <Tooltip title="编辑">
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() => setEditingHorizontalIndex(index)}
                    />
                  </Tooltip>
                  <Popconfirm
                    title="确定删除此项目吗？"
                    onConfirm={() => onDeleteHorizontalItem(index)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Tooltip title="删除">
                      <Button type="text" icon={<DeleteOutlined />} size="small" danger />
                    </Tooltip>
                  </Popconfirm>
                </Space>
              </div>
            ))}
            {showAddHorizontal && (
              <div className="add-axis-item">
                <Input
                  placeholder="输入新的横轴项目"
                  size="small"
                  value={newHorizontalValue}
                  onChange={(e) => setNewHorizontalValue(e.target.value)}
                  onPressEnter={handleAddHorizontalItem}
                />
                <Space size="small">
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    size="small"
                    onClick={handleAddHorizontalItem}
                  >
                    保存
                  </Button>
                  <Button
                    icon={<UndoOutlined />}
                    size="small"
                    onClick={() => {
                      setShowAddHorizontal(false)
                      setNewHorizontalValue('')
                    }}
                  >
                    取消
                  </Button>
                </Space>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 纵轴数据 */}
      {verticalValues.length > 0 && (
        <Card
          title={`纵轴数据 (${metadata?.VerticalAxis || '纵轴'})`}
          className="axis-card"
          extra={
            <Button
              type="text"
              icon={<PlusOutlined />}
              onClick={() => setShowAddVertical(!showAddVertical)}
              size="small"
            >
              添加项目
            </Button>
          }
        >
          <div className="axis-values">
            {verticalValues.map((value, index) => (
              <div key={index} className="axis-value-item">
                {editingVerticalIndex === index ? (
                  <Input
                    defaultValue={value}
                    size="small"
                    onPressEnter={(e) => {
                      const newValue = (e.target as HTMLInputElement).value.trim()
                      handleEditVerticalItem(index, newValue)
                    }}
                    onBlur={(e) => {
                      const newValue = e.target.value.trim()
                      handleEditVerticalItem(index, newValue)
                    }}
                    autoFocus
                  />
                ) : (
                  <span className="axis-value">{value}</span>
                )}
                <Space size="small" className="axis-value-actions">
                  <Tooltip title="编辑">
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() => setEditingVerticalIndex(index)}
                    />
                  </Tooltip>
                  <Popconfirm
                    title="确定删除此项目吗？"
                    onConfirm={() => onDeleteVerticalItem(index)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Tooltip title="删除">
                      <Button type="text" icon={<DeleteOutlined />} size="small" danger />
                    </Tooltip>
                  </Popconfirm>
                </Space>
              </div>
            ))}
            {showAddVertical && (
              <div className="add-axis-item">
                <Input
                  placeholder="输入新的纵轴项目"
                  size="small"
                  value={newVerticalValue}
                  onChange={(e) => setNewVerticalValue(e.target.value)}
                  onPressEnter={handleAddVerticalItem}
                />
                <Space size="small">
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    size="small"
                    onClick={handleAddVerticalItem}
                  >
                    保存
                  </Button>
                  <Button
                    icon={<UndoOutlined />}
                    size="small"
                    onClick={() => {
                      setShowAddVertical(false)
                      setNewVerticalValue('')
                    }}
                  >
                    取消
                  </Button>
                </Space>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
