import React from 'react'
import { Dropdown } from 'antd'
import {
  PlayCircleOutlined,
  LoadingOutlined,
  DeleteOutlined,
  CommentOutlined
} from '@ant-design/icons'
import { CrosstabMetadata } from '../../../types'

// 从idea.md中提取的提示词模板
export const PROMPT_TEMPLATES = {
  metadata: `# 角色
你是一位专业的多维度交叉表（Crosstab）元数据设计师。你的核心任务是根据用户提供的主题，设计出最符合逻辑、最具洞察力的多维度交叉表结构元数据。

# 任务
分析用户输入的主题 \`[USER_INPUT]\`，并生成一个描述多维度交叉表结构的JSON对象。这个交叉表用于组织和展示关于该主题的**定性信息**。

# 核心原则
1. **维度选择**：横轴和纵轴可以包含多个维度，每个维度都有明确的分类意义
2. **维度层级**：多个维度之间存在父子嵌套关系，就像数据透视表一样
3. **值的性质**：值维度代表在横轴和纵轴交叉点上呈现的具体内容类型，必须是定性的、描述性的
4. **维度完整性**：若用户无特别说明，每个轴至少要有1个维度，最多建议3个维度

# 输出格式
严格按照以下JSON格式输出：
\`\`\`json
{
  "topic": "主题名称",
  "horizontalDimensions": [
    {
      "name": "横轴维度1名称",
      "description": "维度描述",
      "order": 1
    },
    {
      "name": "横轴维度2名称",
      "description": "维度描述",
      "order": 2
    }
  ],
  "verticalDimensions": [
    {
      "name": "纵轴维度1名称", 
      "description": "维度描述",
      "order": 1
    },
    {
      "name": "纵轴维度2名称",
      "description": "维度描述", 
      "order": 2
    }
  ],
  "valueDimensions": [
    {
      "name": "值维度1名称",
      "description": "值的具体描述，说明这个维度展示什么类型的信息"
    },
    {
      "name": "值维度2名称", 
      "description": "值的具体描述，说明这个维度展示什么类型的信息"
    }
  ]
}
\`\`\`

请为主题"[USER_INPUT]"生成多维度交叉表结构。`,

  dimension_values: `# 角色
你是一位专业的数据分析师和内容策略师。你的任务是为交叉表的指定维度生成代表性的值列表。

# 任务
根据交叉表元数据，为指定的维度生成一组具有代表性的、符合逻辑的示例值列表。

# 交叉表元数据
[METADATA_JSON]

# 目标维度
维度ID: [DIMENSION_ID]
维度名称: [DIMENSION_NAME]
维度描述: [DIMENSION_DESCRIPTION]

# 输出格式
严格遵守以下JSON数组格式：
\`\`\`json
["值1", "值2", "值3", "值4", "值5"]
\`\`\`

请为维度"[DIMENSION_NAME]"生成若干个代表性的值。`,

  cell_values: `# 角色
你是一位资深的领域专家和内容创作者。你的任务是为多维度交叉表的特定单元格生成对应的值内容。

# 任务
根据交叉表元数据和指定的横轴、纵轴维度组合，为每个值维度生成对应的内容。

# 交叉表元数据
[METADATA_JSON]

# 当前单元格位置
横轴维度组合: [HORIZONTAL_PATH]
纵轴维度组合: [VERTICAL_PATH]

# 值维度列表
[VALUE_DIMENSIONS]

# 输出格式
严格遵守以下JSON格式：
\`\`\`json
{
  "value1": "针对值维度1的具体内容",
  "value2": "针对值维度2的具体内容"
}
\`\`\`

请为当前单元格位置生成所有值维度的内容。`,

  // 维度建议生成模板
  dimensionSuggestions: `# 角色
你是一位专业的商业分析师和研究专家。你的任务是为给定的维度生成相关的候选项建议。

# 任务
基于当前交叉表的元数据和指定的维度，生成5个不同但相关的候选项。这些候选项应该：
1. 与主题和维度密切相关
2. 具有分析价值和实际意义
3. 适合用于交叉分析表的研究
4. 覆盖不同角度和层面

# 交叉表元数据
[METADATA_JSON]

# 目标维度
维度类型: [DIMENSION_TYPE]
维度名称: [DIMENSION_NAME]
维度描述: [DIMENSION_DESCRIPTION]

# 输出格式
严格遵守以下JSON数组格式：
\`\`\`json
["候选项1", "候选项2", "候选项3", "候选项4", "候选项5"]
\`\`\`

请为维度"[DIMENSION_NAME]"生成5个相关的候选项建议。`,

  topicSuggestions: `# 角色
你是一位专业的商业分析师和研究专家。你的任务是为给定的主题生成相关的主题候选项建议。

# 任务
基于当前主题，生成5个不同但相关的主题候选项。这些候选项应该：
1. 与当前主题密切相关
2. 具有分析价值和实际意义
3. 适合用于多维度交叉分析表的研究
4. 覆盖不同角度和层面

# 当前主题
[CURRENT_TOPIC]

# 输出格式
严格遵守以下JSON数组格式：
\`\`\`json
["主题候选项1", "主题候选项2", "主题候选项3", "主题候选项4", "主题候选项5"]
\`\`\`

请为当前主题"[CURRENT_TOPIC]"生成5个相关的主题候选项建议。`
}

