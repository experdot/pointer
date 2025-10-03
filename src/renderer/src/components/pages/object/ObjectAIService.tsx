import { ObjectNode as ObjectNodeType } from '../../../types/type'
import { v4 as uuidv4 } from 'uuid'
import { AITaskManager } from './ai/AITaskManager'
import { PromptBuilder, PromptContext } from './ai/PromptBuilder'

export interface AIGenerationContext {
  node: ObjectNodeType
  ancestorChain: ObjectNodeType[]
  siblings: ObjectNodeType[]
  existingChildren: ObjectNodeType[]
  getFullContextInformation?: () => string
  getNodeInformation?: (node: ObjectNodeType) => string
}

export interface AIGenerationResult {
  success: boolean
  data?: any
  error?: string
}

export class ObjectAIService {
  private llmConfig: any
  private aiService: any
  private taskManager: AITaskManager

  constructor(llmConfig: any, aiService: any, dispatch?: any, chatId?: string) {
    this.llmConfig = llmConfig
    this.aiService = aiService
    this.taskManager = new AITaskManager(llmConfig.id, aiService.id, dispatch, chatId)
  }

  private buildPromptContext(
    context: AIGenerationContext,
    userPrompt: string
  ): PromptContext {
    const { node, existingChildren, getFullContextInformation } = context
    return {
      fullContextInfo: getFullContextInformation ? getFullContextInformation() : '',
      nodeName: node.name,
      nodeDescription: node.description || '',
      nodeProperties: node.properties || {},
      existingChildrenInfo: PromptBuilder.buildChildrenInfo(existingChildren),
      userPrompt
    }
  }

  // 生成子节点名称
  async generateChildrenNames(
    context: AIGenerationContext,
    userPrompt: string
  ): Promise<string[]> {
    const { node: parentNode } = context

    return this.taskManager.executeWithTask(
      '生成子节点名称',
      `为节点 "${parentNode.name}" 生成子节点名称`,
      { nodeId: parentNode.id, prompt: userPrompt },
      async () => {
        const promptContext = this.buildPromptContext(context, userPrompt)
        const aiPrompt = PromptBuilder.buildChildrenNamesPrompt(promptContext)
        const response = await this.callAI(aiPrompt)
        const names = PromptBuilder.parseJsonArray<string>(response)
        return names.filter((name) => typeof name === 'string' && name.trim())
      }
    )
  }

  // 生成节点描述
  async generateNodeDescription(
    context: AIGenerationContext,
    userPrompt?: string
  ): Promise<string> {
    const { node } = context

    return this.taskManager.executeWithTask(
      '生成节点描述',
      `为节点 "${node.name}" 生成描述`,
      { nodeId: node.id, prompt: userPrompt || '生成描述' },
      async () => {
        const promptContext = this.buildPromptContext(
          context,
          userPrompt || '请生成一个简洁明了的节点描述'
        )
        const aiPrompt = PromptBuilder.buildNodeDescriptionPrompt(promptContext)
        const response = await this.callAI(aiPrompt)
        return response.trim()
      }
    )
  }

  // 生成对象属性
  async generateObjectProperties(
    context: AIGenerationContext,
    userPrompt?: string
  ): Promise<Record<string, any>> {
    const { node } = context

    return this.taskManager.executeWithTask(
      '生成对象属性',
      `为节点 "${node.name}" 生成属性`,
      { nodeId: node.id, prompt: userPrompt || '生成属性' },
      async () => {
        const promptContext = this.buildPromptContext(
          context,
          userPrompt || '生成适合这个对象的属性'
        )
        const aiPrompt = PromptBuilder.buildObjectPropertiesPrompt(promptContext)
        const response = await this.callAI(aiPrompt)
        return PromptBuilder.parseJsonObject(response)
      }
    )
  }

  // 获取推荐提示词的通用方法
  private async getPromptRecommendations(
    taskType: string,
    context: AIGenerationContext,
    defaultRecommendations: string[]
  ): Promise<string[]> {
    try {
      const promptContext = this.buildPromptContext(context, '')
      const aiPrompt = PromptBuilder.buildPromptRecommendationsRequest(taskType, promptContext)
      const response = await this.callAI(aiPrompt)
      const recommendations = PromptBuilder.parseJsonArray<string>(response)
      return recommendations.filter((rec) => typeof rec === 'string' && rec.trim())
    } catch (error) {
      console.error(`获取${taskType}推荐失败:`, error)
      return defaultRecommendations
    }
  }

