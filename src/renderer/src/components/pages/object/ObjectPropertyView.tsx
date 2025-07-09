import React, { useState } from 'react'
import { Button, Typography, Card, Input, Space, Tooltip, Empty } from 'antd'
import { InfoCircleOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons'
import { ObjectChat, ObjectNode as ObjectNodeType } from '../../../types'
import { useAppContext } from '../../../store/AppContext'

const { Title, Text } = Typography
const { TextArea } = Input

interface ObjectPropertyViewProps {
  chatId: string
}

const ObjectPropertyView: React.FC<ObjectPropertyViewProps> = ({ chatId }) => {
  const { state, dispatch } = useAppContext()
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')

  // 从状态中获取对象聊天数据
  const chat = state.pages.find(p => p.id === chatId) as ObjectChat | undefined
  
  if (!chat || chat.type !== 'object') {
    return <div>数据加载错误</div>
  }

  const { nodes, selectedNodeId } = chat.objectData
  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null

  // 开始编辑
  const startEdit = (field: string, value: any) => {
    setEditingField(field)
    setEditValue(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || ''))
  }

  // 保存编辑
  const saveEdit = () => {
    if (!selectedNode || !editingField) return

    let parsedValue: any = editValue

    // 根据字段类型解析值
    try {
      switch (editingField) {
        case 'value':
          switch (selectedNode.type) {
            case 'number':
              parsedValue = Number(editValue)
              break
            case 'boolean':
              parsedValue = editValue.toLowerCase() === 'true'
              break
            case 'object':
            case 'array':
              parsedValue = JSON.parse(editValue)
              break
            default:
              parsedValue = editValue
          }
          break
        case 'properties':
          parsedValue = JSON.parse(editValue)
          break
        default:
          parsedValue = editValue
      }

      // 更新节点
      dispatch({
        type: 'UPDATE_OBJECT_NODE',
        payload: {
          chatId: chat.id,
          nodeId: selectedNode.id,
          updates: { [editingField]: parsedValue }
        }
      })

      setEditingField(null)
      setEditValue('')
    } catch (error) {
      alert('输入格式错误，请检查JSON格式是否正确')
    }
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingField(null)
    setEditValue('')
  }

  // 格式化显示值
  const formatDisplayValue = (value: any): string => {
    if (value === null || value === undefined) {
      return 'null'
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  // 获取节点类型显示名称
  const getTypeDisplayName = (type: ObjectNodeType['type']): string => {
    const typeNames = {
      object: '对象',
      array: '数组',
      string: '字符串',
      number: '数字',
      boolean: '布尔值',
      null: '空值',
      function: '函数',
      custom: '自定义'
    }
    return typeNames[type] || type
  }

  // 渲染属性项
  const renderPropertyItem = (label: string, value: any, field?: string, isEditable = false) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
      <Text type="secondary" style={{ minWidth: '80px', fontSize: '12px' }}>
        {label}:
      </Text>
      <div style={{ flex: 1 }}>
        {editingField === field ? (
          <Space.Compact style={{ width: '100%' }}>
            {field === 'description' ? (
              <TextArea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoSize={{ minRows: 3, maxRows: 6 }}
                style={{ flex: 1 }}
              />
            ) : (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                style={{ flex: 1 }}
              />
            )}
            <Button type="primary" size="small" icon={<SaveOutlined />} onClick={saveEdit} />
            <Button size="small" icon={<CloseOutlined />} onClick={cancelEdit} />
          </Space.Compact>
        ) : (
          <Space>
            <Text 
              style={{ 
                fontSize: '12px',
                fontFamily: field === 'value' || field === 'properties' ? 'monospace' : 'inherit',
                wordBreak: 'break-word'
              }}
            >
              {formatDisplayValue(value) || '无'}
            </Text>
            {isEditable && field && (
              <Tooltip title="编辑">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => startEdit(field, value)}
                />
              </Tooltip>
            )}
          </Space>
        )}
      </div>
    </div>
  )

  if (!selectedNode) {
    return (
      <div style={{ padding: '16px', height: '100%' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <Title level={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <InfoCircleOutlined />
            属性详情
          </Title>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '200px' 
        }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="请选择一个对象节点查看详细信息"
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 头部 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Title level={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <InfoCircleOutlined />
          {selectedNode.name} - 属性详情
        </Title>
      </div>

      {/* 内容 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* 基本信息 */}
          <Card size="small" title="基本信息" style={{ width: '100%' }}>
            {renderPropertyItem('名称', selectedNode.name, 'name', true)}
            {renderPropertyItem('类型', getTypeDisplayName(selectedNode.type))}
            {renderPropertyItem('ID', selectedNode.id)}
            {selectedNode.parentId && renderPropertyItem('父节点', selectedNode.parentId)}
            {renderPropertyItem('描述', selectedNode.description, 'description', true)}
          </Card>

          {/* 值信息 */}
          {selectedNode.value !== undefined && (
            <Card size="small" title="值" style={{ width: '100%' }}>
              {renderPropertyItem('当前值', selectedNode.value, 'value', true)}
            </Card>
          )}

          {/* 属性信息 */}
          {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
            <Card size="small" title="属性" style={{ width: '100%' }}>
              {renderPropertyItem('对象属性', selectedNode.properties, 'properties', true)}
            </Card>
          )}

          {/* 层级信息 */}
          <Card size="small" title="层级信息" style={{ width: '100%' }}>
            {renderPropertyItem('是否展开', selectedNode.expanded ? '是' : '否')}
            {selectedNode.children && renderPropertyItem('子节点数量', selectedNode.children.length)}
            {selectedNode.children && selectedNode.children.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <Text type="secondary" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                  子节点ID:
                </Text>
                <div style={{ paddingLeft: '92px' }}>
                  {selectedNode.children.map(id => (
                    <Text key={id} code style={{ display: 'block', fontSize: '11px', marginBottom: '2px' }}>
                      {id}
                    </Text>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* 元数据 */}
          {selectedNode.metadata && (
            <Card size="small" title="元数据" style={{ width: '100%' }}>
              {selectedNode.metadata.source && renderPropertyItem('来源', selectedNode.metadata.source === 'ai' ? 'AI生成' : '用户创建')}
              {selectedNode.metadata.createdAt && renderPropertyItem('创建时间', formatTime(selectedNode.metadata.createdAt))}
              {selectedNode.metadata.updatedAt && renderPropertyItem('更新时间', formatTime(selectedNode.metadata.updatedAt))}
              {selectedNode.metadata.aiPrompt && renderPropertyItem('AI提示', selectedNode.metadata.aiPrompt)}
              {selectedNode.metadata.tags && selectedNode.metadata.tags.length > 0 && renderPropertyItem('标签', selectedNode.metadata.tags.join(', '))}
              {selectedNode.metadata.readonly && renderPropertyItem('只读', '是')}
            </Card>
          )}
        </Space>
      </div>
    </div>
  )
}

export default ObjectPropertyView 