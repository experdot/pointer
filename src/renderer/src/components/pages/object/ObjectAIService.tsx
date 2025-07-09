import { ObjectNode as ObjectNodeType } from '../../../types'

export interface AIGenerationContext {
  node: ObjectNodeType
  ancestorChain: ObjectNodeType[]
  siblings: ObjectNodeType[]
  existingChildren: ObjectNodeType[]
}

export interface AIGenerationResult {
  success: boolean
  data?: any
  error?: string
}

export class ObjectAIService {
  private llmConfig: any
  private aiService: any

  constructor(llmConfig: any, aiService: any) {
    this.llmConfig = llmConfig
    this.aiService = aiService
  }

  // 生成子节点名称（简化版）
  async generateChildrenNames(context: AIGenerationContext, userPrompt: string): Promise<string[]> {
    const { node: parentNode, ancestorChain, siblings, existingChildren } = context

    // 构建层级结构信息
    const hierarchyInfo = ancestorChain
      .map((ancestor, index) => {
        const indent = '  '.repeat(index)
        return `${indent}- ${ancestor.name}`
      })
      .join('\n')

    // 构建平级节点信息
    const siblingsInfo =
      siblings.length > 0
        ? siblings.map((sibling) => `  - ${sibling.name}`).join('\n')
        : '  无平级节点'

    // 构建已有子节点信息
    const existingChildrenInfo =
      existingChildren.length > 0
        ? existingChildren.map((child) => `  - ${child.name}`).join('\n')
        : '  暂无子节点'

    const aiPrompt = `# 任务
根据用户的描述，为指定的对象节点生成子节点名称。你只需要生成一个JSON字符串数组，包含多个子节点的名称。

# 对象结构上下文

## 层级结构（从根节点到当前节点）
${hierarchyInfo}

## 当前节点信息
- 节点名称: ${parentNode.name}
- 节点类型: ${parentNode.type}

## 平级节点信息
${siblingsInfo}

## 已有子节点
${existingChildrenInfo}

# 用户需求
${userPrompt}

# 输出格式
请严格按照以下JSON格式输出，只包含名称数组：
\`\`\`json
["子节点名称1", "子节点名称2", "子节点名称3"]
\`\`\`

# 生成要求
1. 只生成子节点的名称，不包含其他信息
2. 避免与已有子节点重复
3. 参考平级节点的命名风格
4. 生成的名称应该语义清晰、简洁
5. 建议生成3-6个名称
6. 考虑父节点的类型和用途

请开始生成：`

    const response = await this.callAI(aiPrompt)

    // 解析响应
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
    const jsonContent = jsonMatch ? jsonMatch[1] : response

    try {
      const names = JSON.parse(jsonContent)
      if (!Array.isArray(names)) {
        throw new Error('期望数组格式')
      }
      return names.filter((name) => typeof name === 'string' && name.trim())
    } catch (error) {
      throw new Error('AI响应格式错误')
    }
  }

  // 生成节点描述
  async generateNodeDescription(node: ObjectNodeType, userPrompt?: string): Promise<string> {
    const aiPrompt = `# 任务
为指定的对象节点生成一个准确、简洁的描述。

# 节点信息
- 名称: ${node.name}
- 类型: ${node.type}
- 当前描述: ${node.description || '无'}

# 用户需求
${userPrompt || '生成一个符合节点名称和类型的描述'}

# 输出要求
请直接输出描述文本，不要包含任何格式化标记。描述应该：
1. 简洁明了，通常1-2句话
2. 准确反映节点的用途和含义
3. 符合中文表达习惯

请开始生成：`

    const response = await this.callAI(aiPrompt)
    return response.trim()
  }

  // 生成节点值
  async generateNodeValue(node: ObjectNodeType, userPrompt?: string): Promise<any> {
    const aiPrompt = `# 任务
为指定的对象节点生成一个合理的值。

# 节点信息
- 名称: ${node.name}
- 类型: ${node.type}
- 描述: ${node.description || '无'}
- 当前值: ${node.value || '无'}

# 用户需求
${userPrompt || '生成一个符合节点类型和用途的默认值'}

# 输出格式
根据节点类型，直接输出对应的值：
- string类型：直接输出字符串内容
- number类型：直接输出数字
- boolean类型：直接输出true或false
- object类型：输出JSON对象
- array类型：输出JSON数组
- null类型：输出null

请开始生成：`

    const response = await this.callAI(aiPrompt)

    // 尝试解析为JSON，如果失败则作为字符串返回
    try {
      return JSON.parse(response.trim())
    } catch {
      return response.trim()
    }
  }

  // 生成对象属性
  async generateObjectProperties(
    node: ObjectNodeType,
    userPrompt?: string
  ): Promise<Record<string, any>> {
    if (node.type !== 'object') {
      throw new Error('只能为object类型的节点生成属性')
    }

    const aiPrompt = `# 任务
为指定的对象节点生成属性键值对。

# 节点信息
- 名称: ${node.name}
- 类型: ${node.type}
- 描述: ${node.description || '无'}
- 当前属性: ${JSON.stringify(node.properties || {}, null, 2)}

# 用户需求
${userPrompt || '生成一些符合对象用途的属性'}

# 输出格式
请严格按照以下JSON格式输出：
\`\`\`json
{
  "属性名1": "属性值1",
  "属性名2": 123,
  "属性名3": true
}
\`\`\`

# 生成要求
1. 属性名应该符合编程规范（驼峰命名等）
2. 属性值应该与属性名的含义匹配
3. 避免与现有属性重复
4. 建议生成3-8个属性

请开始生成：`

    const response = await this.callAI(aiPrompt)

    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
    const jsonContent = jsonMatch ? jsonMatch[1] : response

    try {
      const properties = JSON.parse(jsonContent)
      if (typeof properties !== 'object' || Array.isArray(properties)) {
        throw new Error('期望对象格式')
      }
      return properties
    } catch (error) {
      throw new Error('AI响应格式错误')
    }
  }

  // 优化节点结构
  async optimizeNodeStructure(
    node: ObjectNodeType,
    children: ObjectNodeType[],
    userPrompt?: string
  ): Promise<{
    suggestions: string[]
    optimizedChildren?: ObjectNodeType[]
  }> {
    const childrenInfo = children
      .map((child) => `- ${child.name} (${child.type}): ${child.description || '无描述'}`)
      .join('\n')

    const aiPrompt = `# 任务
分析当前节点结构并提供优化建议。

# 节点信息
- 名称: ${node.name}
- 类型: ${node.type}
- 描述: ${node.description || '无'}

# 子节点信息
${childrenInfo || '无子节点'}

# 用户需求
${userPrompt || '分析当前结构并提供优化建议'}

# 输出格式
请严格按照以下JSON格式输出：
\`\`\`json
{
  "suggestions": [
    "建议1",
    "建议2",
    "建议3"
  ]
}
\`\`\`

# 分析要求
1. 检查命名是否规范
2. 检查结构是否合理
3. 检查是否有重复或冗余
4. 提供具体的改进建议

请开始分析：`

    const response = await this.callAI(aiPrompt)

    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
    const jsonContent = jsonMatch ? jsonMatch[1] : response

    try {
      const result = JSON.parse(jsonContent)
      return {
        suggestions: result.suggestions || [],
        optimizedChildren: result.optimizedChildren
      }
    } catch (error) {
      throw new Error('AI响应格式错误')
    }
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
export function createObjectAIService(llmConfig: any, aiService: any): ObjectAIService {
  return new ObjectAIService(llmConfig, aiService)
}
