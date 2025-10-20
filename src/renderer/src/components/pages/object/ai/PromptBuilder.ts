import { ObjectNode } from '../../../../types/type'

export interface PromptContext {
  fullContextInfo: string
  nodeName: string
  nodeDescription: string
  nodeProperties: Record<string, any>
  existingChildrenInfo: string
  userPrompt: string
}

export class PromptBuilder {
  static buildChildrenInfo(children: ObjectNode[]): string {
    return children.length > 0
      ? children
          .map((child) => `  - ${child.name}${child.description ? ` (${child.description})` : ''}`)
          .join('\n')
      : '  暂无子节点'
  }

  static buildNodeContext(node: ObjectNode, children: ObjectNode[]): string {
    const propertiesStr =
      Object.keys(node.properties || {}).length > 0
        ? JSON.stringify(node.properties, null, 2)
        : '无'

    return `# 当前节点详细信息
- 节点名称: ${node.name}
- 节点描述: ${node.description || '无'}
- 现有属性: ${propertiesStr}

# 已有子节点
${this.buildChildrenInfo(children)}`
  }

  static buildChildrenNamesPrompt(context: PromptContext): string {
    return `# 任务
根据用户的描述，为指定的对象节点生成子节点名称。你只需要生成一个JSON字符串数组，包含多个子节点的名称。

# 完整上下文信息
${context.fullContextInfo}

${this.buildNodeContext(
  {
    id: '',
    name: context.nodeName,
    description: context.nodeDescription,
    type: 'entity',
    properties: context.nodeProperties
  } as ObjectNode,
  []
)}

# 用户需求
${context.userPrompt}

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
  }

  static buildNodeDescriptionPrompt(context: PromptContext): string {
    return `# 任务
为指定的对象节点生成一个准确、简洁的描述。

# 完整上下文信息
${context.fullContextInfo}

${this.buildNodeContext(
  {
    id: '',
    name: context.nodeName,
    description: context.nodeDescription,
    type: 'entity',
    properties: context.nodeProperties
  } as ObjectNode,
  []
)}

# 用户需求
${context.userPrompt}

# 输出要求
请直接输出节点描述，不要包含任何格式化标记或额外说明。描述应该：
1. 简洁明了，50-200字左右
2. 准确反映节点的用途和功能
3. 使用自然语言，避免过于技术性的表述
4. 符合整个对象系统的语境
5. 结合节点的属性、子节点等信息，提供全面的描述
6. 结合完整的上下文信息，确保描述符合整体架构

请开始生成：`
  }

  static buildObjectPropertiesPrompt(context: PromptContext): string {
    return `# 任务
为指定的对象节点生成合适的属性。

# 完整上下文信息
${context.fullContextInfo}

${this.buildNodeContext(
  {
    id: '',
    name: context.nodeName,
    description: context.nodeDescription,
    type: 'entity',
    properties: context.nodeProperties
  } as ObjectNode,
  []
)}

# 用户需求
${context.userPrompt}

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
3. 属性值应该符合实际情况
4. 避免生成已存在的属性
5. 结合完整的上下文信息，确保属性符合整体架构

请开始生成：`
  }

  static buildPromptRecommendationsRequest(taskType: string, context: PromptContext): string {
    const taskDescriptions: Record<string, string> = {
      children: '生成子节点',
      description: '生成节点描述',
      properties: '生成对象属性',
      relations: '生成关系节点'
    }

    return `# 任务
为用户生成${taskDescriptions[taskType] || taskType}操作的提示词建议。

# 完整上下文信息
${context.fullContextInfo}

${this.buildNodeContext(
  {
    id: '',
    name: context.nodeName,
    description: context.nodeDescription,
    type: 'entity',
    properties: context.nodeProperties
  } as ObjectNode,
  []
)}

# 输出格式
请严格按照以下JSON格式输出3-5个提示词建议：
\`\`\`json
["建议1", "建议2", "建议3", "建议4", "建议5"]
\`\`\`

# 生成要求
1. 提示词应该简洁明了，易于理解
2. 提示词应该具有操作性，能够指导AI生成合适的内容
3. 提示词应该符合节点的上下文和层级结构
4. 提示词应该多样化，覆盖不同的生成方向

请开始生成：`
  }

  static extractJsonContent(response: string): string {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
    return jsonMatch ? jsonMatch[1] : response
  }

  static parseJsonArray<T = any>(jsonString: string): T[] {
    const content = this.extractJsonContent(jsonString)
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) {
      throw new Error('期望数组格式')
    }
    return parsed
  }

  static parseJsonObject<T = any>(jsonString: string): T {
    const content = this.extractJsonContent(jsonString)
    const parsed = JSON.parse(content)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('期望对象格式')
    }
    return parsed
  }
}
