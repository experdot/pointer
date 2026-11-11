import { beforeEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from './clipboard'

const write = vi.fn()
const fallback = vi.fn()
beforeEach(() => {
  write.mockReset()
  fallback.mockReset()
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } })
  Object.defineProperty(document, 'execCommand', { configurable: true, value: fallback })
})

describe('剪贴板权限与兼容回退', () => {
  it('优先原生 API 并保持完整 Unicode 文本', async () => {
    write.mockResolvedValue(undefined)
    expect(await copyToClipboard('中文🧪\n$1')).toBe(true)
    expect(write).toHaveBeenCalledWith('中文🧪\n$1')
    expect(fallback).not.toHaveBeenCalled()
  })
  it.each([true, false, 'throw'] as const)(
    '原生拒绝后回退结果 %s，清理临时节点且恢复焦点',
    async (result) => {
      write.mockRejectedValue(new Error('未授权'))
      fallback.mockImplementation(() => {
        if (result === 'throw') throw new Error('不支持')
        return result
      })
      const button = document.createElement('button')
      document.body.append(button)
      button.focus()
      try {
        expect(await copyToClipboard('keep')).toBe(result === true)
        expect(document.querySelector('textarea')).toBeNull()
        expect(document.activeElement).toBe(button)
      } finally {
        button.remove()
      }
    }
  )
})