/**
 * Extract JSON content from text enclosed in ```json blocks.
 *
 * @param text Input text containing JSON
 * @returns Extracted JSON content or original text if no JSON block found
 */
export function extractJsonContent(text: string): string {
  const JSON_PATTERN = /```json([\s\S]*?)```/
  const match = text.match(JSON_PATTERN)
  return match ? match[1] : text
}

/**
 * 生成多维度路径的工具函数
 */
export function generateDimensionPath(values: string[]): string {
  return values.join('/')
}

/**
 * 解析多维度路径的工具函数
 */
export function parseDimensionPath(path: string): string[] {
  return path.split('/')
}

/**
 * 生成多维度轴的所有组合
 */
export function generateAxisCombinations(dimensions: any[]): string[][] {
  if (dimensions.length === 0) return [[]]
  
  const [firstDimension, ...restDimensions] = dimensions
  const restCombinations = generateAxisCombinations(restDimensions)
  
  const result: string[][] = []
  for (const value of firstDimension.values) {
    for (const restCombination of restCombinations) {
      result.push([value, ...restCombination])
    }
  }
  
  return result
}

/**
 * 获取维度显示名称的工具函数
 */
export function getDimensionDisplayName(metadata: CrosstabMetadata | null, axis: 'horizontal' | 'vertical'): string {
  if (!metadata) return axis === 'horizontal' ? '横轴' : '纵轴'
  
  const dimensions = axis === 'horizontal' ? metadata.horizontalDimensions : metadata.verticalDimensions
  if (dimensions.length === 0) return axis === 'horizontal' ? '横轴' : '纵轴'
  
  return dimensions.map(d => d.name).join(' - ')
}

/**
 * Generate table data from crosstab data (temporary - will be replaced with multi-dimension version)
 */
export function generateTableData(
  verticalValues: string[],
  horizontalValues: string[],
  tableData: { [key: string]: { [key: string]: string } }
) {
  if (!verticalValues.length || !horizontalValues.length) {
    return []
  }

  return verticalValues.map((verticalItem) => {
    const row: any = { key: verticalItem, label: verticalItem }
    horizontalValues.forEach((horizontalItem) => {
      row[horizontalItem] = tableData[horizontalItem]?.[verticalItem] || ''
    })
    return row
  })
}

/**
 * Generate table columns from crosstab data (temporary - will be replaced with multi-dimension version)
 */
