// Constants for app state management
export const SIDEBAR_MIN_WIDTH = 200
export const SIDEBAR_MAX_WIDTH = 600
export const SAVE_DEBOUNCE_DELAY = 500

// 默认ModelConfig
export const DEFAULT_MODEL_CONFIG = {
  id: 'default',
  name: 'AI助手',
  systemPrompt: '你是一个有用的AI助手，请提供准确、有帮助的回答。',
  topP: 0.9,
  temperature: 0.7,
  createdAt: Date.now()
}

// 默认提示词列表
const DEFAULT_PROMPT_LISTS = [
  {
    id: 'default-5w1h',
    name: '5W1H分析法',
    description: '从What、Who、When、Where、Why、How六个维度全面分析',
    prompts: [
      '这是什么？（What）',
      '涉及哪些人或组织？（Who）',
      '什么时候发生？（When）',
      '在哪里发生？（Where）',
      '为什么会这样？（Why）',
      '如何实现或解决？（How）'
    ],
    createdAt: Date.now()
  },
  {
    id: 'default-business',
    name: '商业分析',
    description: '商业项目或产品的全面分析框架',
    prompts: [
      '请分析市场现状和规模',
      '主要竞争对手有哪些？',
      '目标用户群体是谁？',
      '盈利模式是什么？',
      'SWOT分析（优势、劣势、机会、威胁）',
      '风险评估和应对策略'
    ],
    createdAt: Date.now()
  },
  {
    id: 'default-learning',
    name: '学习研究',
    description: '学习新概念或知识点的系统化提问',
    prompts: [
      '请详细解释这个概念',
      '能举几个具体例子吗？',
      '它的应用场景有哪些？',
      '有什么注意事项或常见误区？',
      '如何深入学习或实践？',
      '相关的延伸知识还有什么？'
    ],
    createdAt: Date.now()
  }
]

// Initial settings
export const INITIAL_SETTINGS = {
  llmConfigs: [],
  defaultLLMId: undefined,
  modelConfigs: [DEFAULT_MODEL_CONFIG],
  defaultModelConfigId: DEFAULT_MODEL_CONFIG.id,
  fontSize: 'medium' as const,
  promptLists: DEFAULT_PROMPT_LISTS,
  defaultPromptListId: DEFAULT_PROMPT_LISTS[0].id
}
