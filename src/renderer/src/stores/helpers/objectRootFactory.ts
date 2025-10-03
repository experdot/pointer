import { v4 as uuidv4 } from 'uuid'
import { ObjectNode } from '../../types/type'
import {
  createRelationNode,
  createInheritanceInstanceNode,
  RELATION_CONFIGS
} from './relationNodeFactory'

// 创建包含元关系的根节点结构
export const createObjectRootWithMetaRelations = (): {
  rootNodeId: string
  nodes: { [nodeId: string]: ObjectNode }
  expandedNodes: string[]
} => {
  const rootId = uuidv4()
  const timestamp = Date.now()
  const nodes: { [nodeId: string]: ObjectNode } = {}

  // 创建元关系容器节点
  const metaRelationsId = uuidv4()
  const generalRelationId = uuidv4()
  const inheritanceInstancesId = uuidv4()

  // 创建根节点
  nodes[rootId] = {
    id: rootId,
    name: '根对象',
    type: 'entity',
    description: '对象的根节点',
    children: [metaRelationsId],
    expanded: true,
    metadata: { createdAt: timestamp, source: 'user' },
    properties: {}
  }

  // 使用工厂函数创建所有关系节点
  const relationNodes = RELATION_CONFIGS.map((config) =>
    createRelationNode(config, generalRelationId, timestamp)
  )

  const relationIds = relationNodes.map((r) => r.id)
  const relationNameMap = new Map(
    relationNodes.map((r, index) => [r.id, RELATION_CONFIGS[index].name])
  )

  // 创建一般关联节点（所有关系的基类）
  nodes[generalRelationId] = {
    id: generalRelationId,
    name: '一般关联 (is-related-to)',
    type: 'relation',
    description: '所有关系的基类，表示两个事物之间存在某种联系',
    parentId: metaRelationsId,
    children: relationIds,
    expanded: true,
    connections: relationIds.map((id, index) => ({
      nodeId: id,
      role: 'superclass-of',
      description: `一般关联是${RELATION_CONFIGS[index].name}的超类`
    })),
    metadata: { createdAt: timestamp, source: 'user' },
    properties: { category: '基础关系', isAbstract: true }
  }

  // 添加所有关系节点
  relationNodes.forEach(({ id, node }) => {
    nodes[id] = node
  })

  // 创建继承关系实例节点
  const isARelationId = relationIds[0] // 继承关系是第一个
  const inheritanceInstances = relationNodes.map(({ id }, index) =>
    createInheritanceInstanceNode(
      id,
      RELATION_CONFIGS[index].name,
      generalRelationId,
      isARelationId,
      inheritanceInstancesId,
      timestamp
    )
  )

  const inheritanceInstanceIds = inheritanceInstances.map((i) => i.id)

  // 添加继承关系实例容器节点
  nodes[inheritanceInstancesId] = {
    id: inheritanceInstancesId,
    name: '继承关系实例',
    type: 'container',
    description: '具体的继承关系实例，表示每个关系与一般关联之间的继承关系',
    parentId: metaRelationsId,
    children: inheritanceInstanceIds,
    expanded: true,
    metadata: { createdAt: timestamp, source: 'user' },
    properties: {}
  }

  // 添加所有继承实例节点
  inheritanceInstances.forEach(({ id, node }) => {
    nodes[id] = node
  })

  // 创建元关系容器节点
  nodes[metaRelationsId] = {
    id: metaRelationsId,
    name: '元关系',
    type: 'container',
    description: '预定义的基础关系类型，用于构建知识图谱',
    parentId: rootId,
    children: [generalRelationId, inheritanceInstancesId],
    expanded: true,
    metadata: { createdAt: timestamp, source: 'user' },
    properties: {}
  }

  return {
    rootNodeId: rootId,
    nodes,
    expandedNodes: [rootId, metaRelationsId, generalRelationId, inheritanceInstancesId]
  }
}
