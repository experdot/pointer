import React, { useState } from 'react'
import {
  Button,
  Space,
  Table,
  Typography,
  Input,
  Select,
  Tooltip,
  Popconfirm,
  Card,
  Tag
} from 'antd'
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
  CloseOutlined
} from '@ant-design/icons'
import { NodeConnection, ObjectNode as ObjectNodeType } from '../../../types'

const { Title, Text } = Typography
const { Option } = Select

interface ConnectionEditorProps {
  connections: NodeConnection[]
  allNodes: { [nodeId: string]: ObjectNodeType }
  currentNodeId: string
  onSave: (connections: NodeConnection[]) => void
}

const ConnectionEditor: React.FC<ConnectionEditorProps> = ({
  connections,
  allNodes,
  currentNodeId,
  onSave
}) => {
  const [editingConnections, setEditingConnections] = useState<NodeConnection[]>([...connections])
  const [isEditing, setIsEditing] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // 获取可用的节点选项（排除当前节点）
  const getAvailableNodes = () => {
    return Object.values(allNodes).filter((node) => node.id !== currentNodeId)
  }

  // 开始编辑
  const startEdit = () => {
    setIsEditing(true)
    setEditingConnections([...connections])
  }

  // 保存编辑
  const saveEdit = () => {
    onSave(editingConnections)
    setIsEditing(false)
    setEditingIndex(null)
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingConnections([...connections])
    setIsEditing(false)
    setEditingIndex(null)
  }

  // 添加新连接
  const addConnection = () => {
    const newConnection: NodeConnection = {
      nodeId: '',
      role: '',
      description: '',
      strength: 'medium',
      metadata: {
        createdAt: Date.now(),
        source: 'user'
      }
    }
    setEditingConnections([...editingConnections, newConnection])
  }

  // 更新连接
  const updateConnection = (index: number, field: keyof NodeConnection, value: any) => {
    const updated = [...editingConnections]
    updated[index] = { ...updated[index], [field]: value }
    setEditingConnections(updated)
  }

  // 删除连接
  const deleteConnection = (index: number) => {
    const updated = editingConnections.filter((_, i) => i !== index)
    setEditingConnections(updated)
  }

  // 获取连接强度的颜色
  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong':
        return 'red'
      case 'medium':
        return 'orange'
      case 'weak':
        return 'blue'
      default:
        return 'default'
    }
  }

  // 获取连接强度的文本
  const getStrengthText = (strength: string) => {
    switch (strength) {
      case 'strong':
        return '强'
      case 'medium':
        return '中'
      case 'weak':
        return '弱'
      default:
        return '未知'
    }
  }

  const columns = [
    {
      title: '连接节点',
      dataIndex: 'nodeId',
      key: 'nodeId',
      render: (nodeId: string, record: NodeConnection, index: number) => {
        if (isEditing) {
          return (
            <Select
              value={nodeId}
              onChange={(value) => updateConnection(index, 'nodeId', value)}
              style={{ width: '100%' }}
              placeholder="选择节点"
            >
              {getAvailableNodes().map((node) => (
                <Option key={node.id} value={node.id}>
                  {node.name} ({node.type || 'unknown'})
                </Option>
              ))}
            </Select>
          )
        }

        const node = allNodes[nodeId]
        return node ? (
          <div>
            <Text strong>{node.name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {node.type || 'unknown'}
            </Text>
          </div>
        ) : (
          <Text type="danger">节点不存在</Text>
        )
      }
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string, record: NodeConnection, index: number) => {
        if (isEditing) {
          return (
            <Input
              value={role}
              onChange={(e) => updateConnection(index, 'role', e.target.value)}
              placeholder="角色"
            />
          )
        }
        return <Text>{role}</Text>
      }
    },
    {
      title: '强度',
      dataIndex: 'strength',
      key: 'strength',
      render: (strength: string, record: NodeConnection, index: number) => {
        if (isEditing) {
          return (
            <Select
              value={strength}
              onChange={(value) => updateConnection(index, 'strength', value)}
              style={{ width: '100%' }}
            >
              <Option value="strong">强</Option>
              <Option value="medium">中</Option>
              <Option value="weak">弱</Option>
            </Select>
          )
        }
        return <Tag color={getStrengthColor(strength)}>{getStrengthText(strength)}</Tag>
      }
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (description: string, record: NodeConnection, index: number) => {
        if (isEditing) {
          return (
            <Input.TextArea
              value={description}
              onChange={(e) => updateConnection(index, 'description', e.target.value)}
              placeholder="描述"
              rows={2}
            />
          )
        }
        return <Text>{description || '无'}</Text>
      }
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: NodeConnection, index: number) => {
        if (isEditing) {
          return (
            <Popconfirm
              title="确定删除这个连接吗？"
              onConfirm={() => deleteConnection(index)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="text" icon={<DeleteOutlined />} danger />
            </Popconfirm>
          )
        }
        return null
      }
    }
  ]

  return (
    <Card
      size="small"
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={5} style={{ margin: 0 }}>
            节点连接
          </Title>
          {!isEditing ? (
            <Button type="primary" size="small" icon={<EditOutlined />} onClick={startEdit}>
              编辑
            </Button>
          ) : (
            <Space>
              <Button type="primary" size="small" icon={<SaveOutlined />} onClick={saveEdit}>
                保存
              </Button>
              <Button size="small" icon={<CloseOutlined />} onClick={cancelEdit}>
                取消
              </Button>
            </Space>
          )}
        </div>
      }
    >
      <Table
        columns={columns}
        dataSource={isEditing ? editingConnections : connections}
        rowKey={(record, index) => `${record.nodeId}-${index}`}
        pagination={false}
        size="small"
        locale={{
          emptyText: '暂无连接'
        }}
      />

      {isEditing && (
        <div style={{ marginTop: '12px', textAlign: 'center' }}>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addConnection}
            style={{ width: '100%' }}
          >
            添加连接
          </Button>
        </div>
      )}
    </Card>
  )
}

export default ConnectionEditor
