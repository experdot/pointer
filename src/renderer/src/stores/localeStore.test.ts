import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocaleSnapshot } from '@shared/contracts'
import { useLocaleStore } from './localeStore'
import { useMessagesStore } from './messagesStore'
import { useSessionStore } from './sessionStore'
import { rendererI18n } from '../i18n'

const chinese: LocaleSnapshot = {
  preference: 'system',
  language: 'zh-CN',
  systemLanguage: 'zh-CN',
  revision: 0
}
beforeEach(() => {
  useLocaleStore.setState({ snapshot: null, saving: false })
  useLocaleStore.getState().accept(chinese)
  useSessionStore.getState().reset()
  useMessagesStore.getState().reset()
})

describe('应用语言镜像', () => {
  it('旧响应不覆盖较新的全局事件，切换不清空正在生成的会话', async () => {
    const message = {
      id: 'answer',
      role: 'assistant' as const,
      content: '中文原文',
      createdAt: 1,
      branchIndex: 0
    }
    useMessagesStore.getState().upsertMessage('page', message, 'request')
    useMessagesStore.getState().setStreaming('answer', true)
    const before = useMessagesStore.getState().cache
    useLocaleStore
      .getState()
      .accept({ ...chinese, preference: 'en-US', language: 'en-US', revision: 2 })
    useLocaleStore.getState().accept({ ...chinese, revision: 1 })
    expect(rendererI18n.language).toBe('en-US')
    expect(useMessagesStore.getState().cache).toBe(before)
    expect(useMessagesStore.getState().isStreaming('answer')).toBe(true)
  })

  it('跨工作区收到的保存结果仍生效，保存失败保留原偏好', async () => {
    let resolve!: (snapshot: LocaleSnapshot) => void
    const pending = new Promise<LocaleSnapshot>((done) => {
      resolve = done
    })
    const command = vi
      .fn()
      .mockReturnValueOnce(pending)
      .mockRejectedValueOnce(new Error('Disk full'))
    vi.stubGlobal('window', { runtime: { command } })
    const save = useLocaleStore.getState().setPreference('en-US')
    expect(useLocaleStore.getState().saving).toBe(true)
    useSessionStore
      .getState()
      .setSession({ scopeId: 'new', accountId: 'a', workspaceId: 'w', workspacePath: '/w' })
    resolve({ ...chinese, preference: 'en-US', language: 'en-US', revision: 1 })
    await save
    expect(rendererI18n.language).toBe('en-US')
    await expect(useLocaleStore.getState().setPreference('zh-CN')).rejects.toThrow('Disk full')
    expect(useLocaleStore.getState()).toMatchObject({
      saving: false,
      snapshot: { preference: 'en-US' }
    })
    vi.unstubAllGlobals()
  })
})
