import { describe, expect, it } from 'vitest'
import { isNewerVersion } from './version'

describe('版本比较', () => {
  it('构建元数据被忽略（严格 semver）', () => {
    expect(isNewerVersion('1.0.0+build', '1.0.0')).toBe(false)
    expect(isNewerVersion('1.0.0', '1.0.0+build')).toBe(false)
    expect(isNewerVersion('1.0.0-alpha+build', '1.0.0-alpha')).toBe(false)
    expect(isNewerVersion('2.0.0-preview.1+build.7', '2.0.0-preview.1')).toBe(false)
  })

  it('预发布序列按 semver 排序', () => {
    const sequence = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0'
    ]

    for (let index = 1; index < sequence.length; index++) {
      expect(isNewerVersion(sequence[index], sequence[index - 1])).toBe(true)
      expect(isNewerVersion(sequence[index - 1], sequence[index])).toBe(false)
    }
  })

  it('接受 v 前缀，大小版本按段比较', () => {
    expect(isNewerVersion('v2.1.0', '2.0.9')).toBe(true)
    expect(isNewerVersion('2.10.0', '2.9.0')).toBe(true)
  })

  it('无法解析时返回 false', () => {
    expect(isNewerVersion('not-a-version', '1.0.0')).toBe(false)
    expect(isNewerVersion('1.0.0', 'bad')).toBe(false)
  })
})
