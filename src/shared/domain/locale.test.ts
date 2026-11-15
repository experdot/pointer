import { describe, expect, it } from 'vitest'
import { isLanguagePreference, resolveLanguage } from './locale'
import { isDefaultPageName } from './naming'
import { buildLocalizedTitlePrompt } from './titlePrompts'

describe('界面语言解析', () => {
  it.each([
    [['zh-CN'], 'zh-CN'],
    [['zh-Hant-TW'], 'zh-CN'],
    [['zh_Hans_SG'], 'zh-CN'],
    [['en-GB'], 'en-US'],
    [['fr-FR', 'zh-CN', 'en-US'], 'zh-CN'],
    [['de-DE', 'en-AU', 'zh-CN'], 'en-US'],
    [['ja-JP'], 'en-US'],
    [[], 'en-US']
  ])('按系统优先级解析 %j', (languages, expected) => {
    expect(resolveLanguage('system', languages)).toBe(expected)
  })

  it('手动选择优先于系统，非法值不能进入偏好', () => {
    expect(resolveLanguage('en-US', ['zh-CN'])).toBe('en-US')
    expect(resolveLanguage('zh-CN', ['en-US'])).toBe('zh-CN')
    expect(isLanguagePreference('system')).toBe(true)
    expect(isLanguagePreference('zh-TW')).toBe(false)
    expect(isLanguagePreference(undefined)).toBe(false)
  })

  it('切换后仍识别两种语言创建的默认会话名', () => {
    for (const name of ['新对话', '新对话 (2)', 'New conversation', 'New conversation (2)'])
      expect(isDefaultPageName(name)).toBe(true)
    expect(isDefaultPageName('My new conversation')).toBe(false)
  })

  it.each(['message', 'topic', 'session', 'segmentation'] as const)(
    '%s 模板独立组合英文要求，内容与额外要求按字面量保留',
    (kind) => {
      const content = '中文对话 $& $1'
      const extra = "Keep $& and $' literal"
      const prompt = buildLocalizedTitlePrompt(kind, 'en-US', content, extra)
      expect(prompt).toContain(content)
      expect(prompt).toContain(extra)
      expect(prompt).toContain('predominant language of the conversation')
      expect(prompt).toContain('Additional requirements:')
      expect(prompt).not.toContain('{content}')
      expect(prompt).not.toContain('额外要求')
    }
  )
})
