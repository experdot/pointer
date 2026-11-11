import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RuntimeError } from '@shared/contracts'
import { defaultSettings } from '@shared/domain'
import { command, query } from './client'
import { useSessionStore } from '../stores/sessionStore'

const port = { query: vi.fn(), command: vi.fn() }
beforeEach(() => {
  port.query.mockReset()
  port.command.mockReset()
  vi.stubGlobal('window', { runtime: port })
  useSessionStore.setState({ scopeId: 'scope' })
})
afterEach(() => vi.unstubAllGlobals())

describe('跨 contextBridge 的错误数据', () => {
  it('设置冲突重新构建错误实例并保留可供重试的权威快照', async () => {
    const details = { settings: defaultSettings(), revision: 2 }
    port.command.mockRejectedValue({
      name: 'RuntimeError',
      code: 'settings.conflict',
      message: '设置已变化',
      details
    })
    const result = command('settings.replace', { settings: defaultSettings(), baseRevision: 1 })
    await expect(result).rejects.toBeInstanceOf(RuntimeError)
    await expect(result).rejects.toMatchObject({
      code: 'settings.conflict',
      message: '设置已变化',
      details
    })
  })
  it('查询保留过期错误码；普通传输错误保持原对象', async () => {
    port.query.mockRejectedValueOnce({ code: 'runtime.stale-scope', message: '已切换' })
    await expect(query('tree.get', undefined)).rejects.toMatchObject({
      code: 'runtime.stale-scope'
    })
    const error = new Error('通道断开')
    port.query.mockRejectedValueOnce(error)
    await expect(query('tree.get', undefined)).rejects.toBe(error)
  })
})
