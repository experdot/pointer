import React, { useEffect, useRef, useState } from 'react'
import { Card, Typography, Select, Space, Button, Tooltip, Tag } from 'antd'
import {
  ExpandOutlined,
  CompressOutlined,
  ReloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import { ObjectNode as ObjectNodeType, NodeConnection } from '../../../types/type'

const { Title, Text } = Typography
const { Option } = Select

interface RelationshipGraphProps {
  allNodes: { [nodeId: string]: ObjectNodeType }
  selectedNodeId?: string
  onNodeClick?: (nodeId: string) => void
  width?: number
  height?: number
}

interface GraphNode {
  id: string
  name: string
  type: string
  x: number
  y: number
  connections: NodeConnection[]
}

interface GraphEdge {
  source: string
  target: string
  role: string
  strength: 'weak' | 'medium' | 'strong'
  description?: string
}

const RelationshipGraph: React.FC<RelationshipGraphProps> = ({
  allNodes,
  selectedNodeId,
  onNodeClick,
  width = 800,
  height = 600
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({
    nodes: [],
    edges: []
  })
  const [viewMode, setViewMode] = useState<'all' | 'selected' | 'relations'>('all')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // 获取节点类型颜色
  const getNodeTypeColor = (type: string) => {
    switch (type) {
      case 'entity':
        return '#1890ff'
      case 'event':
        return '#52c41a'
      case 'relation':
        return '#722ed1'
      default:
        return '#1890ff'
    }
  }

  // 获取连接强度颜色
  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong':
        return '#ff4d4f'
      case 'medium':
        return '#faad14'
      case 'weak':
        return '#13c2c2'
      default:
        return '#d9d9d9'
    }
  }

  // 获取连接强度粗细
  const getStrengthWidth = (strength: string) => {
    switch (strength) {
      case 'strong':
        return 3
      case 'medium':
        return 2
      case 'weak':
        return 1
      default:
        return 1
    }
  }

  // 构建图数据
  const buildGraphData = () => {
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    const nodeMap = new Map<string, GraphNode>()

    // 根据视图模式过滤节点
    const filteredNodes = Object.values(allNodes).filter((node) => {
      switch (viewMode) {
        case 'selected':
          return (
            node.id === selectedNodeId ||
            node.connections?.some((conn) => conn.nodeId === selectedNodeId) ||
            allNodes[selectedNodeId]?.connections?.some((conn) => conn.nodeId === node.id)
          )
        case 'relations':
          return node.type === 'relation'
        default:
          return true
      }
    })

    // 创建节点
    filteredNodes.forEach((node, index) => {
      const graphNode: GraphNode = {
        id: node.id,
        name: node.name,
        type: node.type || 'entity',
        x: 0,
        y: 0,
        connections: node.connections || []
      }
      nodes.push(graphNode)
      nodeMap.set(node.id, graphNode)
    })

    // 创建边
    filteredNodes.forEach((node) => {
      if (node.connections) {
        node.connections.forEach((conn) => {
          const targetNode = allNodes[conn.nodeId]
          if (targetNode && nodeMap.has(conn.nodeId)) {
            edges.push({
              source: node.id,
              target: conn.nodeId,
              role: conn.role,
              strength: conn.strength || 'medium',
              description: conn.description
            })
          }
        })
      }
    })

    // 简单的圆形布局
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 3

    nodes.forEach((node, index) => {
      const angle = (index * 2 * Math.PI) / nodes.length
      node.x = centerX + radius * Math.cos(angle)
      node.y = centerY + radius * Math.sin(angle)
    })

    return { nodes, edges }
  }

  // 更新图数据
  useEffect(() => {
    const data = buildGraphData()
    setGraphData(data)
  }, [allNodes, selectedNodeId, viewMode, width, height])

  // 处理节点点击
  const handleNodeClick = (nodeId: string) => {
    if (onNodeClick) {
      onNodeClick(nodeId)
    }
  }

  // 刷新布局
  const refreshLayout = () => {
    const data = buildGraphData()
    setGraphData(data)
  }

  // 切换全屏
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const currentWidth = isFullscreen ? window.innerWidth - 100 : width
  const currentHeight = isFullscreen ? window.innerHeight - 200 : height

  return (
    <Card
      size="small"
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={5} style={{ margin: 0 }}>
            <InfoCircleOutlined style={{ marginRight: 8 }} />
            关系图谱
          </Title>
          <Space>
            <Select value={viewMode} onChange={setViewMode} size="small" style={{ width: 120 }}>
              <Option value="all">全部节点</Option>
              <Option value="selected">相关节点</Option>
              <Option value="relations">关系节点</Option>
            </Select>
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={refreshLayout}
              title="刷新布局"
            />
            <Button
              type="text"
              size="small"
              icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
              onClick={toggleFullscreen}
              title={isFullscreen ? '退出全屏' : '全屏显示'}
            />
          </Space>
        </div>
      }
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? '50px' : 'auto',
        left: isFullscreen ? '50px' : 'auto',
        width: isFullscreen ? 'calc(100vw - 100px)' : '100%',
        height: isFullscreen ? 'calc(100vh - 100px)' : 'auto',
        zIndex: isFullscreen ? 1000 : 'auto'
      }}
    >
      <div style={{ width: '100%', height: currentHeight, overflow: 'auto' }}>
        <svg
          ref={svgRef}
          width={currentWidth}
          height={currentHeight}
          style={{ border: '1px solid #f0f0f0', borderRadius: '4px' }}
        >
          {/* 定义箭头标记 */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
            </marker>
          </defs>

          {/* 绘制边 */}
          {graphData.edges.map((edge, index) => {
            const sourceNode = graphData.nodes.find((n) => n.id === edge.source)
            const targetNode = graphData.nodes.find((n) => n.id === edge.target)

            if (!sourceNode || !targetNode) return null

            return (
              <g key={`edge-${index}`}>
                <line
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke={getStrengthColor(edge.strength)}
                  strokeWidth={getStrengthWidth(edge.strength)}
                  markerEnd="url(#arrowhead)"
                />
                {/* 边标签 */}
                <text
                  x={(sourceNode.x + targetNode.x) / 2}
                  y={(sourceNode.y + targetNode.y) / 2}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#666"
                  dy="-5"
                >
                  {edge.role}
                </text>
              </g>
            )
          })}

          {/* 绘制节点 */}
          {graphData.nodes.map((node) => {
            const isSelected = node.id === selectedNodeId
            const nodeColor = getNodeTypeColor(node.type)
            const radius = isSelected ? 25 : 20

            return (
              <g
                key={node.id}
                onClick={() => handleNodeClick(node.id)}
                style={{ cursor: 'pointer' }}
              >
                {/* 节点圆圈 */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={nodeColor}
                  stroke={isSelected ? '#ff4d4f' : '#fff'}
                  strokeWidth={isSelected ? 3 : 2}
                  opacity={0.8}
                />

                {/* 节点标签 */}
                <text
                  x={node.x}
                  y={node.y + radius + 15}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#333"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                >
                  {node.name.length > 8 ? `${node.name.substring(0, 8)}...` : node.name}
                </text>

                {/* 节点类型标签 */}
                <text
                  x={node.x}
                  y={node.y + radius + 30}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#666"
                >
                  {node.type}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* 图例 */}
      <div
        style={{ marginTop: '16px', padding: '8px', background: '#fafafa', borderRadius: '4px' }}
      >
        <Space direction="vertical" size="small">
          <div>
            <Text strong style={{ fontSize: '12px' }}>
              节点类型：
            </Text>
            <Space>
              <Tag color="blue">实体</Tag>
              <Tag color="green">事件</Tag>
              <Tag color="purple">关系</Tag>
            </Space>
          </div>
          <div>
            <Text strong style={{ fontSize: '12px' }}>
              连接强度：
            </Text>
            <Space>
              <Tag color="red">强</Tag>
              <Tag color="orange">中</Tag>
              <Tag color="cyan">弱</Tag>
            </Space>
          </div>
        </Space>
      </div>
    </Card>
  )
}

export default RelationshipGraph
