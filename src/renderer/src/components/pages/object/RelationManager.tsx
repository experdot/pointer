import React, { useState } from 'react'
import { Button, Space, List, Typography, Card, Modal, Select, Input, Tag, Tooltip } from 'antd'
import {
  PlusOutlined,
  LinkOutlined,
  DeleteOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { ObjectNode as ObjectNodeType } from '../../../types'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

interface RelationManagerProps {
  allNodes: { [nodeId: string]: ObjectNodeType }
  currentNodeId: string
  onCreateRelation: (sourceNodeId: string, targetNodeId: string, prompt: string) => void
  onDeleteNode: (nodeId: string) => void
}

const RelationManager: React.FC<RelationManagerProps> = ({
  allNodes,
  currentNodeId,
  onCreateRelation,
  onDeleteNode
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [selectedTargetNode, setSelectedTargetNode] = useState<string>('')
  const [relationPrompt, setRelationPrompt] = useState('')

  // 获取当前节点
  const currentNode = allNodes[currentNodeId]

  // 获取所有关系节点
  const getRelationNodes = () => {
    return Object.values(allNodes).filter((node) => node.type === 'relation')
  }

  // 获取与当前节点相关的关系节点
  const getRelatedRelationNodes = () => {
    return getRelationNodes().filter((relationNode) =>
      relationNode.connections?.some((conn) => conn.nodeId === currentNodeId)
    )
  }

  // 获取可用的目标节点（排除当前节点和关系节点）
  const getAvailableTargetNodes = () => {
    return Object.values(allNodes).filter(
      (node) => node.id !== currentNodeId && node.type !== 'relation'
    )
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

  // 处理创建关系
  const handleCreateRelation = () => {
    if (!selectedTargetNode || !relationPrompt.trim()) {
      return
    }

    onCreateRelation(currentNodeId, selectedTargetNode, relationPrompt.trim())
    setIsModalVisible(false)
    setSelectedTargetNode('')
    setRelationPrompt('')
  }

  // 处理删除关系节点
  const handleDeleteRelation = (relationNodeId: string) => {
    onDeleteNode(relationNodeId)
  }

  // 渲染关系节点的连接信息
  const renderConnections = (relationNode: ObjectNodeType) => {
    if (!relationNode.connections || relationNode.connections.length === 0) {
      return <Text type="secondary">无连接</Text>
    }

    return (
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {relationNode.connections.map((conn, index) => {
          const connectedNode = allNodes[conn.nodeId]
          return (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag color={getStrengthColor(conn.strength || 'medium')}>
                {getStrengthText(conn.strength || 'medium')}
              </Tag>
              <Text>{conn.role}:</Text>
              <Text strong>{connectedNode?.name || '未知节点'}</Text>
              {conn.description && (
                <Tooltip title={conn.description}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    ({conn.description})
                  </Text>
                </Tooltip>
              )}
            </div>
          )
        })}
      </Space>
    )
  }

  const relatedRelationNodes = getRelatedRelationNodes()

  return (
    <Card
      size="small"
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={5} style={{ margin: 0 }}>
            <LinkOutlined /> 关系管理
          </Title>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setIsModalVisible(true)}
          >
            创建关系
          </Button>
        </div>
      }
    >
      <List
        dataSource={relatedRelationNodes}
        locale={{ emptyText: '暂无关系节点' }}
        renderItem={(relationNode) => (
          <List.Item
            key={relationNode.id}
            actions={[
              <Tooltip title="删除关系">
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  danger
                  size="small"
                  onClick={() => handleDeleteRelation(relationNode.id)}
                />
              </Tooltip>
            ]}
          >
            <List.Item.Meta
              avatar={<ThunderboltOutlined style={{ color: '#1890ff' }} />}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Text strong>{relationNode.name}</Text>
                  <Tag color="blue">{relationNode.type}</Tag>
                </div>
              }
              description={
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {relationNode.description || '无描述'}
                  </Text>
                  <div style={{ marginTop: '8px' }}>{renderConnections(relationNode)}</div>
                </div>
              }
            />
          </List.Item>
        )}
      />

      {/* 创建关系模态框 */}
      <Modal
        title="创建关系节点"
        open={isModalVisible}
        onOk={handleCreateRelation}
        onCancel={() => {
          setIsModalVisible(false)
          setSelectedTargetNode('')
          setRelationPrompt('')
        }}
        okText="创建"
        cancelText="取消"
        width={600}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>源节点: </Text>
            <Text>{currentNode?.name || '未知节点'}</Text>
          </div>

          <div>
            <Text strong>目标节点: </Text>
            <Select
              value={selectedTargetNode}
              onChange={setSelectedTargetNode}
              style={{ width: '100%', marginTop: '8px' }}
              placeholder="选择要连接的节点"
            >
              {getAvailableTargetNodes().map((node) => (
                <Option key={node.id} value={node.id}>
                  {node.name} ({node.type || 'unknown'})
                </Option>
              ))}
            </Select>
          </div>

          <div>
            <Text strong>关系描述: </Text>
            <TextArea
              value={relationPrompt}
              onChange={(e) => setRelationPrompt(e.target.value)}
              placeholder="描述这两个节点之间的关系..."
              rows={4}
              style={{ marginTop: '8px' }}
            />
          </div>
        </Space>
      </Modal>
    </Card>
  )
}

export default RelationManager
