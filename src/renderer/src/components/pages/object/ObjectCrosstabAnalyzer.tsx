import React, { useState, useMemo } from 'react'
import { Button, Card, Select, Space, Typography, Alert, message, Tooltip } from 'antd'
import { 
  TableOutlined, 
  NodeIndexOutlined, 
  ArrowRightOutlined, 
  InfoCircleOutlined 
} from '@ant-design/icons'
import { ObjectChat } from '../../../types'
import { useAppContext } from '../../../store/AppContext'

const { Title, Text } = Typography
const { Option } = Select

interface ObjectCrosstabAnalyzerProps {
  chatId: string
}

const ObjectCrosstabAnalyzer: React.FC<ObjectCrosstabAnalyzerProps> = ({ chatId }) => {
  const { state, dispatch } = useAppContext()
  const [selectedHorizontalNode, setSelectedHorizontalNode] = useState<string | null>(null)
  const [selectedVerticalNode, setSelectedVerticalNode] = useState<string | null>(null)

  // 从状态中获取对象聊天数据
  const chat = state.pages.find(p => p.id === chatId) as ObjectChat | undefined
  
  if (!chat || chat.type !== 'object') {
    return <div>数据加载错误</div>
  }

  const { nodes } = chat.objectData

  // 获取有子节点的节点列表（可用作横轴/纵轴）
  const availableNodes = useMemo(() => {
    return Object.values(nodes).filter(node => 
      node.children && node.children.length > 0
    )
  }, [nodes])

  // 获取选中节点的子节点信息
  const getNodeChildrenInfo = (nodeId: string | null) => {
    if (!nodeId) return null
    const node = nodes[nodeId]
    if (!node || !node.children) return null
    
    const children = node.children.map(childId => nodes[childId]).filter(Boolean)
    return {
      node,
      children,
      count: children.length
    }
  }

  const horizontalNodeInfo = getNodeChildrenInfo(selectedHorizontalNode)
  const verticalNodeInfo = getNodeChildrenInfo(selectedVerticalNode)

  // 处理创建交叉分析
  const handleCreateCrosstab = () => {
    if (!selectedHorizontalNode || !selectedVerticalNode) {
      message.warning('请选择横轴和纵轴节点')
      return
    }

    if (selectedHorizontalNode === selectedVerticalNode) {
      message.warning('横轴和纵轴不能是同一个节点')
      return
    }

    const horizontalNode = nodes[selectedHorizontalNode]
    const verticalNode = nodes[selectedVerticalNode]

    if (!horizontalNode || !verticalNode) {
      message.error('选中的节点不存在')
      return
    }

    // 创建交叉分析标题
    const title = `${horizontalNode.name} × ${verticalNode.name} 交叉分析`

    // 派发创建交叉表的action
    dispatch({
      type: 'CREATE_CROSSTAB_FROM_OBJECTS',
      payload: {
        title,
        folderId: chat.folderId,
        horizontalNodeId: selectedHorizontalNode,
        verticalNodeId: selectedVerticalNode,
        objectData: chat.objectData
      }
    })

    message.success('交叉分析表已创建！')

    // 重置选择
    setSelectedHorizontalNode(null)
    setSelectedVerticalNode(null)
  }

  // 检查是否可以创建交叉分析
  const canCreateCrosstab = selectedHorizontalNode && 
                           selectedVerticalNode && 
                           selectedHorizontalNode !== selectedVerticalNode &&
                           horizontalNodeInfo && 
                           verticalNodeInfo &&
                           horizontalNodeInfo.count > 0 && 
                           verticalNodeInfo.count > 0

  return (
    <Card 
      size="small" 
      style={{ margin: '16px', borderRadius: '8px' }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TableOutlined />
          <span>交叉分析</span>
          <Tooltip title="选择两个有子节点的对象，基于它们的子节点创建交叉分析表">
            <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: '14px' }} />
          </Tooltip>
        </div>
      }
    >
      {availableNodes.length === 0 ? (
        <Alert
          message="暂无可用节点"
          description="需要至少两个有子节点的对象才能进行交叉分析"
          type="info"
          showIcon
          style={{ fontSize: '12px' }}
        />
      ) : availableNodes.length < 2 ? (
        <Alert
          message="节点数量不足"
          description={`当前只有 ${availableNodes.length} 个有子节点的对象，需要至少2个才能进行交叉分析`}
          type="warning"
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
            <Select
              placeholder="选择横轴节点"
              value={selectedHorizontalNode}
              onChange={setSelectedHorizontalNode}
              style={{ width: '100%' }}
              size="small"
            >
              {availableNodes.map(node => (
                <Option key={node.id} value={node.id}>
                  <Space>
                    <NodeIndexOutlined />
                    <span>{node.name}</span>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      ({node.children?.length || 0} 个子项)
                    </Text>
                  </Space>
                </Option>
              ))}
            </Select>
            {horizontalNodeInfo && (
              <div style={{ marginTop: '4px', fontSize: '11px', color: '#8c8c8c' }}>
                子节点：{horizontalNodeInfo.children.map(child => child.name).join(', ')}
              </div>
            )}
          </div>

          {/* 纵轴选择 */}
          <div>
            <Text strong style={{ fontSize: '12px', marginBottom: '8px', display: 'block' }}>
              纵轴节点：
            </Text>
            <Select
              placeholder="选择纵轴节点"
              value={selectedVerticalNode}
              onChange={setSelectedVerticalNode}
              style={{ width: '100%' }}
              size="small"
            >
              {availableNodes.map(node => (
                <Option 
                  key={node.id} 
                  value={node.id}
                  disabled={node.id === selectedHorizontalNode}
                >
                  <Space>
                    <NodeIndexOutlined />
                    <span>{node.name}</span>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      ({node.children?.length || 0} 个子项)
                    </Text>
                  </Space>
                </Option>
              ))}
            </Select>
            {verticalNodeInfo && (
              <div style={{ marginTop: '4px', fontSize: '11px', color: '#8c8c8c' }}>
                子节点：{verticalNodeInfo.children.map(child => child.name).join(', ')}
              </div>
            )}
          </div>

          {/* 预览信息 */}
          {horizontalNodeInfo && verticalNodeInfo && selectedHorizontalNode !== selectedVerticalNode && (
            <Alert
              message={
                <div style={{ fontSize: '11px' }}>
                  <div>将创建 {horizontalNodeInfo.count} × {verticalNodeInfo.count} 的交叉分析表</div>
                  <div style={{ marginTop: '4px', color: '#8c8c8c' }}>
                    横轴：{horizontalNodeInfo.node.name} ({horizontalNodeInfo.count} 项)
                    <ArrowRightOutlined style={{ margin: '0 8px' }} />
                    纵轴：{verticalNodeInfo.node.name} ({verticalNodeInfo.count} 项)
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