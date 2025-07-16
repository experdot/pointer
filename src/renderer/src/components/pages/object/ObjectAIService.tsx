import { ObjectNode as ObjectNodeType, AITask, ObjectNodeReference } from '../../../types'
import { v4 as uuidv4 } from 'uuid'

export interface AIGenerationContext {
  node: ObjectNodeType
  ancestorChain: ObjectNodeType[]
  siblings: ObjectNodeType[]
  existingChildren: ObjectNodeType[]
  getFullContextInformation?: () => string // 获取完整上下文信息
  getNodeInformation?: (node: ObjectNodeType) => string // 获取单个节点的完整信息
}

export interface AIGenerationResult {
  success: boolean
  data?: any
  error?: string
}

export class ObjectAIService {
  private llmConfig: any
  private aiService: any
  private dispatch: any
  private chatId?: string

  constructor(llmConfig: any, aiService: any, dispatch?: any, chatId?: string) {
    this.llmConfig = llmConfig
    this.aiService = aiService
    this.dispatch = dispatch
    this.chatId = chatId
  }

  // 生成子节点名称
  async generateChildrenNames(context: AIGenerationContext, userPrompt: string): Promise<string[]> {
    const { node: parentNode, existingChildren, getFullContextInformation } = context

    const taskId = uuidv4()

    // 创建AI任务监控
    if (this.dispatch && this.chatId) {
      const task: AITask = {
        id: taskId,
        requestId: this.aiService.id, // 使用AI服务的requestId
        type: 'object_generation',
        status: 'running',
        title: '生成子节点名称',
        description: `为节点 "${parentNode.name}" 生成子节点名称`,
        chatId: this.chatId,
        modelId: this.llmConfig.id,
        startTime: Date.now(),
        context: {
          object: {
            nodeId: parentNode.id,
            prompt: userPrompt
          }
        }
      }

      this.dispatch({
        type: 'ADD_AI_TASK',
        payload: { task }
      })
    }

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 构建已有子节点信息
      const existingChildrenInfo =
        existingChildren.length > 0
          ? existingChildren
              .map(
                (child) => `  - ${child.name}${child.description ? ` (${child.description})` : ''}`
              )
              .join('\n')
          : '  暂无子节点'

      const aiPrompt = `# 任务
根据用户的描述，为指定的对象节点生成子节点名称。你只需要生成一个JSON字符串数组，包含多个子节点的名称。

# 完整上下文信息
${fullContextInfo}

# 当前节点详细信息
- 节点名称: ${parentNode.name}
- 节点描述: ${parentNode.description || '无'}
- 现有属性: ${Object.keys(parentNode.properties || {}).length > 0 ? JSON.stringify(parentNode.properties, null, 2) : '无'}

# 已有子节点
${existingChildrenInfo}

# 用户需求
${userPrompt}

# 输出格式
请严格按照以下JSON格式输出，只包含名称数组：
\`\`\`json
["子节点名称1", "子节点名称2", "子节点名称3", "..."]
\`\`\`

# 生成要求
1. 只生成子节点的名称，不包含其他信息
2. 避免与已有子节点重复
3. 参考同级节点的命名风格和上下文层级结构
4. 生成的名称应该语义清晰、简洁
5. 考虑父节点的类型、用途以及整个对象树的结构
6. 结合完整的上下文信息，确保生成的子节点符合整体架构
7. 若无特别说明，请生成尽可能多的子节点名称

请开始生成：`

      const response = await this.callAI(aiPrompt)

      // 解析响应
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonContent = jsonMatch ? jsonMatch[1] : response

      const names = JSON.parse(jsonContent)
      if (!Array.isArray(names)) {
        throw new Error('期望数组格式')
      }

      // 更新任务状态为完成
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'completed',
              endTime: Date.now()
            }
          }
        })
      }

      return names.filter((name) => typeof name === 'string' && name.trim())
    } catch (error) {
      // 更新任务状态为失败
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'failed',
              endTime: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      }
      throw new Error('AI响应格式错误')
    }
  }

  // 生成节点描述
  async generateNodeDescription(
    context: AIGenerationContext,
    userPrompt?: string
  ): Promise<string> {
    const { node, existingChildren, getFullContextInformation } = context

    const taskId = uuidv4()

    // 创建AI任务监控
    if (this.dispatch && this.chatId) {
      const task: AITask = {
        id: taskId,
        requestId: this.aiService.id, // 使用AI服务的requestId
        type: 'object_generation',
        status: 'running',
        title: '生成节点描述',
        description: `为节点 "${node.name}" 生成描述`,
        chatId: this.chatId,
        modelId: this.llmConfig.id,
        startTime: Date.now(),
        context: {
          object: {
            nodeId: node.id,
            prompt: userPrompt || '生成描述'
          }
        }
      }

      this.dispatch({
        type: 'ADD_AI_TASK',
        payload: { task }
      })
    }

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 构建已有子节点信息
      const existingChildrenInfo =
        existingChildren.length > 0
          ? existingChildren
              .map(
                (child) => `  - ${child.name}${child.description ? ` (${child.description})` : ''}`
              )
              .join('\n')
          : '  暂无子节点'

      const aiPrompt = `# 任务
为指定的对象节点生成一个准确、简洁的描述。

# 完整上下文信息
${fullContextInfo}

# 当前节点详细信息
- 节点名称: ${node.name}
- 节点描述: ${node.description || '无'}
- 现有属性: ${Object.keys(node.properties || {}).length > 0 ? JSON.stringify(node.properties, null, 2) : '无'}

# 已有子节点
${existingChildrenInfo}

# 用户需求
${userPrompt || '请生成一个简洁明了的节点描述'}

# 输出要求
请直接输出节点描述，不要包含任何格式化标记或额外说明。描述应该：
1. 简洁明了，50-200字左右
2. 准确反映节点的用途和功能
3. 使用自然语言，避免过于技术性的表述
4. 符合整个对象系统的语境
5. 结合节点的属性、子节点等信息，提供全面的描述
6. 结合完整的上下文信息，确保描述符合整体架构

请开始生成：`

      const response = await this.callAI(aiPrompt)

      // 更新任务状态为完成
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'completed',
              endTime: Date.now()
            }
          }
        })
      }

      return response.trim()
    } catch (error) {
      // 更新任务状态为失败
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'failed',
              endTime: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      }
      throw error
    }
  }

  // 生成对象属性
  async generateObjectProperties(
    context: AIGenerationContext,
    userPrompt?: string
  ): Promise<Record<string, any>> {
    const { node, existingChildren, getFullContextInformation } = context

    const taskId = uuidv4()

    // 创建AI任务监控
    if (this.dispatch && this.chatId) {
      const task: AITask = {
        id: taskId,
        requestId: this.aiService.id, // 使用AI服务的requestId
        type: 'object_generation',
        status: 'running',
        title: '生成对象属性',
        description: `为节点 "${node.name}" 生成属性`,
        chatId: this.chatId,
        modelId: this.llmConfig.id,
        startTime: Date.now(),
        context: {
          object: {
            nodeId: node.id,
            prompt: userPrompt || '生成属性'
          }
        }
      }

      this.dispatch({
        type: 'ADD_AI_TASK',
        payload: { task }
      })
    }

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 构建已有子节点信息
      const existingChildrenInfo =
        existingChildren.length > 0
          ? existingChildren
              .map(
                (child) => `  - ${child.name}${child.description ? ` (${child.description})` : ''}`
              )
              .join('\n')
          : '  暂无子节点'

      const aiPrompt = `# 任务
为指定的对象节点生成合适的属性。

# 完整上下文信息
${fullContextInfo}

# 当前节点详细信息
- 节点名称: ${node.name}
- 节点描述: ${node.description || '无'}
- 现有属性: ${Object.keys(node.properties || {}).length > 0 ? JSON.stringify(node.properties, null, 2) : '无'}

# 已有子节点
${existingChildrenInfo}

# 用户需求
${userPrompt || '生成适合这个对象的属性'}

# 输出格式
请严格按照以下JSON格式输出：
\`\`\`json
{
  "属性名1": "属性值1",
  "属性名2": "属性值2",
  "属性名3": "属性值3",
  "...": "..."
}
\`\`\`

# 生成要求
1. 生成的属性应该符合对象的名称和描述
2. 属性名应该简洁明了，使用驼峰命名法
3. 属性值应该是合适的数据类型
4. 避免与现有属性重复
5. 考虑节点的功能、用途以及在整个对象系统中的作用
6. 结合完整的上下文信息，确保生成的属性符合整体架构

请开始生成：`

      const response = await this.callAI(aiPrompt)

      // 解析响应
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonContent = jsonMatch ? jsonMatch[1] : response

      const properties = JSON.parse(jsonContent)

      // 更新任务状态为完成
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'completed',
              endTime: Date.now()
            }
          }
        })
      }

      return properties
    } catch (error) {
      // 更新任务状态为失败
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'failed',
              endTime: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      }
      throw error
    }
  }

  // 获取生成子节点的推荐提示词
  async getChildrenPromptRecommendations(context: AIGenerationContext): Promise<string[]> {
    const {
      node: parentNode,
      ancestorChain,
      siblings,
      existingChildren,
      getFullContextInformation,
      getNodeInformation
    } = context

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 获取当前节点的详细信息
      const nodeDetailInfo = getNodeInformation
        ? getNodeInformation(parentNode)
        : `节点名称: ${parentNode.name}\n节点描述: ${parentNode.description || '无'}`

      // 构建已有子节点信息
      const existingChildrenInfo =
        existingChildren.length > 0
          ? existingChildren
              .map(
                (child) => `  - ${child.name}${child.description ? ` (${child.description})` : ''}`
              )
              .join('\n')
          : '  暂无子节点'

      const aiPrompt = `# 任务
根据对象节点的上下文信息，为用户推荐5个用于生成子节点的提示词。

# 完整上下文信息
${fullContextInfo}

# 当前节点详细信息
${nodeDetailInfo}

# 已有子节点
${existingChildrenInfo}

# 输出格式
请严格按照以下JSON格式输出，只包含提示词数组：
\`\`\`json
["提示词1", "提示词2", "提示词3", "提示词4", "提示词5"]
\`\`\`

# 生成要求
1. 提示词应该简洁明了，15-30字左右
2. 提示词应该具有启发性，能够指导用户生成相关的子节点
3. 考虑节点的类型、用途以及整个对象树的结构
4. 避免与已有子节点重复
5. 提示词应该涵盖不同的角度和维度
6. 结合完整的上下文信息，确保推荐的提示词符合整体架构

请开始生成：`

      const response = await this.callAI(aiPrompt)

      // 解析响应
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonContent = jsonMatch ? jsonMatch[1] : response

      const recommendations = JSON.parse(jsonContent)
      if (!Array.isArray(recommendations)) {
        throw new Error('期望数组格式')
      }

      return recommendations.filter((rec) => typeof rec === 'string' && rec.trim())
    } catch (error) {
      console.error('获取子节点推荐失败:', error)
      // 返回默认推荐
      return [
        '添加基本功能模块',
        '生成配置相关选项',
        '创建状态管理字段',
        '添加数据处理逻辑',
        '生成用户界面组件'
      ]
    }
  }

  // 获取生成描述的推荐提示词
  async getDescriptionPromptRecommendations(context: AIGenerationContext): Promise<string[]> {
    const { node, getFullContextInformation, getNodeInformation } = context

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 获取当前节点的详细信息
      const nodeDetailInfo = getNodeInformation
        ? getNodeInformation(node)
        : `节点名称: ${node.name}\n节点描述: ${node.description || '无'}`

      const aiPrompt = `# 任务
根据对象节点的信息，为用户推荐5个用于生成节点描述的提示词。

# 完整上下文信息
${fullContextInfo}

# 当前节点详细信息
${nodeDetailInfo}

# 输出格式
请严格按照以下JSON格式输出，只包含提示词数组：
\`\`\`json
["提示词1", "提示词2", "提示词3", "提示词4", "提示词5"]
\`\`\`

# 生成要求
1. 提示词应该简洁明了，15-30字左右
2. 提示词应该帮助用户从不同角度描述节点
3. 考虑节点的功能、用途、特点以及在整个对象树中的位置
4. 提示词应该具有启发性和实用性
5. 涵盖功能说明、使用场景、技术特点等不同方面
6. 结合完整的上下文信息，确保推荐的提示词符合整体架构

请开始生成：`

      const response = await this.callAI(aiPrompt)

      // 解析响应
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonContent = jsonMatch ? jsonMatch[1] : response

      const recommendations = JSON.parse(jsonContent)
      if (!Array.isArray(recommendations)) {
        throw new Error('期望数组格式')
      }

      return recommendations.filter((rec) => typeof rec === 'string' && rec.trim())
    } catch (error) {
      console.error('获取描述推荐失败:', error)
      // 返回默认推荐
      return [
        '生成详细的功能说明',
        '描述主要用途和价值',
        '说明技术特点和优势',
        '介绍使用场景和应用',
        '解释核心概念和原理'
      ]
    }
  }

  // 获取生成属性的推荐提示词
  async getPropertiesPromptRecommendations(context: AIGenerationContext): Promise<string[]> {
    const { node, getFullContextInformation, getNodeInformation } = context

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 获取当前节点的详细信息
      const nodeDetailInfo = getNodeInformation
        ? getNodeInformation(node)
        : `节点名称: ${node.name}\n节点描述: ${node.description || '无'}`

      const existingProperties = Object.keys(node.properties || {})
      const existingPropertiesInfo =
        existingProperties.length > 0
          ? existingProperties.map((key) => `  - ${key}: ${node.properties?.[key]}`).join('\n')
          : '  暂无属性'

      const aiPrompt = `# 任务
根据对象节点的信息，为用户推荐5个用于生成对象属性的提示词。

# 完整上下文信息
${fullContextInfo}

# 当前节点详细信息
${nodeDetailInfo}

# 已有属性
${existingPropertiesInfo}

# 输出格式
请严格按照以下JSON格式输出，只包含提示词数组：
\`\`\`json
["提示词1", "提示词2", "提示词3", "提示词4", "提示词5"]
\`\`\`

# 生成要求
1. 提示词应该简洁明了，15-30字左右
2. 提示词应该帮助用户生成有用的对象属性
3. 考虑配置信息等不同类型的属性
4. 避免与已有属性重复
5. 提示词应该具有实用性和针对性
6. 结合完整的上下文信息，确保推荐的属性符合整体架构

请开始生成：`

      const response = await this.callAI(aiPrompt)

      // 解析响应
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonContent = jsonMatch ? jsonMatch[1] : response

      const recommendations = JSON.parse(jsonContent)
      if (!Array.isArray(recommendations)) {
        throw new Error('期望数组格式')
      }

      return recommendations.filter((rec) => typeof rec === 'string' && rec.trim())
    } catch (error) {
      console.error('获取属性推荐失败:', error)
      // 返回默认推荐
      return [
        '添加基本配置参数',
        '生成状态管理属性',
        '创建元数据信息',
        '添加验证规则属性',
        '生成显示控制选项'
      ]
    }
  }

  // 生成关系节点 - 新增方法
  async generateRelationNodes(
    context: AIGenerationContext,
    sourceNodeId: string,
    targetNodeId: string,
    userPrompt?: string,
    allNodes?: { [nodeId: string]: ObjectNodeType }
  ): Promise<ObjectNodeType[]> {
    const { node, getFullContextInformation, getNodeInformation } = context

    if (!allNodes) {
      throw new Error('需要提供所有节点信息来生成关系节点')
    }

    const sourceNode = allNodes[sourceNodeId]
    const targetNode = allNodes[targetNodeId]

    if (!sourceNode || !targetNode) {
      throw new Error('源节点或目标节点不存在')
    }

    const taskId = uuidv4()

    // 创建AI任务监控
    if (this.dispatch && this.chatId) {
      const task: AITask = {
        id: taskId,
        requestId: this.aiService.id,
        type: 'object_generation',
        status: 'running',
        title: '生成关系节点',
        description: `为节点 "${sourceNode.name}" 和 "${targetNode.name}" 生成关系节点`,
        chatId: this.chatId,
        modelId: this.llmConfig.id,
        startTime: Date.now(),
        context: {
          object: {
            nodeId: sourceNodeId,
            prompt: userPrompt || '生成关系节点'
          }
        }
      }

      this.dispatch({
        type: 'ADD_AI_TASK',
        payload: { task }
      })
    }

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 获取源节点和目标节点的详细信息
      const sourceNodeInfo = getNodeInformation ? getNodeInformation(sourceNode) : `节点名称: ${sourceNode.name}\n节点描述: ${sourceNode.description || '无'}`
      const targetNodeInfo = getNodeInformation ? getNodeInformation(targetNode) : `节点名称: ${targetNode.name}\n节点描述: ${targetNode.description || '无'}`

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

      // 解析响应
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonContent = jsonMatch ? jsonMatch[1] : response

      const relationData = JSON.parse(jsonContent)
      if (!Array.isArray(relationData)) {
        throw new Error('期望数组格式')
      }

      // 创建关系节点对象
      const relationNodes: ObjectNodeType[] = []

      for (const relData of relationData) {
        if (relData.name && relData.sourceRole && relData.targetRole) {
          const relationNode: ObjectNodeType = {
            id: uuidv4(),
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
                  createdAt: Date.now(),
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
                  createdAt: Date.now(),
                  source: 'ai',
                  aiPrompt: userPrompt || '生成关系节点'
                }
              }
            ],
            properties: relData.properties || {},
            children: [],
            expanded: false,
            metadata: {
              createdAt: Date.now(),
              source: 'ai',
              aiPrompt: userPrompt || '生成关系节点'
            }
          }

          relationNodes.push(relationNode)
        }
      }

      // 更新任务状态为完成
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'completed',
              endTime: Date.now()
            }
          }
        })
      }

      return relationNodes
    } catch (error) {
      // 更新任务状态为失败
      if (this.dispatch && this.chatId) {
        this.dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'failed',
              endTime: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      }
      throw error
    }
  }

  // 获取生成关系节点的推荐提示词 - 新增方法
  async getRelationsPromptRecommendations(
    context: AIGenerationContext,
    sourceNodeId?: string,
    targetNodeId?: string,
    allNodes?: { [nodeId: string]: ObjectNodeType }
  ): Promise<string[]> {
    const { node, getFullContextInformation, getNodeInformation } = context

    try {
      // 获取完整的上下文信息
      const fullContextInfo = getFullContextInformation ? getFullContextInformation() : ''

      // 获取当前节点的详细信息
      const nodeDetailInfo = getNodeInformation
        ? getNodeInformation(node)
        : `节点名称: ${node.name}\n节点描述: ${node.description || '无'}`

      let contextualInfo = ''
      if (sourceNodeId && targetNodeId && allNodes) {
        const sourceNode = allNodes[sourceNodeId]
        const targetNode = allNodes[targetNodeId]
        if (sourceNode && targetNode) {
          contextualInfo = `
# 关系生成上下文
源节点: ${sourceNode.name} (${sourceNode.description || '无描述'})
目标节点: ${targetNode.name} (${targetNode.description || '无描述'})
`
        }
      }

      const aiPrompt = `# 任务
根据对象节点的信息，为用户推荐5个用于生成关系节点的提示词。

# 完整上下文信息
${fullContextInfo}

# 当前节点详细信息
${nodeDetailInfo}

${contextualInfo}

# 输出格式
请严格按照以下JSON格式输出，只包含提示词数组：
\`\`\`json
["提示词1", "提示词2", "提示词3", "提示词4", "提示词5"]
\`\`\`

# 生成要求
1. 提示词应该简洁明了，15-30字左右
2. 提示词应该帮助用户识别和生成有用的关系节点
3. 考虑不同类型的关系（依赖、关联、对立、因果等）
4. 提示词应该具有启发性和实用性
5. 结合完整的上下文信息，确保推荐的关系符合整体架构

请开始生成：`

      const response = await this.callAI(aiPrompt)

      // 解析响应
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      const jsonContent = jsonMatch ? jsonMatch[1] : response

      const recommendations = JSON.parse(jsonContent)
      if (!Array.isArray(recommendations)) {
        throw new Error('期望数组格式')
      }

      return recommendations.filter((rec) => typeof rec === 'string' && rec.trim())
    } catch (error) {
      console.error('获取关系推荐失败:', error)
      // 返回默认推荐
      return [
        '查找两个节点的依赖关系',
        '识别功能性关联',
        '发现对立或冲突关系',
        '分析因果关系',
        '探索协作关系'
      ]
    }
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
