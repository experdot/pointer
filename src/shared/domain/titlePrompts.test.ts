import { describe, expect, it } from 'vitest'
import {
  MESSAGE_TITLE_PROMPT,
  SESSION_TITLE_PROMPT,
  TOPIC_SEGMENTATION_PROMPT,
  TOPIC_TITLE_PROMPT,
  applyExtraRequirements,
  applySegmentationRequirements,
  buildPrompt,
  normalizeTitle
} from './titlePrompts'

describe('额外要求注入', () => {
  it('标题类提示词把额外要求插在输出锚点之前', () => {
    const prompt = buildPrompt(MESSAGE_TITLE_PROMPT, '内容')
    const withExtra = applyExtraRequirements(prompt, '使用英文')

    expect(withExtra).toContain('额外要求：使用英文')
    expect(withExtra.indexOf('额外要求：使用英文')).toBeLessThan(withExtra.indexOf('标题：'))
    expect(withExtra.trimEnd().endsWith('标题：')).toBe(true)
  })

  it('话题提示词使用"话题名称："锚点', () => {
    const prompt = applyExtraRequirements(buildPrompt(TOPIC_TITLE_PROMPT, '内容'), '突出关键词')

    expect(prompt).toContain('额外要求：突出关键词')
    expect(prompt.trimEnd().endsWith('话题名称：')).toBe(true)
  })

  it('空白的额外要求不改变提示词', () => {
    const prompt = buildPrompt(SESSION_TITLE_PROMPT, '内容')

    expect(applyExtraRequirements(prompt, '   ')).toBe(prompt)
    expect(applyExtraRequirements(prompt, undefined)).toBe(prompt)
  })

  it('智能分段把额外要求追加为第 5 条注意项', () => {
    const prompt = applySegmentationRequirements(
      buildPrompt(TOPIC_SEGMENTATION_PROMPT, '0. 用户：你好'),
      '更细粒度分段'
    )

    expect(prompt).toContain('5. 额外要求：更细粒度分段')
  })

  it('内容与额外要求中的 $ 模式按字面量处理', () => {
    const content = "价格 $& 与 $1 与 $' 结尾"
    const prompt = buildPrompt(MESSAGE_TITLE_PROMPT, content)

    expect(prompt).toContain(content)

    const withExtra = applyExtraRequirements(prompt, "使用 $& 和 $' 强调")
    expect(withExtra).toContain("额外要求：使用 $& 和 $' 强调")
    expect(withExtra.trimEnd().endsWith('标题：')).toBe(true)
  })

  it('分段额外要求同样按字面量处理 $ 模式', () => {
    const prompt = applySegmentationRequirements(
      buildPrompt(TOPIC_SEGMENTATION_PROMPT, '0. 用户：你好'),
      '注意 $& 与 $1'
    )

    expect(prompt).toContain('5. 额外要求：注意 $& 与 $1')
  })
})

describe('标题清理与长度', () => {
  it('取首个非空行并去除包裹引号', () => {
    expect(normalizeTitle('「分层设计」\n多余说明')).toBe('分层设计')
    expect(normalizeTitle('"引用标题"')).toBe('引用标题')
  })

  it('按指定长度截断（消息/话题 15 字，会话 20 字）', () => {
    const long = '很'.repeat(30)

    expect(normalizeTitle(long, 15)).toHaveLength(15)
    expect(normalizeTitle(long, 20)).toHaveLength(20)
  })
})
