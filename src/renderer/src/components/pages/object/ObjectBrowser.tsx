import React, { useState, useCallback, useMemo } from 'react'
import { Input, Typography, Space, Tree, Button, Modal, App } from 'antd'
import { SearchOutlined, FolderOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useAppContext } from '../../../store/AppContext'
import { ObjectChat, ObjectNode as ObjectNodeType } from '../../../types'
import ObjectToolbar from './ObjectToolbar'
import ObjectTreeNode from './ObjectTreeNode'

const { Title } = Typography

interface ObjectBrowserProps {
  chatId: string
}

const ObjectBrowser: React.FC<ObjectBrowserProps> = ({ chatId }) => {
  const { state, dispatch } = useAppContext()
  const [searchQuery, setSearchQuery] = useState('')
  const { modal } = App.useApp()

  // 从状态中获取对象聊天数据
  const chat = state.pages.find((p) => p.id === chatId) as ObjectChat | undefined

  if (!chat || chat.type !== 'object') {
    return <div>数据加载错误</div>
  }

  // 获取对象数据
  const objectData = chat.objectData
  const { nodes, rootNodeId, selectedNodeId, expandedNodes } = objectData

  // 构建Tree组件所需的数据结构
  const buildTreeData = useCallback((nodeId: string) => {
    const node = nodes[nodeId]
    if (!node) return null

    // 如果有搜索查询，过滤节点
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const matches = node.name.toLowerCase().includes(query) ||
                     node.description?.toLowerCase().includes(query)
      
      // 如果当前节点不匹配，检查是否有子节点匹配
      if (!matches && node.children) {
        const hasMatchingChildren = node.children.some(childId => {
          const childNode = nodes[childId]
          return childNode && (
            childNode.name.toLowerCase().includes(query) ||
            childNode.description?.toLowerCase().includes(query)
          )
        })
        if (!hasMatchingChildren) return null
      }
    }

    const nodeData = {
      title: (
        <ObjectTreeNode
          node={node}
          isSelected={selectedNodeId === nodeId}
          isRoot={nodeId === rootNodeId}
          onEdit={() => handleNodeEdit(nodeId)}
          onDelete={() => handleNodeDelete(nodeId)}
          onClearChildren={() => handleClearChildren(nodeId)}
          onSaveEdit={(id, newValue) => handleSaveEdit(id, newValue)}
        />
      ),
      key: nodeId,
      children: node.children?.map(childId => buildTreeData(childId)).filter(Boolean) || []
    }

    return nodeData
  }, [nodes, searchQuery, selectedNodeId, rootNodeId])

  // 转换为Tree组件所需的数据格式
  const treeData = useMemo(() => {
    if (!rootNodeId || !nodes[rootNodeId]) {
      return []
    }

    const rootTreeData = buildTreeData(rootNodeId)
    return rootTreeData ? [rootTreeData] : []
  }, [rootNodeId, nodes, buildTreeData])

  // 处理节点选择
  const handleNodeSelect = useCallback(
    (selectedKeys: React.Key[]) => {
      const nodeId = selectedKeys[0]?.toString()
      if (nodeId) {
        dispatch({
          type: 'SELECT_OBJECT_NODE',
          payload: { chatId: chat.id, nodeId }
        })
      }
    },
    [dispatch, chat.id]
  )

  // 处理节点展开/折叠
  const handleNodeExpand = useCallback(
    (expandedKeys: React.Key[]) => {
      const currentExpandedNodes = expandedNodes
      const newExpandedNodes = expandedKeys.map(key => key.toString())
      
      // 找出新展开的节点
      const newlyExpanded = newExpandedNodes.filter(nodeId => !currentExpandedNodes.includes(nodeId))
      // 找出新折叠的节点
      const newlyCollapsed = currentExpandedNodes.filter(nodeId => !newExpandedNodes.includes(nodeId))
      
      // 批量更新展开状态
      newlyExpanded.forEach(nodeId => {
        dispatch({
          type: 'EXPAND_OBJECT_NODE',
          payload: { chatId: chat.id, nodeId }
        })
      })
      
      newlyCollapsed.forEach(nodeId => {
        dispatch({
          type: 'COLLAPSE_OBJECT_NODE',
          payload: { chatId: chat.id, nodeId }
        })
      })
    },
    [dispatch, chat.id, expandedNodes]
  )

  // 处理节点编辑
  const handleNodeEdit = useCallback(
    (nodeId: string) => {
      // 编辑逻辑由 ObjectTreeNode 内部处理
      console.log('编辑节点:', nodeId)
    },
    []
  )

  // 处理保存编辑
  const handleSaveEdit = useCallback(
    (nodeId: string, newValue: string) => {
      dispatch({
        type: 'UPDATE_OBJECT_NODE',
        payload: { 
          chatId: chat.id, 
          nodeId, 
          updates: { name: newValue } 
        }
      })
    },
    [dispatch, chat.id]
  )

  // 处理节点删除
  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      const node = nodes[nodeId]
      if (!node) return

      const confirmMessage = node.children && node.children.length > 0
        ? `确定删除节点 "${node.name}" 及其所有子节点吗？`
        : `确定删除节点 "${node.name}" 吗？`

      modal.confirm({
        title: '确认删除',
        icon: <ExclamationCircleOutlined />,
        content: confirmMessage,
        okText: '删除',
        cancelText: '取消',
        okType: 'danger',
        onOk: () => {
          dispatch({
            type: 'DELETE_OBJECT_NODE',
            payload: { chatId: chat.id, nodeId }
          })
        }
      })
    },
    [dispatch, chat.id, nodes, modal]
  )

  // 处理清空子节点
  const handleClearChildren = useCallback(
    (nodeId: string) => {
      const node = nodes[nodeId]
      if (!node) return

      modal.confirm({
        title: '确认清空',
        icon: <ExclamationCircleOutlined />,
        content: `确定清空 "${node.name}" 的所有子节点吗？`,
        okText: '清空',
        cancelText: '取消',
        okType: 'danger',
        onOk: () => {
          dispatch({
            type: 'CLEAR_OBJECT_NODE_CHILDREN',
            payload: { chatId: chat.id, nodeId }
          })
        }
      })
    },
    [dispatch, chat.id, nodes, modal]
  )

  // 搜索处理
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)

    // 派发搜索action
    dispatch({
      type: 'SEARCH_OBJECT_NODES',
      payload: { chatId: chat.id, query }
    })
  }, [dispatch, chat.id])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 工具栏 */}
      <ObjectToolbar chatId={chatId} />

      {/* 标题栏 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Title level={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FolderOutlined />
          对象浏览器
        </Title>
      </div>

      {/* 搜索框 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Input
          placeholder="搜索对象节点..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={handleSearch}
          allowClear
        />
      </div>

      {/* 树形结构 */}
      <div style={{ flex: 1, padding: '8px', overflow: 'auto' }}>
        <Tree
          treeData={treeData}
          selectedKeys={selectedNodeId ? [selectedNodeId] : []}
          expandedKeys={expandedNodes}
          onSelect={handleNodeSelect}
          onExpand={handleNodeExpand}
          showLine
          blockNode
          height={undefined}
        />
      </div>
    </div>
  )
}

export default ObjectBrowser
