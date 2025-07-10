import React, { useState, useMemo } from 'react'
import { Button, Card, TreeSelect, Space, Typography, Alert, message, Tooltip } from 'antd'
import {
  TableOutlined,
  NodeIndexOutlined,
  ArrowRightOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import { ObjectChat, ObjectNode as ObjectNodeType } from '../../../types'
import { useAppContext } from '../../../store/AppContext'

const { Text } = Typography

interface ObjectCrosstabAnalyzerProps {
  chatId: string
}

// 获取节点类型的图标
const getNodeIcon = (type: ObjectNodeType['type']) => {
  switch (type) {
    case 'object':
      return '📦'
    case 'array':
      return '📋'
    case 'string':
      return '📝'
    case 'number':
      return '🔢'
    case 'boolean':
      return '✅'
    case 'function':
      return '⚙️'
    case 'custom':
      return '🔧'
    default:
      return '📄'
  }
}

const ObjectCrosstabAnalyzer: React.FC<ObjectCrosstabAnalyzerProps> = ({ chatId }) => {
  const { state, dispatch } = useAppContext()
  const [selectedHorizontalNode, setSelectedHorizontalNode] = useState<string | null>(null)
  const [selectedVerticalNode, setSelectedVerticalNode] = useState<string | null>(null)

  // 从状态中获取对象聊天数据
  const chat = state.pages.find((p) => p.id === chatId) as ObjectChat | undefined

  if (!chat || chat.type !== 'object') {
    return <div>数据加载错误</div>
  }

  const { nodes, rootNodeId } = chat.objectData

  // 构建TreeSelect所需的树形数据结构
  const buildTreeSelectData = useMemo(() => {
    const buildTreeData = (nodeId: string): any => {
      const node = nodes[nodeId]
      if (!node) return null

      const hasChildren = node.children && node.children.length > 0
      const childrenData = hasChildren 
        ? node.children.map(childId => buildTreeData(childId)).filter(Boolean)
        : []

      return {
        title: (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px' }}>{getNodeIcon(node.type)}</span>
            <span>{node.name}</span>
            {node.children && node.children.length > 0 && (
              <Text type="secondary" style={{ fontSize: '11px' }}>
                ({node.children.length} 个子项)
              </Text>
            )}
          </div>
        ),
        value: node.id,
        key: node.id,
        children: childrenData.length > 0 ? childrenData : undefined
      }
    }

    if (!rootNodeId || !nodes[rootNodeId]) {
      return []
    }

    const rootTreeData = buildTreeData(rootNodeId)
    return rootTreeData ? [rootTreeData] : []
  }, [nodes, rootNodeId])

  // 获取节点的祖先节点链
  const getAncestorChain = (nodeId: string): ObjectNodeType[] => {
    const node = nodes[nodeId]
    if (!node) return []

    const chain = [node]
    let current = node
    while (current.parentId && nodes[current.parentId]) {
      current = nodes[current.parentId]
      chain.unshift(current)
    }
    return chain
  }

  // 获取节点的完整上下文信息
  const getNodeContext = (nodeId: string) => {
    const node = nodes[nodeId]
    if (!node) return null

    const ancestorChain = getAncestorChain(nodeId)
    const children = (node.children || []).map((childId) => nodes[childId]).filter(Boolean)

    // 获取平级节点
    const siblings =
      node.parentId && nodes[node.parentId]
        ? nodes[node.parentId].children
            .map((childId) => nodes[childId])
            .filter((child) => child && child.id !== node.id)
        : []

    return {
      node,
      ancestorChain,
      children,
      siblings
    }
  }

  // 获取选中节点的信息
  const getNodeInfo = (nodeId: string | null) => {
    if (!nodeId) return null
    const node = nodes[nodeId]
    if (!node) return null

    const children = node.children ? node.children.map((childId) => nodes[childId]).filter(Boolean) : []
    return {
      node,
      children,
      count: children.length
    }
  }

  const horizontalNodeInfo = getNodeInfo(selectedHorizontalNode)
  const verticalNodeInfo = getNodeInfo(selectedVerticalNode)

  // 处理创建交叉分析
  const handleCreateCrosstab = () => {
    if (!selectedHorizontalNode || !selectedVerticalNode) {
      message.warning('请选择横轴和纵轴节点')
      return
    }

    const horizontalNode = nodes[selectedHorizontalNode]
    const verticalNode = nodes[selectedVerticalNode]

    if (!horizontalNode || !verticalNode) {
      message.error('选中的节点不存在')
      return
    }

    // 获取横轴和纵轴的完整上下文信息
    const horizontalContext = getNodeContext(selectedHorizontalNode)
    const verticalContext = getNodeContext(selectedVerticalNode)

    // 创建交叉分析标题
    const title = `${horizontalNode.name} × ${verticalNode.name} 交叉分析`

    // 派发创建交叉表的action，传递完整的上下文信息
    dispatch({
      type: 'CREATE_CROSSTAB_FROM_OBJECTS',
      payload: {
        title,
        folderId: chat.folderId,
        horizontalNodeId: selectedHorizontalNode,
        verticalNodeId: selectedVerticalNode,
        objectData: chat.objectData,
        horizontalContext,
        verticalContext,
        sourcePageId: chatId
      }
    })

    message.success('交叉分析表已创建！')

    // 重置选择
    setSelectedHorizontalNode(null)
    setSelectedVerticalNode(null)
  }

  // 检查是否可以创建交叉分析
  const canCreateCrosstab =
    selectedHorizontalNode &&
    selectedVerticalNode

  return (
    <Card
      size="small"
      style={{ margin: '16px', borderRadius: '8px' }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TableOutlined />
          <span>交叉分析</span>
          <Tooltip title="选择两个对象进行交叉分析">
            <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: '14px' }} />
          </Tooltip>
        </div>
      }
    >
      {Object.keys(nodes).length === 0 ? (
        <Alert
          message="暂无可用节点"
          description="需要至少有对象数据才能进行交叉分析"
          type="info"
          showIcon
          style={{ fontSize: '12px' }}
        />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* 横轴选择 */}
          <div>
            <Text strong style={{ fontSize: '12px', marginBottom: '8px', display: 'block' }}>
              横轴节点：
            </Text>
            <TreeSelect
              placeholder="选择横轴节点"
              value={selectedHorizontalNode}
              onChange={setSelectedHorizontalNode}
              treeData={buildTreeSelectData}
              style={{ width: '100%' }}
              size="small"
              showSearch
              treeNodeFilterProp="title"
              dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
              allowClear
            />
            {horizontalNodeInfo && horizontalNodeInfo.children.length > 0 && (
              <div style={{ marginTop: '4px', fontSize: '11px', color: '#8c8c8c' }}>
                子节点：{horizontalNodeInfo.children.map((child) => child.name).join(', ')}
              </div>
            )}
          </div>

          {/* 纵轴选择 */}
          <div>
            <Text strong style={{ fontSize: '12px', marginBottom: '8px', display: 'block' }}>
              纵轴节点：
            </Text>
            <TreeSelect
              placeholder="选择纵轴节点"
              value={selectedVerticalNode}
              onChange={setSelectedVerticalNode}
              treeData={buildTreeSelectData}
              style={{ width: '100%' }}
              size="small"
              showSearch
              treeNodeFilterProp="title"
              dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
              allowClear
            />
            {verticalNodeInfo && verticalNodeInfo.children.length > 0 && (
              <div style={{ marginTop: '4px', fontSize: '11px', color: '#8c8c8c' }}>
                子节点：{verticalNodeInfo.children.map((child) => child.name).join(', ')}
              </div>
            )}
          </div>

          {/* 预览信息 */}
          {selectedHorizontalNode && selectedVerticalNode && (
            <Alert
              message={
                <div style={{ fontSize: '11px' }}>
                  <div>
                    将创建基于 {nodes[selectedHorizontalNode].name} × {nodes[selectedVerticalNode].name} 的交叉分析表
                  </div>
                  <div style={{ marginTop: '4px', color: '#8c8c8c' }}>
                    横轴：{nodes[selectedHorizontalNode].name}
                    <ArrowRightOutlined style={{ margin: '0 8px' }} />
                    纵轴：{nodes[selectedVerticalNode].name}
                  </div>
                </div>
              }
              type="success"
              showIcon
            />
          )}

          {/* 创建按钮 */}
          <Button
            type="primary"
            icon={<TableOutlined />}
            onClick={handleCreateCrosstab}
            disabled={!canCreateCrosstab}
            style={{ width: '100%' }}
            size="small"
          >
            创建交叉分析表
          </Button>
        </Space>
      )}
    </Card>
  )
}

export default ObjectCrosstabAnalyzer