  // 获取生成子节点的推荐提示词
  async getChildrenPromptRecommendations(context: AIGenerationContext): Promise<string[]> {
    return this.getPromptRecommendations('children', context, [
      '添加基本功能模块',
      '生成配置相关选项',
      '创建状态管理字段',
      '添加数据处理逻辑',
      '生成用户界面组件'
    ])
  }

  // 获取生成描述的推荐提示词
  async getDescriptionPromptRecommendations(context: AIGenerationContext): Promise<string[]> {
    return this.getPromptRecommendations('description', context, [
      '生成详细的功能说明',
      '描述主要用途和价值',
      '说明技术特点和优势',
      '介绍使用场景和应用',
      '解释核心概念和原理'
    ])
  }

  // 获取生成属性的推荐提示词
  async getPropertiesPromptRecommendations(context: AIGenerationContext): Promise<string[]> {
    return this.getPromptRecommendations('properties', context, [
      '添加基本配置参数',
      '生成状态管理属性',
      '创建元数据信息',
      '添加验证规则属性',
      '生成显示控制选项'
    ])
  }

  // 生成关系节点
  async generateRelationNodes(
    context: AIGenerationContext,
    sourceNodeId: string,
    targetNodeId: string,
    userPrompt?: string,
    allNodes?: { [nodeId: string]: ObjectNodeType }
  ): Promise<{
    relationNodes: ObjectNodeType[]
    nodeUpdates: Array<{ nodeId: string; connection: any }>
  }> {
    if (!allNodes) {
      throw new Error('需要提供所有节点信息来生成关系节点')
    }

    const sourceNode = allNodes[sourceNodeId]
    const targetNode = allNodes[targetNodeId]

    if (!sourceNode || !targetNode) {
      throw new Error('源节点或目标节点不存在')
    }

    return this.taskManager.executeWithTask(
      '生成关系节点',
      `为节点 "${sourceNode.name}" 和 "${targetNode.name}" 生成关系节点`,
      { nodeId: sourceNodeId, prompt: userPrompt || '生成关系节点' },
      async () => {
        const relationData = await this.generateRelationData(
          context,
          sourceNode,
          targetNode,
          userPrompt
        )

        return this.createRelationNodesFromData(
          relationData,
          sourceNodeId,
          targetNodeId,
          sourceNode,
          targetNode,
          userPrompt
        )
      }
    )
  }

  private async generateRelationData(
    context: AIGenerationContext,
    sourceNode: ObjectNodeType,
    targetNode: ObjectNodeType,
    userPrompt?: string
  ): Promise<any[]> {
    const { getFullContextInformation, getNodeInformation } = context

    const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''
    const sourceNodeInfo = getNodeInformation
      ? getNodeInformation(sourceNode)
      : `节点名称: ${sourceNode.name}\n节点描述: ${sourceNode.description || '无'}`
    const targetNodeInfo = getNodeInformation
      ? getNodeInformation(targetNode)
      : `节点名称: ${targetNode.name}\n节点描述: ${targetNode.description || '无'}`

    const aiPrompt = `# 任务
根据两个节点的信息和上下文，生成它们之间的关系节点。关系节点本身也是一个对象，可以描述两个节点之间的连接关系。

# 完整上下文信息
${fullContextInfo}

# 源节点信息
${sourceNodeInfo}

# 目标节点信息
${targetNodeInfo}

# 用户需求
${userPrompt || '请分析这两个节点之间可能存在的关系，并生成关系节点'}

# 输出格式
请严格按照以下JSON格式输出：
\`\`\`json
[
  {
    "name": "关系节点名称",
    "description": "关系节点描述",
    "type": "relation",
    "sourceRole": "源节点在这个关系中的角色",
    "targetRole": "目标节点在这个关系中的角色",
    "properties": {
      "强度": "strong|medium|weak",
      "类型": "依赖|关联|对立|因果|等等"
    }
  }
]
\`\`\`

# 生成要求
1. 分析两个节点的性质、功能和上下文
2. 识别它们之间可能存在的关系类型
3. 关系节点的名称应该清晰描述关系的性质
4. 为源节点和目标节点在这个关系中定义合适的角色
5. 可以生成多个不同类型的关系节点
6. 关系节点的属性应该包含关系的详细信息
7. 如果没有明显的关系，可以返回空数组

请开始生成：`

    const response = await this.callAI(aiPrompt)
    return PromptBuilder.parseJsonArray(response)
  }

