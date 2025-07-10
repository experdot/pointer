import React, { useState, useCallback, useMemo } from 'react'
import { Input, Typography, Space, Tree, Dropdown, Tag, Button } from 'antd'
import { SearchOutlined, FolderOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useAppContext } from '../../../store/AppContext'
import { ObjectChat, ObjectNode as ObjectNodeType } from '../../../types'
import ObjectToolbar from './ObjectToolbar'

const { Title } = Typography

interface ObjectBrowserProps {
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

// 获取节点类型的颜色
const getNodeTypeColor = (type: ObjectNodeType['type']) => {
  switch (type) {
    case 'object':
      return 'blue'
    case 'array':
      return 'green'
    case 'string':
      return 'orange'
    case 'number':
      return 'purple'
    case 'boolean':
      return 'red'
    case 'function':
      return 'cyan'
    case 'custom':
      return 'magenta'
    default:
      return 'default'
  }
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

  // 构建Tree组件所需的数据结构
  const buildTreeData = useCallback((nodeId: string) => {
    const node = nodes[nodeId]
    if (!node) return null

    // 如果有搜索查询，过滤节点
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const matches = node.name.toLowerCase().includes(query) ||
                     node.description?.toLowerCase().includes(query) ||
                     node.type.toLowerCase().includes(query)
      
      // 如果当前节点不匹配，检查是否有子节点匹配
      if (!matches && node.children) {
        const hasMatchingChildren = node.children.some(childId => {
          const childNode = nodes[childId]
          return childNode && (
            childNode.name.toLowerCase().includes(query) ||
            childNode.description?.toLowerCase().includes(query) ||
            childNode.type.toLowerCase().includes(query)
          )
        })
        if (!hasMatchingChildren) return null
      }
    }

    const nodeData = {
      title: (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 6,
          minWidth: 0, // 允许内容收缩
          overflow: 'hidden' // 隐藏溢出内容
        }}>
          <span style={{ fontSize: '14px', flexShrink: 0 }}>{getNodeIcon(node.type)}</span>
          <span style={{ 
            fontWeight: selectedNodeId === nodeId ? 'bold' : 'normal',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            flexShrink: 1
          }}>
            {node.name}
          </span>
          <Tag color={getNodeTypeColor(node.type)} size="small" style={{ flexShrink: 0 }}>
            {node.type}
          </Tag>
          {node.description && (
            <span style={{ 
              color: '#666', 
              fontSize: '12px', 
              fontStyle: 'italic',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
              flexShrink: 1,
              maxWidth: '120px' // 限制描述文本的最大宽度
            }}>
              {node.description}
            </span>
          )}
        </div>
      ),
      key: nodeId,
      children: node.children?.map(childId => buildTreeData(childId)).filter(Boolean) || []
    }

    return nodeData
  }, [nodes, searchQuery, selectedNodeId])

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

  // 递归获取所有子节点ID
  const getAllChildrenIds = useCallback(
    (nodeId: string): string[] => {
      const node = nodes[nodeId]
      if (!node || !node.children || node.children.length === 0) {
        return []
      }

      let allChildrenIds: string[] = []
      node.children.forEach(childId => {
        allChildrenIds.push(childId)
        // 递归获取子节点的子节点
        allChildrenIds = allChildrenIds.concat(getAllChildrenIds(childId))
      })

      return allChildrenIds
    },
    [nodes]
  )

  // 处理删除节点
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const node = nodes[nodeId]
      if (!node) return

      const childrenIds = getAllChildrenIds(nodeId)
      const childrenCount = childrenIds.length
      
      const confirmMessage = childrenCount > 0 
        ? `确定要删除节点"${node.name}"吗？这将同时删除 ${childrenCount} 个子节点。`
        : `确定要删除节点"${node.name}"吗？`

      if (window.confirm(confirmMessage)) {
        dispatch({
          type: 'DELETE_OBJECT_NODE',
          payload: { chatId: chat.id, nodeId }
        })
      }
    },
    [dispatch, chat.id, nodes, getAllChildrenIds]
  )

  // 处理清空子节点
  const handleClearChildren = useCallback(
    (nodeId: string) => {
      const node = nodes[nodeId]
      if (!node || !node.children || node.children.length === 0) return

      const childrenIds = getAllChildrenIds(nodeId)
      const childrenCount = childrenIds.length

      const confirmMessage = `确定要清空节点"${node.name}"的所有子节点吗？这将删除 ${childrenCount} 个子节点。`

      if (window.confirm(confirmMessage)) {
        dispatch({
          type: 'CLEAR_OBJECT_NODE_CHILDREN',
          payload: { chatId: chat.id, nodeId }
        })
      }
    },
    [dispatch, chat.id, nodes, getAllChildrenIds]
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

  // 右键菜单
  const getContextMenu = useCallback(
    (nodeId: string) => {
      const node = nodes[nodeId]
      if (!node) return { items: [] }

      const hasChildren = node.children && node.children.length > 0
      const menuItems = [
        {
          key: 'edit',
          label: '编辑节点',
          icon: <EditOutlined />,
          onClick: () => {
            // 这里可以添加编辑功能
            console.log('编辑节点:', nodeId)
          }
        }
      ]

      // 如果节点有子节点，添加清空子节点选项
      if (hasChildren) {
        menuItems.push({
          key: 'clear-children',
          label: '清空子节点',
          icon: <DeleteOutlined style={{ color: '#ff7875' }} />,
          onClick: () => handleClearChildren(nodeId),
          style: { color: '#ff7875' }
        })
      }

      // 分割线
      if (hasChildren) {
        menuItems.push({
          key: 'divider',
          type: 'divider' as const
        })
      }

      // 删除节点选项
      menuItems.push({
        key: 'delete',
        label: '删除节点',
        icon: <DeleteOutlined />,
        onClick: () => handleDeleteNode(nodeId),
        disabled: nodeId === rootNodeId, // 根节点不能删除
        danger: true
      })

      return { items: menuItems }
    },
    [nodes, rootNodeId, handleDeleteNode, handleClearChildren]
  )

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
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {treeData.length > 0 ? (
          <Tree
            treeData={treeData}
            selectedKeys={selectedNodeId ? [selectedNodeId] : []}
            expandedKeys={expandedNodes}
            onSelect={handleNodeSelect}
            onExpand={handleNodeExpand}
            showLine={{ showLeafIcon: false }}
            blockNode
            style={{ fontSize: '14px' }}
            titleRender={(nodeData: any) => (
              <Dropdown
                menu={getContextMenu(nodeData.key)}
                trigger={['contextMenu']}
                placement="bottomLeft"
              >
                <div style={{ 
                  padding: '4px 0',
                  width: '100%',
                  minWidth: 0,
                  overflow: 'hidden'
                }}>
                  {nodeData.title}
                </div>
              </Dropdown>
            )}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            {searchQuery ? '没有找到匹配的节点' : '没有对象数据'}
          </div>
        )}
      </div>
    </div>
  )
}

export default ObjectBrowser
