import type { ModelParameters, ProviderConnection, Settings } from '@shared/domain'
import { RuntimeError } from '@shared/contracts'

/** 显式选择必须有效；历史消息引用失效时使用当前默认配置。 */
export function resolveModelConfig(
  settings: Settings,
  selection: { llmId?: string; modelConfigId?: string } = {},
  previous: { llmId?: string; modelConfigId?: string } = {}
): {
  connection: ProviderConnection
  parameters: ModelParameters
  llmId: string
  modelConfigId?: string
} {
  const llms = settings.llmConfigs.items
  const llm = selection.llmId
    ? llms.find((item) => item.id === selection.llmId)
    : (llms.find((item) => item.id === previous.llmId) ??
      llms.find((item) => item.id === settings.defaultLLMId) ??
      llms[0])
  if (!llm)
    throw new RuntimeError(
      'ai.no-llm-config',
      selection.llmId ? '未找到指定的 LLM 配置' : '未找到可用的 LLM 配置'
    )
  if (!llm.apiKey) throw new RuntimeError('ai.no-api-key', `LLM 配置「${llm.name}」缺少 API Key`)

  const models = settings.modelConfigs.items
  const model = selection.modelConfigId
    ? models.find((item) => item.id === selection.modelConfigId)
    : (models.find((item) => item.id === previous.modelConfigId) ??
      models.find((item) => item.id === settings.defaultModelConfigId) ??
      models[0])
  if (selection.modelConfigId && !model)
    throw new RuntimeError('ai.no-model-config', '未找到指定的模型参数配置')

  return {
    connection: { baseUrl: llm.baseUrl, apiKey: llm.apiKey, modelName: llm.modelName },
    parameters: {
      systemPrompt: model?.systemPrompt ?? '',
      topP: model?.topP ?? 1,
      temperature: model?.temperature ?? 1
    },
    llmId: llm.id,
    modelConfigId: model?.id
  }
}
