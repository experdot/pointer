import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'
import { createI18n } from '@shared/i18n'
import { installApplicationMenu } from './applicationMenu'

const mocks = vi.hoisted(() => ({ build: vi.fn(), install: vi.fn() }))
vi.mock('electron', () => ({
  Menu: { buildFromTemplate: mocks.build, setApplicationMenu: mocks.install },
  shell: { openExternal: vi.fn() }
}))

beforeEach(() => vi.clearAllMocks())

function flatten(items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.flatMap((item) => [
    item,
    ...(Array.isArray(item.submenu) ? flatten(item.submenu) : [])
  ])
}

describe('应用原生菜单', () => {
  it.each(['win32', 'linux', 'darwin'] as const)(
    '%s 菜单按语言重建，编辑和窗口操作保留原生 role',
    async (platform) => {
      const { instance, t } = createI18n('zh-CN')
      installApplicationMenu(t, platform)
      const chinese = flatten(mocks.build.mock.calls[0][0])
      expect(chinese).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'editMenu', label: '编辑' }),
          expect.objectContaining({ role: 'copy', label: '复制' }),
          expect.objectContaining({ role: 'undo', label: '撤销' }),
          expect.objectContaining({ role: 'quit', label: '退出 Pointer' })
        ])
      )
      await instance.changeLanguage('en-US')
      installApplicationMenu(t, platform)
      const english = flatten(mocks.build.mock.calls[1][0])
      expect(english).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'editMenu', label: 'Edit' }),
          expect.objectContaining({ role: 'copy', label: 'Copy' }),
          expect.objectContaining({ role: 'undo', label: 'Undo' })
        ])
      )
      expect(english.map((item) => item.label).join('')).not.toMatch(/\p{Script=Han}/u)
      expect(english.map((item) => item.role)).toEqual(chinese.map((item) => item.role))
      expect(english.some((item) => item.role === 'appMenu')).toBe(platform === 'darwin')
      expect(mocks.install).toHaveBeenCalledTimes(2)
    }
  )
})
