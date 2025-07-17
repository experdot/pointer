import React, { useState } from 'react'
import { Button, Typography, Card, Input, Space, Tooltip, Empty, Collapse } from 'antd'
import { InfoCircleOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons'
import { ObjectChat } from '../../../types/type'
import { useAppStores } from '../../../stores'
import PropertyTableEditor from './PropertyTableEditor'
import ConnectionEditor from './ConnectionEditor'
import RelationManager from './RelationManager'

const { Title, Text } = Typography
const { TextArea } = Input

interface ObjectPropertyViewProps {
  chatId: string
}

const ObjectPropertyView: React.FC<ObjectPropertyViewProps> = ({ chatId }) => {
  const stores = useAppStores()
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')

  // 从状态中获取对象聊天数据
  const chat = stores.pages.findPageById(chatId) as ObjectChat | undefined

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
        case 'properties':
          parsedValue = JSON.parse(editValue)
          break
        default:
          parsedValue = editValue
      }

      // 更新节点
      stores.object.updateObjectNode(chat.id, selectedNode.id, { [editingField]: parsedValue })

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

  // 保存属性
  const handlePropertiesSave = (properties: { [key: string]: any }) => {
    if (!selectedNode) return

    stores.object.updateObjectNode(chat.id, selectedNode.id, { properties })
  }

  // 保存连接
  const handleConnectionsSave = (connections: any[]) => {
    if (!selectedNode) return

    stores.object.updateObjectNode(chat.id, selectedNode.id, { connections })
  }

  // 创建关系节点
  const handleCreateRelation = async (
    sourceNodeId: string,
    targetNodeId: string,
    prompt: string
  ) => {
    if (!selectedNode) return

    // 这里需要调用AI服务生成关系节点
    console.log('创建关系节点:', { sourceNodeId, targetNodeId, prompt })
    // 后续在AI生成器中实现
  }

  // 删除节点
  const handleDeleteNode = (nodeId: string) => {
    stores.object.deleteObjectNode(chat.id, nodeId)
  }

  // 格式化显示值
  const formatDisplayValue = (value: any): string => {
    if (value === null || value === undefined) {
      return 'null'
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2)
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('circular')) {
          return '[Object with circular reference]'
        }
        return '[Object - Unable to stringify]'
      }
    }
    return String(value)
  }

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN')
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
                fontFamily: field === 'properties' ? 'monospace' : 'inherit',
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px'
          }}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="请选择一个对象节点查看详细信息"
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px', height: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Title level={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <InfoCircleOutlined />
          属性详情
        </Title>
      </div>

      <div style={{ padding: '16px' }}>
        {/* 基本信息 */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Title level={5} style={{ margin: '0 0 12px 0' }}>
            基本信息
          </Title>

          <div style={{ background: '#fafafa', padding: '12px', borderRadius: '4px' }}>
            {renderPropertyItem('名称', selectedNode.name, 'name', true)}
            {renderPropertyItem('类型', selectedNode.type, 'type', true)}
            {renderPropertyItem('描述', selectedNode.description, 'description', true)}
          </div>
        </Card>

        {/* 属性信息 */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Title level={5} style={{ margin: '0 0 12px 0' }}>
            属性信息
          </Title>
          <PropertyTableEditor
            properties={selectedNode.properties || {}}
            onSave={handlePropertiesSave}
          />
        </Card>

        {/* 节点连接 */}
        <div style={{ marginBottom: '16px' }}>
          <ConnectionEditor
            connections={selectedNode.connections || []}
            allNodes={nodes}
            currentNodeId={selectedNode.id}
            onSave={handleConnectionsSave}
          />
        </div>

        {/* 关系管理 */}
        <div style={{ marginBottom: '16px' }}>
          <RelationManager
            allNodes={nodes}
            currentNodeId={selectedNode.id}
            onCreateRelation={handleCreateRelation}
            onDeleteNode={handleDeleteNode}
          />
        </div>

        {/* 元数据 */}
        {selectedNode.metadata && (
          <Card size="small" style={{ marginBottom: '16px' }}>
            <Title level={5} style={{ margin: '0 0 12px 0' }}>
              元数据
            </Title>
            <div style={{ background: '#fafafa', padding: '12px', borderRadius: '4px' }}>
              {renderPropertyItem('创建时间', formatTime(selectedNode.metadata.createdAt))}
              {renderPropertyItem('来源', selectedNode.metadata.source)}
              {selectedNode.metadata.updatedAt &&
                renderPropertyItem('修改时间', formatTime(selectedNode.metadata.updatedAt))}
            </div>
          </Card>
        )}

        {/* 层级信息 */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Collapse
            ghost
            size="small"
            items={[
              {
                key: 'hierarchy',
                label: '层级信息',
                children: (
                  <div style={{ background: '#fafafa', padding: '12px', borderRadius: '4px' }}>
                    {renderPropertyItem('ID', selectedNode.id)}
                    {renderPropertyItem('父节点ID', selectedNode.parentId)}
                    {renderPropertyItem(
                      '子节点数量',
                      selectedNode.children ? selectedNode.children.length : 0
                    )}
                  </div>
                )
              }
            ]}
          />
        </Card>
      </div>
    </div>
  )
}

export default ObjectPropertyView
