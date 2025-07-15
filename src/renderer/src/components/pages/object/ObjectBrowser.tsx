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
          onCreateChat={(id, name) => handleCreateChat(id, name)}
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

  // 获取节点上下文信息
  const getNodeContext = useCallback((currentNode: ObjectNodeType) => {
    if (!currentNode) return ''

    // 获取节点完整信息
    const getNodeInformation = (node: ObjectNodeType): string => {
      let information = `# 节点 - [${node.name}]\n${node.description || ''}`

      // 添加属性信息
      if (node.properties && Object.keys(node.properties).length > 0) {
        const properties = Object.entries(node.properties).map(([key, value]) => ({
          Name: key,
          Value: value
        }))
        information += `\n## 属性列表\n${JSON.stringify(properties)}`
      }

      // 添加子节点信息
      if (node.children && node.children.length > 0) {
        const children = node.children
          .map((childId) => {
            const childNode = nodes[childId]
            return childNode
              ? childNode.description
                ? {
                    Name: childNode.name,
                    Description: childNode.description
                  }
                : {
                    Name: childNode.name
                  }
              : null
          })
          .filter(Boolean)

        if (children.length > 0) {
          information += `\n## 子节点列表\n${JSON.stringify(children)}`
        }
      }

      // 添加引用信息
      if (node.references && node.references.length > 0) {
        const references = node.references.map((ref) => {
          const refNode = nodes[ref.id]
          return {
            Name: ref.name,
            Description: ref.description || '',
            Type: ref.type,
            Strength: ref.strength,
            NodeExists: !!refNode,
            NodeDescription: refNode?.description || ''
          }
        })
        information += `\n## 引用关系\n${JSON.stringify(references)}`
      }

      return information
    }

    // 从当前节点向上追踪到根节点，构建完整链路
    const buildAncestorChain = (node: ObjectNodeType): ObjectNodeType[] => {
      const chain: ObjectNodeType[] = []
      let current = node

      // 向上追踪到根节点
      while (current) {
        chain.unshift(current)
        if (current.parentId && nodes[current.parentId]) {
          current = nodes[current.parentId]
        } else {
          break
        }
      }

      return chain
    }

    // 获取同级节点
    const getSiblings = (node: ObjectNodeType): ObjectNodeType[] => {
      if (!node.parentId) return []
      const parent = nodes[node.parentId]
      if (!parent || !parent.children) return []
      return parent.children
        .filter((id) => id !== node.id)
        .map((id) => nodes[id])
        .filter(Boolean)
    }

    // 获取当前节点的引用信息
    const getCurrentReferences = (node: ObjectNodeType) => {
      if (!node.references) return []
      return node.references.map((ref) => ({
        ...ref,
        referencedNode: nodes[ref.id] || null
      }))
    }

    // 获取引用当前节点的其他节点（反向引用）
    const getIncomingReferences = (node: ObjectNodeType) => {
      const incomingRefs: Array<{
        fromNode: ObjectNodeType
        reference: any
      }> = []
      
      Object.values(nodes).forEach((otherNode) => {
        if (otherNode.id !== node.id && otherNode.references) {
          otherNode.references.forEach((ref) => {
            if (ref.id === node.id) {
              incomingRefs.push({
                fromNode: otherNode,
                reference: ref
              })
            }
          })
        }
      })
      
      return incomingRefs
    }

    const ancestorChain = buildAncestorChain(currentNode)
    const siblings = getSiblings(currentNode)
    const currentReferences = getCurrentReferences(currentNode)
    const incomingReferences = getIncomingReferences(currentNode)

    // 构建完整的上下文信息
    let contextInfo = '# 完整上下文信息\n\n'

    // 添加层级结构信息
    contextInfo += '## 节点层级结构\n'
    contextInfo += '从根节点到当前节点的完整路径：\n'
    ancestorChain.forEach((ancestor, index) => {
      const indent = '  '.repeat(index)
      contextInfo += `${indent}- ${ancestor.name}`
      if (ancestor.description) {
        contextInfo += ` (${ancestor.description})`
      }
      contextInfo += '\n'
    })

    // 添加每个层级节点的详细信息
    contextInfo += '\n## 路径节点详细信息\n'
    ancestorChain.forEach((ancestor, index) => {
      contextInfo += `\n### 第${index + 1}层节点\n`
      contextInfo += getNodeInformation(ancestor)
      contextInfo += '\n'
    })

    // 添加同级节点信息
    if (siblings.length > 0) {
      contextInfo += '\n## 同级节点信息\n'
      siblings.forEach((sibling) => {
        contextInfo += `\n### 同级节点 - ${sibling.name}\n`
        contextInfo += getNodeInformation(sibling)
        contextInfo += '\n'
      })
    } else {
      contextInfo += '\n## 同级节点信息\n无同级节点\n'
    }

    // 添加引用关系信息
    if (currentReferences.length > 0) {
      contextInfo += '\n## 当前节点的引用关系\n'
      currentReferences.forEach((ref) => {
        contextInfo += `\n### 引用节点 - ${ref.name}\n`
        contextInfo += `- **引用类型**: ${ref.type}\n`
        contextInfo += `- **引用强度**: ${ref.strength}\n`
        if (ref.description) {
          contextInfo += `- **引用描述**: ${ref.description}\n`
        }
        if (ref.referencedNode) {
          contextInfo += `- **节点存在**: 是\n`
          contextInfo += `- **节点描述**: ${ref.referencedNode.description || '无'}\n`
        } else {
          contextInfo += `- **节点存在**: 否（可能已被删除）\n`
        }
        contextInfo += '\n'
      })
    } else {
      contextInfo += '\n## 当前节点的引用关系\n当前节点无引用其他节点\n'
    }

    // 添加反向引用信息
    if (incomingReferences.length > 0) {
      contextInfo += '\n## 被其他节点引用的情况\n'
      incomingReferences.forEach((incomingRef) => {
        contextInfo += `\n### 来自节点 - ${incomingRef.fromNode.name}\n`
        contextInfo += `- **引用类型**: ${incomingRef.reference.type}\n`
        contextInfo += `- **引用强度**: ${incomingRef.reference.strength}\n`
        if (incomingRef.reference.description) {
          contextInfo += `- **引用描述**: ${incomingRef.reference.description}\n`
        }
        contextInfo += `- **来源节点描述**: ${incomingRef.fromNode.description || '无'}\n`
        contextInfo += '\n'
      })
    } else {
      contextInfo += '\n## 被其他节点引用的情况\n当前节点未被其他节点引用\n'
    }

    return contextInfo
  }, [nodes])

  // 处理创建对话
  const handleCreateChat = useCallback(
    (nodeId: string, nodeName: string) => {
      const node = nodes[nodeId]
      if (!node) return

      const nodeContext = getNodeContext(node)

      dispatch({
        type: 'CREATE_CHAT_FROM_OBJECT_NODE',
        payload: {
          folderId: chat.folderId,
          nodeId,
          nodeName,
          nodeContext,
          sourcePageId: chatId
        }
      })
    },
    [dispatch, chat.folderId, chatId, nodes, getNodeContext]
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
