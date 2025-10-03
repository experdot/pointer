import { v4 as uuidv4 } from 'uuid'
import { ObjectData, ObjectNode } from '../../types/type'

// 生成唯一节点ID
export const generateNodeId = (): string => {
  return uuidv4()
}

// 添加节点到对象数据
export const addNodeToObjectData = (
  objectData: ObjectData,
  node: ObjectNode,
  parentId?: string
): ObjectData => {
  const newNodes = { ...objectData.nodes, [node.id]: node }

  if (parentId && newNodes[parentId]) {
    const parentNode = newNodes[parentId]
    newNodes[parentId] = {
      ...parentNode,
      children: [...(parentNode.children || []), node.id]
    }
    newNodes[node.id] = { ...node, parentId }
  }

  return {
    ...objectData,
    nodes: newNodes
  }
}

// 获取节点及其所有子节点的ID列表
const getNodeAndAllChildren = (nodes: { [id: string]: ObjectNode }, nodeId: string): string[] => {
  const result = [nodeId]
  const node = nodes[nodeId]

  if (node?.children) {
    node.children.forEach((childId) => {
      result.push(...getNodeAndAllChildren(nodes, childId))
    })
  }

  return result
}

// 删除节点及其所有子节点
export const deleteNodeFromObjectData = (objectData: ObjectData, nodeId: string): ObjectData => {
  const nodesToDelete = getNodeAndAllChildren(objectData.nodes, nodeId)
  const newNodes = { ...objectData.nodes }

  nodesToDelete.forEach((id) => {
    delete newNodes[id]
  })

  const nodeToDelete = objectData.nodes[nodeId]
  if (nodeToDelete?.parentId && newNodes[nodeToDelete.parentId]) {
    const parentNode = newNodes[nodeToDelete.parentId]
    newNodes[nodeToDelete.parentId] = {
      ...parentNode,
      children: (parentNode.children || []).filter((id) => id !== nodeId)
    }
  }

  return {
    ...objectData,
    nodes: newNodes,
    selectedNodeId: objectData.selectedNodeId === nodeId ? undefined : objectData.selectedNodeId,
    expandedNodes: objectData.expandedNodes.filter((id) => !nodesToDelete.includes(id))
  }
}

// 清空节点的所有子节点
export const clearNodeChildren = (objectData: ObjectData, nodeId: string): ObjectData => {
  const parentNode = objectData.nodes[nodeId]
  if (!parentNode || !parentNode.children || parentNode.children.length === 0) {
    return objectData
  }

  const nodesToDelete: string[] = []
  parentNode.children.forEach((childId) => {
    nodesToDelete.push(...getNodeAndAllChildren(objectData.nodes, childId))
  })

  const newNodes = { ...objectData.nodes }
  nodesToDelete.forEach((id) => {
    delete newNodes[id]
  })

  newNodes[nodeId] = {
    ...parentNode,
    children: []
  }

  return {
    ...objectData,
    nodes: newNodes,
    selectedNodeId: nodesToDelete.includes(objectData.selectedNodeId || '')
      ? undefined
      : objectData.selectedNodeId,
    expandedNodes: objectData.expandedNodes.filter((id) => !nodesToDelete.includes(id))
  }
}

// 更新节点
export const updateNodeInObjectData = (
  objectData: ObjectData,
  nodeId: string,
  updates: Partial<ObjectNode>
): ObjectData => {
  const existingNode = objectData.nodes[nodeId]
  if (!existingNode) return objectData

  const updatedNode = {
    ...existingNode,
    ...updates,
    metadata: {
      ...existingNode.metadata,
      ...updates.metadata,
      updatedAt: Date.now()
    }
  }

  return {
    ...objectData,
    nodes: {
      ...objectData.nodes,
      [nodeId]: updatedNode
    }
  }
}

// 切换节点展开状态
export const toggleNodeExpansion = (objectData: ObjectData, nodeId: string): ObjectData => {
  const isExpanded = objectData.expandedNodes.includes(nodeId)

  return {
    ...objectData,
    expandedNodes: isExpanded
      ? objectData.expandedNodes.filter((id) => id !== nodeId)
      : [...objectData.expandedNodes, nodeId]
  }
}

// 展开节点
export const expandNode = (objectData: ObjectData, nodeId: string): ObjectData => {
  if (objectData.expandedNodes.includes(nodeId)) return objectData

  return {
    ...objectData,
    expandedNodes: [...objectData.expandedNodes, nodeId]
  }
}

// 折叠节点
export const collapseNode = (objectData: ObjectData, nodeId: string): ObjectData => {
  return {
    ...objectData,
    expandedNodes: objectData.expandedNodes.filter((id) => id !== nodeId)
  }
}
