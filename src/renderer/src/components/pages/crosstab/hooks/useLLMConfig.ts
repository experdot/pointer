import { useCallback } from 'react'
import { App } from 'antd'
import { useAppStores } from '../../../../stores'

export function useLLMConfig(getLLMConfig: () => any) {
  const stores = useAppStores()
  const { message } = App.useApp()

  const validateAndGetConfig = useCallback(() => {
    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return null
    }

    const modelConfig = stores.settings.getModelConfigForLLM(llmConfig.id)
    if (!modelConfig) {
      message.error('请先在设置中配置模型参数')
      return null
    }

    return { llmConfig, modelConfig }
  }, [getLLMConfig, stores.settings, message])

  return { validateAndGetConfig }
}
