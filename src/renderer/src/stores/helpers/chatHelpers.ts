import { v4 as uuidv4 } from 'uuid'
import { RegularChat, CrosstabChat, ObjectChat, CrosstabData, CrosstabStep, ObjectData, PageLineage } from '../../types/type'
import { createObjectRootWithMetaRelations } from './objectRootFactory'

// 创建新的普通聊天
export const createNewChat = (
  title: string,
  folderId?: string,
  lineage?: PageLineage
): RegularChat => {
  const chatId = uuidv4()
  const timestamp = Date.now()

  return {
    id: chatId,
    title,
    type: 'regular',
    messages: [],
    messageMap: {},
    currentPath: [],
    rootMessageId: undefined,
    folderId,
    createdAt: timestamp,
    updatedAt: timestamp,
    order: timestamp,
    lineage
  }
}

// 创建交叉视图聊天
export const createNewCrosstabChat = (
  title: string,
  folderId?: string,
  lineage?: PageLineage
): CrosstabChat => {
  const chatId = uuidv4()
  const timestamp = Date.now()

  const initialSteps: CrosstabStep[] = [
    {
      id: uuidv4(),
      stepType: 'metadata',
      stepName: '生成主题元数据',
      description: '根据用户输入主题生成多维度交叉表结构的JSON',
      prompt: '',
      isCompleted: false,
      timestamp
    }
  ]

  const crosstabData: CrosstabData = {
    metadata: null,
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

// 创建对象聊天
export const createNewObjectChat = (
  title: string,
  folderId?: string,
  lineage?: PageLineage
): ObjectChat => {
  const chatId = uuidv4()
  const timestamp = Date.now()

  const { rootNodeId, nodes, expandedNodes } = createObjectRootWithMetaRelations()

  const objectData: ObjectData = {
    rootNodeId,
    nodes,
    selectedNodeId: undefined,
    expandedNodes,
    searchQuery: undefined,
    filteredNodeIds: undefined,
    generationHistory: []
  }

  return {
    id: chatId,
    title,
    type: 'object',
    objectData,
    folderId,
    createdAt: timestamp,
    updatedAt: timestamp,
    order: timestamp,
    lineage
  }
}
