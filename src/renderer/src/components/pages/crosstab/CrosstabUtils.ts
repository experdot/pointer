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
你是一位专业的交叉表（Crosstab）元数据设计师。你的核心任务是根据用户提供的主题，设计出最符合逻辑、最具洞察力的交叉表结构元数据。

# 任务
分析用户输入的主题 \`[USER_INPUT]\`，并生成一个描述交叉表结构的JSON对象。这个交叉表用于组织和展示关于该主题的**定性信息**。

# 核心原则
1. **维度选择**：\`横轴\`和\`纵轴\`必须是该主题下两个相互正交、有意义的分类维度。
2. **值的性质**：\`值\`代表在横轴和纵轴交叉点上呈现的具体内容。它**必须是定性的、描述性的文本**。

# 输出格式
严格按照以下JSON格式输出：
\`\`\`json
{"Topic":"","HorizontalAxis":"","VerticalAxis":"","Value":""}
\`\`\`

请为主题"[USER_INPUT]"生成交叉表结构。`,

  horizontal: `# 角色
你是一位专业的数据分析师和内容策略师。你的任务是为交叉表的横轴生成代表性的值列表。

# 任务
根据交叉表元数据，为\`横轴\`生成一组具有代表性的、符合逻辑的示例值列表。

# 交叉表元数据
[METADATA_JSON]

# 输出格式
严格遵守以下JSON数组格式：
\`\`\`json
["值1", "值2", "值3", "..."]
\`\`\`

请为横轴"[HORIZONTAL_AXIS]"生成代表性的值列表。`,

  vertical: `# 角色
你是一位专业的数据分析师和内容策略师。你的任务是为交叉表的纵轴生成代表性的值列表。

# 任务
根据交叉表元数据，为\`纵轴\`生成一组具有代表性的、符合逻辑的示例值列表。

# 交叉表元数据
[METADATA_JSON]

# 输出格式
严格遵守以下JSON数组格式：
\`\`\`json
["值1", "值2", "值3", "..."]
\`\`\`

请为纵轴"[VERTICAL_AXIS]"生成代表性的值列表。`,

  values: `# 角色
你是一位资深的领域专家和内容创作者。你的任务是为交叉表的一整列填充数据。

# 任务
根据交叉表元数据和指定的横轴项目，为每个纵轴项目生成对应的值。

# 交叉表元数据
[METADATA_JSON]

# 当前横轴项目
[HORIZONTAL_ITEM]

# 纵轴项目列表
[VERTICAL_ITEMS]

# 输出格式
生成一个JSON对象，键为纵轴项目，值为对应的描述性内容：
\`\`\`json
{
  "纵轴项目1": "描述性内容1",
  "纵轴项目2": "描述性内容2",
  "...": "..."
}
\`\`\`

请为横轴项目"[HORIZONTAL_ITEM]"生成对应的数据。`,

  rowValues: `# 角色
你是一位资深的领域专家和内容创作者。你的任务是为交叉表的一整行填充数据。

# 任务
根据交叉表元数据和指定的纵轴项目，为每个横轴项目生成对应的值。

# 交叉表元数据
[METADATA_JSON]

# 当前纵轴项目
[VERTICAL_ITEM]

# 横轴项目列表
[HORIZONTAL_ITEMS]

# 输出格式
生成一个JSON对象，键为横轴项目，值为对应的描述性内容：
\`\`\`json
{
  "横轴项目1": "描述性内容1",
  "横轴项目2": "描述性内容2",
  "...": "..."
}
\`\`\`

请为纵轴项目"[VERTICAL_ITEM]"生成对应的数据。`,

  cellValue: `# 角色
你是一位资深的领域专家和内容创作者。你的任务是为交叉表的单个单元格生成精准的内容。

# 任务
根据交叉表元数据、指定的横轴项目和纵轴项目，生成对应交叉点的具体值。

# 交叉表元数据
[METADATA_JSON]

# 横轴项目
[HORIZONTAL_ITEM]

# 纵轴项目
[VERTICAL_ITEM]

# 输出格式
直接输出该单元格的描述性内容，不需要JSON格式，只需要纯文本内容：

请为横轴项目"[HORIZONTAL_ITEM]"和纵轴项目"[VERTICAL_ITEM]"的交叉点生成具体内容。`,

  horizontalSuggestions: `# 角色
你是一位专业的数据分析师和策略顾问。你的任务是为给定的主题生成横轴的候选项建议。

# 任务
基于主题和当前的横轴定义，生成5个不同的横轴候选项。这些候选项应该：
1. 与主题密切相关
2. 与当前横轴在逻辑上相关但有所不同
3. 具有很好的分析价值
4. 能够与纵轴形成有意义的交叉分析

# 交叉表元数据
[METADATA_JSON]

# 输出格式
严格遵守以下JSON数组格式：
\`\`\`json
["候选项1", "候选项2", "候选项3", "候选项4", "候选项5"]
\`\`\`

请为主题"[TOPIC]"的横轴生成5个候选项建议。`,

  verticalSuggestions: `# 角色
你是一位专业的数据分析师和策略顾问。你的任务是为给定的主题生成纵轴的候选项建议。

# 任务
基于主题和当前的纵轴定义，生成5个不同的纵轴候选项。这些候选项应该：
1. 与主题密切相关
2. 与当前纵轴在逻辑上相关但有所不同
3. 具有很好的分析价值
4. 能够与横轴形成有意义的交叉分析

# 交叉表元数据
[METADATA_JSON]

# 输出格式
严格遵守以下JSON数组格式：
\`\`\`json
["候选项1", "候选项2", "候选项3", "候选项4", "候选项5"]
\`\`\`

请为主题"[TOPIC]"的纵轴生成5个候选项建议。`,

  topicSuggestions: `# 角色
你是一位专业的商业分析师和研究专家。你的任务是为给定的主题生成相关的主题候选项建议。

# 任务
基于当前主题，生成5个不同但相关的主题候选项。这些候选项应该：
1. 与当前主题密切相关
2. 具有分析价值和实际意义
3. 适合用于交叉分析表的研究
4. 覆盖不同角度和层面

# 当前主题
[CURRENT_TOPIC]

# 输出格式
严格遵守以下JSON数组格式：
\`\`\`json
["主题候选项1", "主题候选项2", "主题候选项3", "主题候选项4", "主题候选项5"]
\`\`\`

请为当前主题"[CURRENT_TOPIC]"生成5个相关的主题候选项建议。`,

  valueSuggestions: `# 角色
你是一位专业的数据分析师和内容策略师。你的任务是为交叉分析表的"值"生成候选项建议。

# 任务
根据交叉表的主题、横轴和纵轴，生成5个不同的"值"候选项。这些候选项应该：
1. 与主题、横轴、纵轴高度相关
2. 描述在横轴和纵轴交叉点应该呈现什么内容
3. 都是定性的、描述性的表述
4. 具有实际分析价值

# 交叉表信息
- 主题：[TOPIC]
- 横轴：[HORIZONTAL_AXIS]
- 纵轴：[VERTICAL_AXIS]
- 当前值定义：[CURRENT_VALUE]

# 输出格式
严格遵守以下JSON数组格式：
\`\`\`json
["值候选项1", "值候选项2", "值候选项3", "值候选项4", "值候选项5"]
\`\`\`

请为这个交叉分析表生成5个"值"的候选项建议。`
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
 * Generate table data from crosstab data
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
 * Generate table columns from crosstab data
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
      title: metadata?.VerticalAxis || '纵轴',
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
        const cellKey = `${horizontalItem}_${verticalItem}`
        const hasValue = Boolean(text)

        // 创建菜单项
        const menuItems: any[] = [
          {
            key: 'generate',
            icon: React.createElement(
              isGeneratingCell === cellKey ? LoadingOutlined : PlayCircleOutlined
            ),
            label: hasValue ? '重新生成此单元格' : '生成此单元格',
            onClick: () => onGenerateCell && onGenerateCell(horizontalItem, verticalItem),
            disabled: isGeneratingCell !== null
          }
        ]

        if (hasValue && onClearCell) {
          menuItems.push({
            key: 'clear',
            icon: React.createElement(DeleteOutlined),
            label: '清除此单元格',
            onClick: () => onClearCell(horizontalItem, verticalItem)
          })
        }

        // 如果有内容，添加创建聊天窗口的菜单项
        if (hasValue && onCreateChatFromCell) {
          menuItems.push({
            key: 'chat',
            icon: React.createElement(CommentOutlined),
            label: '基于此内容创建聊天',
            onClick: () => onCreateChatFromCell(horizontalItem, verticalItem, text, metadata)
          })
        }

        return React.createElement('div', { className: 'cell-content' }, [
          React.createElement('div', { className: 'cell-value', key: 'value' }, text || '-'),
          (onGenerateCell || onClearCell || onCreateChatFromCell) &&
            React.createElement(Dropdown, {
              key: 'dropdown',
              menu: { items: menuItems },
              trigger: ['hover'],
              placement: 'bottomRight',
              children: React.createElement('div', { className: 'cell-menu-trigger' })
            })
        ])
      }
    })
  })

  return columns
}
