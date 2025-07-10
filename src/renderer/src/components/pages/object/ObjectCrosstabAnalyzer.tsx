import React, { useState, useMemo } from 'react'
import { Button, Card, TreeSelect, Space, Typography, Alert, Tooltip, App } from 'antd'
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

const ObjectCrosstabAnalyzer: React.FC<ObjectCrosstabAnalyzerProps> = ({ chatId }) => {
  const { state, dispatch } = useAppContext()
  const { message } = App.useApp()
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
            <span style={{ fontSize: '12px' }}>📦</span>
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
          <span>交叉分析器</span>
        </div>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 说明 */}
        <Alert
          message="交叉分析"
          description="选择两个对象节点作为横轴和纵轴，创建交叉分析表来探索它们之间的关系。"
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
        />

        {/* 横轴选择 */}
        <div>
          <Text strong style={{ marginBottom: '8px', display: 'block' }}>
            选择横轴节点：
          </Text>
          <TreeSelect
            style={{ width: '100%' }}
            value={selectedHorizontalNode}
            onChange={setSelectedHorizontalNode}
            treeData={buildTreeSelectData}
            placeholder="请选择横轴节点"
            allowClear
            showSearch
            treeDefaultExpandAll
          />
          {horizontalNodeInfo && (
            <div style={{ marginTop: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                横轴：{horizontalNodeInfo.node.name} ({horizontalNodeInfo.count} 个子项)
              </Text>
            </div>
          )}
        </div>

        {/* 纵轴选择 */}
        <div>
          <Text strong style={{ marginBottom: '8px', display: 'block' }}>
            选择纵轴节点：
          </Text>
          <TreeSelect
            style={{ width: '100%' }}
            value={selectedVerticalNode}
            onChange={setSelectedVerticalNode}
            treeData={buildTreeSelectData}
            placeholder="请选择纵轴节点"
            allowClear
            showSearch
            treeDefaultExpandAll
          />
          {verticalNodeInfo && (
            <div style={{ marginTop: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                纵轴：{verticalNodeInfo.node.name} ({verticalNodeInfo.count} 个子项)
              </Text>
            </div>
          )}
        </div>

        {/* 预览 */}
        {canCreateCrosstab && (
          <div style={{ padding: '12px', background: '#f9f9f9', borderRadius: '4px' }}>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
              交叉分析预览：
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Text strong style={{ fontSize: '13px' }}>
                {horizontalNodeInfo?.node.name}
              </Text>
              <ArrowRightOutlined />
              <Text strong style={{ fontSize: '13px' }}>
                {verticalNodeInfo?.node.name}
              </Text>
            </div>
            <Text type="secondary" style={{ fontSize: '11px', marginTop: '4px', display: 'block' }}>
              将创建 {horizontalNodeInfo?.count} × {verticalNodeInfo?.count} 的交叉分析表
            </Text>
          </div>
        )}

        {/* 创建按钮 */}
        <Button
          type="primary"
          icon={<NodeIndexOutlined />}
          onClick={handleCreateCrosstab}
          disabled={!canCreateCrosstab}
          block
        >
          创建交叉分析表
        </Button>
      </Space>
    </Card>
  )
}

export default ObjectCrosstabAnalyzer
