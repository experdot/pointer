import { describe, expect, it } from 'vitest'
import { addConfigItem } from './configTree'
import { defaultSettings, validateSettings } from './settings'
import type { LLMConfig, ModelConfig } from './settings'

function llm(id: string, patch: Partial<LLMConfig> = {}): LLMConfig {
  return {
    id,
    kind: 'item',
    name: id,
    order: 0,
    createdAt: 1,
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'sk-test',
    modelName: 'gpt-x',
    ...patch
  }
}

function model(id: string, patch: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id,
    kind: 'item',
    name: id,
    order: 0,
    createdAt: 1,
    systemPrompt: '',
    topP: 1,
    temperature: 1,
    ...patch
  }
}

describe('设置校验', () => {
  it('默认设置为空且合法', () => {
    const settings = defaultSettings()
    expect(settings.fontSize).toBe('medium')
    expect(validateSettings(settings)).toEqual([])
  })

  it('默认项指向不存在的配置时报错', () => {
    const settings = { ...defaultSettings(), defaultLLMId: 'missing' }
    expect(validateSettings(settings).map((d) => d.code)).toContain('settings.default-llm-missing')
  })

  it('连接信息缺失与参数越界被捕获', () => {
    let settings = defaultSettings()
    settings = {
      ...settings,
      llmConfigs: addConfigItem(settings.llmConfigs, llm('l1', { baseUrl: '  ' })),
      modelConfigs: addConfigItem(settings.modelConfigs, model('c1', { temperature: 5, topP: 0 }))
    }

    const codes = validateSettings(settings).map((d) => d.code)
    expect(codes).toContain('settings.llm-base-url-required')
    expect(codes).toContain('settings.temperature-range')
    expect(codes).toContain('settings.top-p-range')
  })

  it('合法配置通过校验', () => {
    let settings = defaultSettings()
    settings = {
      ...settings,
      llmConfigs: addConfigItem(settings.llmConfigs, llm('l1')),
      modelConfigs: addConfigItem(settings.modelConfigs, model('c1'))
    }
    expect(validateSettings(settings)).toEqual([])
  })
})
