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
    id: 'default-swot',
    name: 'SWOT分析',
    description: '分析优势、劣势、机会和威胁的战略分析工具',
    prompts: [
      '请分析内部优势（Strengths）',
      '请分析内部劣势（Weaknesses）',
      '请分析外部机会（Opportunities）',
      '请分析外部威胁（Threats）',
      '基于SWOT分析，给出战略建议',
      '如何发挥优势、弥补劣势、抓住机会、应对威胁？'
    ],
    createdAt: Date.now()
  },
  {
    id: 'default-pdca',
    name: 'PDCA循环',
    description: '计划-执行-检查-改进的持续改进循环',
    prompts: [
      '请制定详细的计划（Plan）',
      '如何执行这个计划（Do）？',
      '如何检查和评估执行效果（Check）？',
      '基于检查结果，如何改进和优化（Act）？',
      '下一轮PDCA循环应该关注什么？',
      '如何确保PDCA循环的持续性和有效性？'
    ],
    createdAt: Date.now()
  },
  {
    id: 'default-smart',
    name: 'SMART目标设定',
    description: '设定具体、可衡量、可实现、相关、有时限的目标',
    prompts: [
      '请设定具体明确的目标（Specific）',
      '如何衡量目标的达成程度（Measurable）？',
      '这个目标是否可实现（Achievable）？',
      '目标与整体战略的相关性如何（Relevant）？',
      '目标的时间期限是什么（Time-bound）？',
      '如何跟踪和调整目标进度？'
    ],
    createdAt: Date.now()
  },
  {
    id: 'default-fishbone',
    name: '鱼骨图分析',
    description: '从人、机、料、法、环、测六个维度分析问题根本原因',
    prompts: [
      '人员因素方面可能的原因（People）',
      '设备/技术方面可能的原因（Machine）',
      '材料/资源方面可能的原因（Material）',
      '方法/流程方面可能的原因（Method）',
      '环境因素方面可能的原因（Environment）',
      '测量/标准方面可能的原因（Measurement）',
      '请确定最可能的根本原因',
      '如何制定针对性的解决方案？'
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
  },
  {
    id: 'default-problem-solving',
    name: '问题解决',
    description: '系统化的问题分析和解决流程',
    prompts: [
      '请详细描述问题的具体表现',
      '问题的根本原因是什么？',
      '有哪些可能的解决方案？',
      '各种方案的优缺点是什么？',
      '推荐的最佳解决方案是什么？',
      '如何实施和验证解决方案？'
    ],
    createdAt: Date.now()
  },
  {
    id: 'default-decision-making',
    name: '决策分析',
    description: '复杂决策的系统化分析方法',
    prompts: [
      '需要决策的核心问题是什么？',
      '有哪些可选的决策方案？',
      '每个方案的评估标准是什么？',
      '各方案在不同标准下的表现如何？',
      '如何权衡和选择最佳方案？',
      '决策实施的风险和应对措施？'
    ],
    createdAt: Date.now()
  },
  {
    id: 'default-creative-thinking',
    name: '创新思维',
    description: '激发创新思维和创意的提问框架',
    prompts: [
      '当前方案存在哪些局限性？',
      '能否从不同角度重新思考这个问题？',
      '有哪些看似不相关的领域可以借鉴？',
      '如何突破常规思维模式？',
      '有哪些大胆的创新想法？',
      '如何将创新想法转化为可行方案？'
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
