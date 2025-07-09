import React, { useState, useCallback, useMemo } from 'react'
import { Input, Typography, Space } from 'antd'
import { SearchOutlined, FolderOutlined } from '@ant-design/icons'
import { useAppContext } from '../../../store/AppContext'
import { ObjectChat } from '../../../types'
import ObjectNode from './ObjectNode'
import ObjectToolbar from './ObjectToolbar'

const { Title } = Typography

interface ObjectBrowserProps {
  chatId: string
}

const ObjectBrowser: React.FC<ObjectBrowserProps> = ({ chatId }) => {
  const { state, dispatch } = useAppContext()
  const [searchQuery, setSearchQuery] = useState('')

  // 从状态中获取对象聊天数据
  const chat = state.pages.find((p) => p.id === chatId) as ObjectChat | undefined

  if (!chat || chat.type !== 'object') {
    return <div>数据加载错误</div>
  }

  // 获取对象数据
  const objectData = chat.objectData
  const { nodes, rootNodeId, selectedNodeId, expandedNodes } = objectData

  // 搜索过滤
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return Object.values(nodes)
    }

    const query = searchQuery.toLowerCase()
    return Object.values(nodes).filter(
      (node) =>
        node.name.toLowerCase().includes(query) ||
        node.description?.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query)
    )
  }, [nodes, searchQuery])

  // 构建树状结构
  const buildNodeTree = useCallback(
    (nodeId: string, level: number = 0): React.ReactElement[] => {
      const node = nodes[nodeId]
      if (!node) return []

      // 如果有搜索查询且当前节点不在过滤结果中，跳过
      if (searchQuery && !filteredNodes.find((n) => n.id === nodeId)) {
        return []
      }

      const isExpanded = expandedNodes.includes(nodeId)
      const hasChildren = node.children && node.children.length > 0
      const isSelected = selectedNodeId === nodeId

      const nodeElement = (
        <ObjectNode
          key={nodeId}
          node={node}
          level={level}
          isSelected={isSelected}
          isExpanded={isExpanded}
          hasChildren={hasChildren}
          onSelect={() => handleNodeSelect(nodeId)}
          onToggleExpansion={() => handleToggleExpansion(nodeId)}
          onDelete={() => handleDeleteNode(nodeId)}
          onGenerateChildren={() => {}} // 空函数，因为AI生成器已经移到右侧
        />
      )

      const elements = [nodeElement]

      // 如果展开且有子节点，递归渲染子节点
      if (isExpanded && hasChildren) {
        node.children?.forEach((childId) => {
          elements.push(...buildNodeTree(childId, level + 1))
        })
      }

      return elements
    },
    [nodes, expandedNodes, selectedNodeId, filteredNodes, searchQuery]
  )

  // 处理节点选择
  const handleNodeSelect = useCallback(
    (nodeId: string) => {
      dispatch({
        type: 'SELECT_OBJECT_NODE',
        payload: { chatId: chat.id, nodeId }
      })
    },
    [dispatch, chat.id]
  )

  // 处理节点展开/折叠
  const handleToggleExpansion = useCallback(
    (nodeId: string) => {
      dispatch({
        type: 'TOGGLE_OBJECT_NODE_EXPANSION',
        payload: { chatId: chat.id, nodeId }
      })
    },
    [dispatch, chat.id]
  )

  // 处理删除节点
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (window.confirm('确定要删除这个节点吗？这将同时删除所有子节点。')) {
        dispatch({
          type: 'DELETE_OBJECT_NODE',
          payload: { chatId: chat.id, nodeId }
        })
      }
    },
    [dispatch, chat.id]
  )

  // 处理搜索
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value
      setSearchQuery(query)

      dispatch({
        type: 'SEARCH_OBJECT_NODES',
        payload: { chatId: chat.id, query }
      })
    },
    [dispatch, chat.id]
  )

  // 渲染根节点及其子树
  const renderTree = useMemo(() => {
    if (!rootNodeId || !nodes[rootNodeId]) {
      return <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>没有对象数据</div>
    }

    return buildNodeTree(rootNodeId)
  }, [rootNodeId, nodes, buildNodeTree])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 头部 */}
      <div style={{ borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ padding: '12px 16px' }}>
          <Title level={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderOutlined />
            对象浏览器
          </Title>
        </div>

        {/* 工具栏 */}
        <ObjectToolbar chatId={chatId} />

        <div style={{ padding: '0 16px 12px' }}>
          {/* 搜索框 */}
          <Input
            placeholder="搜索对象节点..."
            value={searchQuery}
            onChange={handleSearchChange}
            prefix={<SearchOutlined />}
            size="small"
            allowClear
          />
        </div>
      </div>

      {/* 对象树 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>{renderTree}</div>
    </div>
  )
}

export default ObjectBrowser
