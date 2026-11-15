import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from './settingsStore'
import { command } from '../runtime/client'
import type { LLMConfig, ModelConfig } from '@shared/domain'
import { configChildren, defaultSettings, validateOrderKeys } from '@shared/domain'
import type { RuntimeCommandPayload } from '@shared/contracts'

vi.mock('../runtime/client', () => ({ command: vi.fn(), query: vi.fn() }))
const llm: LLMConfig = {
  id: 'llm',
  kind: 'item',
  name: '模型',
  orderKey: 'a0',
  createdAt: 1,
  apiKey: 'key',
  baseUrl: 'http://local/v1',
  modelName: 'model'
}
const model: ModelConfig = {
  id: 'model',
  kind: 'item',
  name: '参数',
  orderKey: 'a0',
  createdAt: 1,
  systemPrompt: 'system',
  temperature: 0.5,
  topP: 0.9
}
beforeEach(() => {
  useSettingsStore.getState().reset()
  let revision = 0
  vi.mocked(command)
    .mockReset()
    .mockImplementation(async (_name, input) => {
      const payload = input as RuntimeCommandPayload<'settings.replace'>
      return { settings: payload.settings, revision: ++revision, mutationId: payload.mutationId }
    })
})
afterEach(() => useSettingsStore.getState().reset())

describe('配置树操作与持久化', () => {
  it('移动与插入在冲突重放时使用最新邻居，其他键保持原样', async () => {
    const state = useSettingsStore.getState()
    const settings = defaultSettings()
    settings.llmConfigs.items = [
      llm,
      { ...llm, id: 'b', orderKey: 'a1' },
      { ...llm, id: 'c', orderKey: 'a2' }
    ]
    state.accept({ settings, revision: 1 })
    state.moveLLMNode({ nodeId: 'c', targetNodeId: 'llm', placement: 'after' })
    state.addLLMConfig({ ...llm, id: 'new' }, { afterNodeId: 'c' })
    const latest = structuredClone(settings)
    latest.llmConfigs.items.splice(1, 0, { ...llm, id: 'external', orderKey: 'a0G' })
    vi.mocked(command)
      .mockRejectedValueOnce({
        code: 'settings.conflict',
        details: { settings: latest, revision: 2 }
      })
      .mockImplementationOnce(async (_name, input) => {
        const payload = input as RuntimeCommandPayload<'settings.replace'>
        expect(payload.baseRevision).toBe(2)
        return { settings: payload.settings, revision: 3, mutationId: payload.mutationId }
      })
    await state.flush()
    const tree = useSettingsStore.getState().settings.llmConfigs
    expect(configChildren(tree, undefined).map((n) => n.id)).toEqual([
      'llm',
      'c',
      'new',
      'external',
      'b'
    ])
    expect(tree.items.find((n) => n.id === 'external')!.orderKey).toBe('a0G')
    expect(tree.items.find((n) => n.id === 'b')!.orderKey).toBe('a1')
    expect(validateOrderKeys(tree.items)).toEqual([])
    vi.mocked(command).mockClear()
    state.moveLLMNode({ nodeId: 'c', targetNodeId: 'new', placement: 'before' })
    await state.flush()
    expect(command).not.toHaveBeenCalled()
  })

  it('参数树移动与跨目录意图也可重放', async () => {
    const state = useSettingsStore.getState()
    state.addModelConfig(model)
    state.addModelConfigFolder({
      id: 'folder',
      kind: 'folder',
      name: '分组',
      orderKey: 'a1',
      createdAt: 1
    })
    state.moveModelNode({ nodeId: 'model', targetNodeId: 'folder', placement: 'inside' })
    await state.flush()
    expect(useSettingsStore.getState().settings.modelConfigs.items[0]).toMatchObject({
      parentFolderId: 'folder',
      orderKey: 'a0'
    })
    expect(() =>
      state.moveModelNode({ nodeId: 'folder', targetNodeId: 'folder', placement: 'inside' })
    ).toThrow()
  })
  it('创建、复制、编辑、移动、删除后清除失效默认模型', async () => {
    const state = useSettingsStore.getState()
    state.addLLMConfig(llm)
    state.addLLMConfig({ ...llm, id: 'copy', name: '副本' })
    state.addLLMConfigFolder({
      id: 'folder',
      kind: 'folder',
      name: '分组',
      orderKey: 'a0',
      createdAt: 1
    })
    state.moveLLMNode({ nodeId: 'copy', targetNodeId: 'folder', placement: 'end' })
    state.updateLLMConfig('copy', { modelName: 'copy-model' })
    state.setDefaultLLMId('copy')
    await state.flush()
    const settings = useSettingsStore.getState().settings
    expect(settings.llmConfigs.items.find((item) => item.id === 'copy')).toMatchObject({
      apiKey: 'key',
      parentFolderId: 'folder',
      modelName: 'copy-model'
    })
    expect(settings.llmConfigs.items.find((item) => item.id === 'llm')?.modelName).toBe('model')
    state.clearLLMConfigFolder('folder')
    await state.flush()
    expect(useSettingsStore.getState().settings.defaultLLMId).toBeUndefined()
    expect(useSettingsStore.getState().settings.llmConfigs.items.map((item) => item.id)).toEqual([
      'llm'
    ])
  })
  it('删除参数分组时提升子项并保留默认值；删除默认参数后清理引用', async () => {
    const state = useSettingsStore.getState()
    state.addModelConfigFolder({
      id: 'folder',
      kind: 'folder',
      name: '分组',
      orderKey: 'a0',
      createdAt: 1
    })
    state.addModelConfig({ ...model, parentFolderId: 'folder' })
    state.setDefaultModelConfigId('model')
    state.updateModelConfig('model', { temperature: 0.2 })
    state.removeModelConfigFolder('folder')
    await state.flush()
    expect(useSettingsStore.getState().settings.modelConfigs.items[0]).toMatchObject({
      temperature: 0.2,
      parentFolderId: undefined
    })
    expect(useSettingsStore.getState().settings.defaultModelConfigId).toBe('model')
    state.removeModelConfig('model')
    await state.flush()
    expect(useSettingsStore.getState().settings.defaultModelConfigId).toBeUndefined()
  })
  it('配置提交失败保留修改，重试后内核确认与界面一致', async () => {
    vi.mocked(command).mockRejectedValueOnce(new Error('不可写'))
    const state = useSettingsStore.getState()
    state.addLLMConfig(llm)
    state.setDefaultLLMId('llm')
    await expect(state.flush()).rejects.toThrow('不可写')
    expect(useSettingsStore.getState().settings.llmConfigs.items).toEqual([llm])
    await state.flush()
    expect(command).toHaveBeenLastCalledWith(
      'settings.replace',
      expect.objectContaining({ settings: useSettingsStore.getState().settings })
    )
  })
})