export function generateTableColumns(
  metadata: CrosstabMetadata | null,
  horizontalValues: string[],
  onGenerateColumn?: (horizontalItem: string) => void,
  isGeneratingColumn?: string | null,
  tableData?: { [key: string]: { [key: string]: string } },
  onGenerateRow?: (verticalItem: string) => void,
  isGeneratingRow?: string | null,
  onGenerateCell?: (horizontalItem: string, verticalItem: string) => void,
  isGeneratingCell?: string | null,
  onClearColumn?: (horizontalItem: string) => void,
  onClearRow?: (verticalItem: string) => void,
  onClearCell?: (horizontalItem: string, verticalItem: string) => void,
  onCreateChatFromCell?: (
    horizontalItem: string,
    verticalItem: string,
    cellContent: string,
    metadata: CrosstabMetadata | null
  ) => void
) {
  const columns: any[] = [
    {
      title: getDimensionDisplayName(metadata, 'vertical'),
      dataIndex: 'label',
      key: 'label',
      width: 150,
      render: (text: string) => {
        // 检查该行是否已有数据
        const hasData = horizontalValues.some(
          (horizontalItem) => tableData?.[horizontalItem]?.[text]
        )

        // 创建菜单项
        const menuItems: any[] = [
          {
            key: 'generate',
            icon: React.createElement(
              isGeneratingRow === text ? LoadingOutlined : PlayCircleOutlined
            ),
            label: hasData ? '重新生成此行' : '生成此行',
            onClick: () => onGenerateRow && onGenerateRow(text),
            disabled: isGeneratingRow !== null
          }
        ]

        if (hasData && onClearRow) {
          menuItems.push({
            key: 'clear',
            icon: React.createElement(DeleteOutlined),
            label: '清除此行',
            onClick: () => onClearRow(text)
          })
        }

        return React.createElement(
          'div',
          { className: 'row-header' },
          [
            React.createElement('div', { className: 'row-title', key: 'title' }, text),
            (onGenerateRow || onClearRow) &&
              React.createElement(Dropdown, {
                key: 'dropdown',
                menu: { items: menuItems },
                trigger: ['hover'],
                placement: 'bottomRight',
                children: React.createElement('div', { className: 'cell-menu-trigger' })
              })
          ].filter(Boolean)
        )
      }
    }
  ]

  horizontalValues.forEach((horizontalItem) => {
    // 检查该列是否已有数据
    const hasData = tableData?.[horizontalItem] && Object.keys(tableData[horizontalItem]).length > 0

    columns.push({
      title: () => {
        // 创建菜单项
        const menuItems: any[] = [
          {
            key: 'generate',
            icon: React.createElement(
              isGeneratingColumn === horizontalItem ? LoadingOutlined : PlayCircleOutlined
            ),
            label: hasData ? '重新生成此列' : '生成此列',
            onClick: () => onGenerateColumn && onGenerateColumn(horizontalItem),
            disabled: isGeneratingColumn !== null
          }
        ]

        if (hasData && onClearColumn) {
          menuItems.push({
            key: 'clear',
            icon: React.createElement(DeleteOutlined),
            label: '清除此列',
            onClick: () => onClearColumn(horizontalItem)
          })
        }

        return React.createElement(
          'div',
          { className: 'column-header' },
          [
            React.createElement('div', { className: 'column-title', key: 'title' }, horizontalItem),
            (onGenerateColumn || onClearColumn) &&
              React.createElement(Dropdown, {
                key: 'dropdown',
                menu: { items: menuItems },
                trigger: ['hover'],
                placement: 'bottomRight',
                children: React.createElement('div', { className: 'cell-menu-trigger' })
              })
          ].filter(Boolean)
        )
      },
      dataIndex: horizontalItem,
      key: horizontalItem,
      width: 200,
      render: (text: string, record: any) => {
        const verticalItem = record.label
        const cellKey = `${horizontalItem}-${verticalItem}`
        const isGenerating = isGeneratingCell === cellKey

        // 创建菜单项
        const menuItems: any[] = [
          {
            key: 'generate',
            icon: React.createElement(isGenerating ? LoadingOutlined : PlayCircleOutlined),
            label: text ? '重新生成' : '生成内容',
            onClick: () => onGenerateCell && onGenerateCell(horizontalItem, verticalItem),
            disabled: isGeneratingCell !== null
          }
        ]

        if (text && onClearCell) {
          menuItems.push({
            key: 'clear',
            icon: React.createElement(DeleteOutlined),
            label: '清除内容',
            onClick: () => onClearCell(horizontalItem, verticalItem)
          })
        }

        if (text && onCreateChatFromCell) {
          menuItems.push({
            key: 'chat',
            icon: React.createElement(CommentOutlined),
            label: '创建对话',
            onClick: () => onCreateChatFromCell(horizontalItem, verticalItem, text, metadata)
          })
        }

        return React.createElement(
          'div',
          { className: 'cell-content' },
          [
            React.createElement(
              'div',
              {
                className: `cell-text ${isGenerating ? 'generating' : ''} ${!text ? 'empty' : ''}`,
                key: 'text'
              },
              isGenerating ? '生成中...' : text || '点击生成内容'
            ),
            React.createElement(Dropdown, {
              key: 'dropdown',
              menu: { items: menuItems },
              trigger: ['hover'],
              placement: 'bottomRight',
              children: React.createElement('div', { className: 'cell-menu-trigger' })
            })
          ]
        )
      }
    })
  })

  return columns
}
