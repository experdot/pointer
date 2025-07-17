import React, { useState, useCallback, useMemo } from 'react'
import { Input, Typography, Tree, App } from 'antd'
import { SearchOutlined, FolderOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useAppStores } from '../../../stores'
import { ObjectChat, ObjectNode as ObjectNodeType } from '../../../types/type'
import ObjectToolbar from './ObjectToolbar'
import ObjectTreeNode from './ObjectTreeNode'

const { Title } = Typography

interface ObjectBrowserProps {
  chatId: string
}

const ObjectBrowser: React.FC<ObjectBrowserProps> = ({ chatId }) => {
  const stores = useAppStores()
  const { modal } = App.useApp()

  // 从状态中获取对象聊天数据
  const chat = stores.pages.findPageById(chatId) as ObjectChat | undefined

  if (!chat || chat.type !== 'object') {
    return <div>数据加载错误</div>
  }

  // 获取对象数据
  const objectData = chat.objectData
  const { nodes, rootNodeId, selectedNodeId, expandedNodes, searchQuery = '' } = objectData

  // 构建Tree组件所需的数据结构
  const buildTreeData = useCallback(
    (nodeId: string) => {
      const node = nodes[nodeId]
      if (!node) return null

      // 如果有搜索查询，过滤节点
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matches =
          node.name.toLowerCase().includes(query) || node.description?.toLowerCase().includes(query)

        // 如果当前节点不匹配，检查是否有子节点匹配
        if (!matches && node.children) {
          const hasMatchingChildren = node.children.some((childId) => {
            const childNode = nodes[childId]
            return (
              childNode &&
              (childNode.name.toLowerCase().includes(query) ||
                childNode.description?.toLowerCase().includes(query))
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
        children: node.children?.map((childId) => buildTreeData(childId)).filter(Boolean) || []
      }

      return nodeData
    },
    [nodes, searchQuery, selectedNodeId, rootNodeId]
  )

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
        stores.object.selectObjectNode(chat.id, nodeId)
      }
    },
    [stores.object, chat.id]
  )

  // 处理节点展开/折叠
  const handleNodeExpand = useCallback(
    (expandedKeys: React.Key[]) => {
      const currentExpandedNodes = expandedNodes
      const newExpandedNodes = expandedKeys.map((key) => key.toString())

      // 找出新展开的节点
      const newlyExpanded = newExpandedNodes.filter(
        (nodeId) => !currentExpandedNodes.includes(nodeId)
      )
      // 找出新折叠的节点
      const newlyCollapsed = currentExpandedNodes.filter(
        (nodeId) => !newExpandedNodes.includes(nodeId)
      )

      // 批量更新展开状态
      newlyExpanded.forEach((nodeId) => {
        stores.object.expandObjectNode(chat.id, nodeId)
      })

      newlyCollapsed.forEach((nodeId) => {
        stores.object.collapseObjectNode(chat.id, nodeId)
      })
    },
    [stores.object, chat.id, expandedNodes]
  )

  // 处理节点编辑
  const handleNodeEdit = useCallback((nodeId: string) => {
    // 编辑逻辑由 ObjectTreeNode 内部处理
    console.log('编辑节点:', nodeId)
  }, [])

  // 处理保存编辑
  const handleSaveEdit = useCallback(
    (nodeId: string, newValue: string) => {
      stores.object.updateObjectNode(chat.id, nodeId, { name: newValue })
    },
    [stores.object, chat.id]
  )

  // 处理节点删除
  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      const node = nodes[nodeId]
      if (!node) return

      const confirmMessage =
        node.children && node.children.length > 0
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
          stores.object.deleteObjectNode(chat.id, nodeId)
        }
      })
    },
    [stores.object, chat.id, nodes, modal]
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
          stores.object.clearObjectNodeChildren(chat.id, nodeId)
        }
      })
    },
    [stores.object, chat.id, nodes, modal]
  )

  // 获取节点上下文信息
  const getNodeContext = useCallback(
    (currentNode: ObjectNodeType) => {
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

      // 获取当前节点的连接信息
      const getCurrentConnections = (node: ObjectNodeType) => {
        if (!node.connections) return []
        return node.connections.map((conn) => ({
          ...conn,
          connectedNode: nodes[conn.nodeId] || null
        }))
      }

      const ancestorChain = buildAncestorChain(currentNode)
      const siblings = getSiblings(currentNode)
      const currentConnections = getCurrentConnections(currentNode)

      // 构建完整的上下文信息
      let contextInfo = '# 完整上下文信息\n\n'

      // 添加节点基本信息
      contextInfo += `## 当前节点信息\n`
      contextInfo += `- **节点名称**: ${currentNode.name}\n`
      contextInfo += `- **节点类型**: ${currentNode.type || 'unknown'}\n`
      contextInfo += `- **节点描述**: ${currentNode.description || '无'}\n\n`

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

      // 添加连接关系信息（新的超图结构）
      if (currentConnections.length > 0) {
        contextInfo += '\n## 当前节点的连接关系\n'
        currentConnections.forEach((conn) => {
          contextInfo += `\n### 连接节点 - ${conn.connectedNode?.name || '未知节点'}\n`
          contextInfo += `- **连接角色**: ${conn.role}\n`
          contextInfo += `- **连接强度**: ${conn.strength || 'medium'}\n`
          if (conn.description) {
            contextInfo += `- **连接描述**: ${conn.description}\n`
          }
          if (conn.connectedNode) {
            contextInfo += `- **节点存在**: 是\n`
            contextInfo += `- **节点类型**: ${conn.connectedNode.type || 'unknown'}\n`
            contextInfo += `- **节点描述**: ${conn.connectedNode.description || '无'}\n`
          } else {
            contextInfo += `- **节点存在**: 否（可能已被删除）\n`
          }
          contextInfo += '\n'
        })
      } else {
        contextInfo += '\n## 当前节点的连接关系\n当前节点无连接其他节点\n'
      }

      return contextInfo
    },
    [nodes]
  )

  // 处理创建对话
  const handleCreateChat = useCallback(
    (nodeId: string, nodeName: string) => {
      const node = nodes[nodeId]
      if (!node) return

      const nodeContext = getNodeContext(node)

      // 创建基于节点的聊天页面
      try {
        const newChatId = stores.pages.createAndOpenChat(`${nodeName} 对话`, chat.folderId)

        // 添加一条包含节点上下文的系统消息
        const contextMessage = {
          id: `msg-${Date.now()}`,
          content: `基于对象节点 "${nodeName}" 创建的对话\n\n**节点上下文信息：**\n\n${nodeContext}`,
          role: 'system' as const,
          timestamp: Date.now(),
          isStreaming: false,
          metadata: {
            sourceNodeId: nodeId,
            sourcePageId: chatId,
            nodeContext: true
          }
        }

        // 使用 messagesStore 添加初始消息
        stores.messages.addMessage(newChatId, contextMessage)

        console.log('创建聊天成功:', newChatId)
      } catch (error) {
        console.error('创建聊天失败:', error)
      }
    },
    [stores.pages, stores.messages, chat.folderId, chatId, nodes, getNodeContext]
  )

  // 搜索处理
  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value

      // 使用 objectStore 的搜索方法
      stores.object.searchObjectNodes(chat.id, query)
    },
    [stores.object, chat.id]
  )

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
