import { v4 as uuidv4 } from 'uuid'
import { executeAITask } from './aiTaskExecutor'
import { PROMPT_TEMPLATES, extractJsonContent } from '../CrosstabUtils'

export class CrosstabGenerator {
  async generateMetadata(
    userInput: string,
    llmConfig: any,
    modelConfig: any,
    stores: any,
    chatId: string,
    onTaskCreated?: (taskId: string, aiService: any) => void
  ) {
    if (!userInput.trim()) {
      throw new Error('请输入主题')
    }

    const prompt = PROMPT_TEMPLATES.metadata.replace(/\[USER_INPUT\]/g, userInput.trim())

    const result = await executeAITask({
      llmConfig,
      modelConfig,
      prompt,
      taskTitle: '生成多维度元数据',
      taskDescription: `分析主题"${userInput}"并生成多维度交叉表结构`,
      chatId,
      stores,
      onTaskCreated
    })

    const jsonContent = extractJsonContent(result)
    const metadata = JSON.parse(jsonContent)

    // 纠正元数据 - 添加ID和初始化值数组
    for (const dim of metadata.horizontalDimensions) {
      dim.id = uuidv4()
      dim.values = []
    }
    for (const dim of metadata.verticalDimensions) {
      dim.id = uuidv4()
      dim.values = []
    }
    for (const dim of metadata.valueDimensions) {
      dim.id = uuidv4()
    }

    return { result, metadata }
  }

  async generateDimensionValues(
    dimensionId: string,
    dimensionType: 'horizontal' | 'vertical',
    metadata: any,
    llmConfig: any,
    modelConfig: any,
    stores: any,
    chatId: string,
    onTaskCreated?: (taskId: string, aiService: any) => void
  ) {
    const dimensions =
      dimensionType === 'horizontal' ? metadata.horizontalDimensions : metadata.verticalDimensions

    const dimension = dimensions.find((d) => d.id === dimensionId)
    if (!dimension) {
      throw new Error('找不到指定的维度')
    }

    const prompt = PROMPT_TEMPLATES.dimension_values
      .replace('[METADATA_JSON]', JSON.stringify(metadata, null, 2))
      .replace('[DIMENSION_ID]', dimension.id)
      .replace('[DIMENSION_NAME]', dimension.name)
      .replace('[DIMENSION_DESCRIPTION]', dimension.description || '')

    const result = await executeAITask({
      llmConfig,
      modelConfig,
      prompt,
      taskTitle: '生成维度值',
      taskDescription: `生成维度"${dimension.name}"的值列表`,
      chatId,
      stores,
      onTaskCreated
    })

    const jsonContent = extractJsonContent(result)
    const values = JSON.parse(jsonContent)

    return { dimension, values }
  }

  async generateTableCell(
    combination: any,
    metadata: any,
    llmConfig: any,
    modelConfig: any,
    stores: any,
    chatId: string,
    onTaskCreated?: (taskId: string, aiService: any) => void
  ) {
    const prompt = PROMPT_TEMPLATES.cell_values
      .replace('[METADATA_JSON]', JSON.stringify(metadata, null, 2))
      .replace('[COMBINATION_JSON]', JSON.stringify(combination, null, 2))

    const cellDescription = [
      ...combination.horizontal.map((v) => v.value),
      ...combination.vertical.map((v) => v.value)
    ].join(' × ')

    const result = await executeAITask({
      llmConfig,
      modelConfig,
      prompt,
      taskTitle: '生成单元格数据',
      taskDescription: `生成单元格: ${cellDescription}`,
      chatId,
      stores,
      onTaskCreated
    })

    const jsonContent = extractJsonContent(result)
    let cellData

    try {
      cellData = JSON.parse(jsonContent)
    } catch (parseError) {
      console.error('JSON解析失败，尝试直接使用结果:', parseError)
      cellData = { error: '解析失败', rawResult: result }
    }

    // 处理不同的返回格式
    const processedCellData: any = {}
    for (const vd of metadata.valueDimensions) {
      const value =
        cellData[vd.id] !== undefined
          ? cellData[vd.id]
          : cellData[vd.name] !== undefined
            ? cellData[vd.name]
            : null
      processedCellData[vd.id] = value
    }

    return processedCellData
  }
}
