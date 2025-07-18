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

// Initial settings
export const INITIAL_SETTINGS = {
  llmConfigs: [],
  defaultLLMId: undefined,
  modelConfigs: [DEFAULT_MODEL_CONFIG],
  defaultModelConfigId: DEFAULT_MODEL_CONFIG.id,
  fontSize: 'medium' as const
}