  private createRelationNodesFromData(
    relationData: any[],
    sourceNodeId: string,
    targetNodeId: string,
    sourceNode: ObjectNodeType,
    targetNode: ObjectNodeType,
    userPrompt?: string
  ): {
    relationNodes: ObjectNodeType[]
    nodeUpdates: Array<{ nodeId: string; connection: any }>
  } {
    const relationNodes: ObjectNodeType[] = []
    const nodeUpdates: Array<{ nodeId: string; connection: any }> = []

    for (const relData of relationData) {
      if (relData.name && relData.sourceRole && relData.targetRole) {
        const relationNodeId = uuidv4()
        const timestamp = Date.now()

        const relationNode: ObjectNodeType = {
          id: relationNodeId,
          name: relData.name,
          description: relData.description || '',
          type: relData.type || 'relation',
          connections: [
            {
              nodeId: sourceNodeId,
              role: relData.sourceRole,
              description: `${sourceNode.name}在此关系中的角色`,
              strength: 'medium',
              metadata: {
                createdAt: timestamp,
                source: 'ai',
                aiPrompt: userPrompt || '生成关系节点'
              }
            },
            {
              nodeId: targetNodeId,
              role: relData.targetRole,
              description: `${targetNode.name}在此关系中的角色`,
              strength: 'medium',
              metadata: {
                createdAt: timestamp,
                source: 'ai',
                aiPrompt: userPrompt || '生成关系节点'
              }
            }
          ],
          properties: relData.properties || {},
          children: [],
          expanded: false,
          metadata: {
            createdAt: timestamp,
            source: 'ai',
            aiPrompt: userPrompt || '生成关系节点'
          }
        }

        relationNodes.push(relationNode)

        // 为源节点和目标节点添加连接
        nodeUpdates.push(
          {
            nodeId: sourceNodeId,
            connection: {
              nodeId: relationNodeId,
              role: '关系参与者',
              description: `通过关系"${relData.name}"连接`,
              strength: 'medium',
              metadata: { createdAt: timestamp, source: 'ai', aiPrompt: userPrompt || '生成关系节点' }
            }
          },
          {
            nodeId: targetNodeId,
            connection: {
              nodeId: relationNodeId,
              role: '关系参与者',
              description: `通过关系"${relData.name}"连接`,
              strength: 'medium',
              metadata: { createdAt: timestamp, source: 'ai', aiPrompt: userPrompt || '生成关系节点' }
            }
          }
        )
      }
    }

    return { relationNodes, nodeUpdates }
  }

  // 获取生成关系节点的推荐提示词
  async getRelationsPromptRecommendations(
    context: AIGenerationContext,
    sourceNodeId?: string,
    targetNodeId?: string,
    allNodes?: { [nodeId: string]: ObjectNodeType }
  ): Promise<string[]> {
    return this.getPromptRecommendations('relations', context, [
      '查找两个节点的依赖关系',
      '识别功能性关联',
      '发现对立或冲突关系',
      '分析因果关系',
      '探索协作关系'
    ])
  }

  // 辅助方法：获取节点路径
  private getNodePath(
    node: ObjectNodeType,
    allNodes: { [nodeId: string]: ObjectNodeType }
  ): string {
    const path: string[] = []
    let current = node

    while (current && current.parentId) {
      const parent = allNodes[current.parentId]
      if (parent) {
        path.unshift(parent.name)
        current = parent
      } else {
        break
      }
    }

    return path.length > 0 ? path.join(' / ') : '根节点'
  }

  // 通用AI调用方法
  private async callAI(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.aiService.sendMessage(
        [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
        {
          onChunk: () => {},
          onComplete: (response: string) => resolve(response),
          onError: (error: any) => reject(error)
        }
      )
    })
  }
}

// 工厂函数
export function createObjectAIService(
  llmConfig: any,
  aiService: any,
  dispatch?: any,
  chatId?: string
): ObjectAIService {
  return new ObjectAIService(llmConfig, aiService, dispatch, chatId)
}
