import { v4 as uuidv4 } from 'uuid'
import { Page, PageFolder, CrosstabChat, CrosstabData, CrosstabStep, RegularChat, ObjectChat, ObjectData, ObjectNode, PageLineage } from '../types'
import { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from './constants'

// Chat helpers
export const createNewChat = (title: string, folderId?: string, lineage?: PageLineage): RegularChat => ({
  id: uuidv4(),
  title,
  type: 'regular',
  messages: [],
  folderId,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  order: Date.now(), // 使用创建时间作为默认排序
  lineage: lineage || {
    source: 'user',
    generatedPageIds: []
  }
})

// 创建交叉视图聊天的helper函数
export const createNewCrosstabChat = (title: string, folderId?: string, lineage?: PageLineage): CrosstabChat => {
  const chatId = uuidv4()
  const timestamp = Date.now()

  // 创建初始步骤
  const initialSteps: CrosstabStep[] = [
    {
      id: uuidv4(),
      stepType: 'metadata',
      stepName: '生成主题提示词',
      description: '根据用户输入主题生成交叉表结构的JSON',
      prompt: '',
      isCompleted: false,
      timestamp
    },
    {
      id: uuidv4(),
      stepType: 'horizontal',
      stepName: '生成横轴提示词',
      description: '为横轴生成代表性的值列表',
      prompt: '',
      isCompleted: false,
      timestamp
    },
    {
      id: uuidv4(),
      stepType: 'vertical',
      stepName: '生成纵轴提示词',
      description: '为纵轴生成代表性的值列表',
      prompt: '',
      isCompleted: false,
      timestamp
    },
    {
      id: uuidv4(),
      stepType: 'values',
      stepName: '生成值提示词',
      description: '遍历横轴项目生成对应的值',
      prompt: '',
      isCompleted: false,
      timestamp
    }
  ]

  const crosstabData: CrosstabData = {
    metadata: null,
    horizontalValues: [],
    verticalValues: [],
    tableData: {},
    currentStep: 0,
    steps: initialSteps
  }

  return {
    id: chatId,
    title,
    type: 'crosstab',
    crosstabData,
    createdAt: timestamp,
    updatedAt: timestamp,
    folderId,
    order: timestamp,
    lineage: lineage || {
      source: 'user',
      generatedPageIds: []
    }
  }
}

// 创建对象聊天的helper函数
export const createNewObjectChat = (title: string, folderId?: string, lineage?: PageLineage): ObjectChat => {
  const chatId = uuidv4()
  const timestamp = Date.now()
  
  // 创建根节点
  const rootNodeId = `node_${timestamp}_${Math.random().toString(36).substr(2, 9)}`
  const rootNode: ObjectNode = {
    id: rootNodeId,
    name: '根对象',
    type: 'object',
    description: '对象的根节点',
    children: [],
    expanded: true,
    metadata: {
      createdAt: timestamp,
      source: 'user'
    },
    properties: {}
  }

  const objectData: ObjectData = {
    rootNodeId: rootNodeId,
    nodes: { [rootNodeId]: rootNode },
    selectedNodeId: undefined,
    expandedNodes: [rootNodeId],
    searchQuery: undefined,
    filteredNodeIds: undefined,
    generationHistory: []
  }

  return {
    id: chatId,
    title,
    type: 'object',
    objectData,
    createdAt: timestamp,
    updatedAt: timestamp,
    folderId,
    order: timestamp,
    lineage: lineage || {
      source: 'user',
      generatedPageIds: []
    }
  }
}

// 对象操作辅助函数

// 生成唯一节点ID
export const generateNodeId = (): string => {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 添加节点到对象数据
export const addNodeToObjectData = (
  objectData: ObjectData, 
  node: ObjectNode, 
  parentId?: string
): ObjectData => {
  const newNodes = { ...objectData.nodes, [node.id]: node }
  
  // 如果指定了父节点，更新父节点的children数组
  if (parentId && newNodes[parentId]) {
    const parentNode = newNodes[parentId]
    newNodes[parentId] = {
      ...parentNode,
      children: [...(parentNode.children || []), node.id]
    }
    
    // 更新子节点的parentId
    newNodes[node.id] = { ...node, parentId }
  }
  
  return {
    ...objectData,
    nodes: newNodes
  }
}

// 删除节点及其所有子节点
export const deleteNodeFromObjectData = (objectData: ObjectData, nodeId: string): ObjectData => {
  const nodesToDelete = getNodeAndAllChildren(objectData.nodes, nodeId)
  const newNodes = { ...objectData.nodes }
  
  // 删除所有相关节点
  nodesToDelete.forEach(id => {
    delete newNodes[id]
  })
  
  // 从父节点的children中移除
  const nodeToDelete = objectData.nodes[nodeId]
  if (nodeToDelete?.parentId && newNodes[nodeToDelete.parentId]) {
    const parentNode = newNodes[nodeToDelete.parentId]
    newNodes[nodeToDelete.parentId] = {
      ...parentNode,
      children: (parentNode.children || []).filter(id => id !== nodeId)
    }
  }
  
  return {
    ...objectData,
    nodes: newNodes,
    selectedNodeId: objectData.selectedNodeId === nodeId ? undefined : objectData.selectedNodeId,
    expandedNodes: objectData.expandedNodes.filter(id => !nodesToDelete.includes(id))
  }
}

// 获取节点及其所有子节点的ID列表
const getNodeAndAllChildren = (nodes: { [id: string]: ObjectNode }, nodeId: string): string[] => {
  const result = [nodeId]
  const node = nodes[nodeId]
  
  if (node?.children) {
    node.children.forEach(childId => {
      result.push(...getNodeAndAllChildren(nodes, childId))
    })
  }
  
  return result
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
      ? objectData.expandedNodes.filter(id => id !== nodeId)
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
    expandedNodes: objectData.expandedNodes.filter(id => id !== nodeId)
  }
}

export const updatePageById = (pages: Page[], chatId: string, updates: Partial<Page>): Page[] =>
  pages.map((page) => (page.id === chatId ? { ...page, ...updates, updatedAt: Date.now() } : page))

// Folder helpers
export const createNewFolder = (name: string, parentId?: string): PageFolder => ({
  id: uuidv4(),
  name,
  expanded: true,
  createdAt: Date.now(),
  order: Date.now(), // 使用创建时间作为默认排序
  parentId
})

export const updateFolderById = (
  folders: PageFolder[],
  folderId: string,
  updates: Partial<PageFolder>
): PageFolder[] =>
  folders.map((folder) => (folder.id === folderId ? { ...folder, ...updates } : folder))

// Generic helpers
export const removeFromArray = <T extends { id: string }>(array: T[], id: string): T[] =>
  array.filter((item) => item.id !== id)

export const constrainSidebarWidth = (width: number): number =>
  Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width))
