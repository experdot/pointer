import { fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shouldIgnoreAppShortcuts, shouldIgnoreChatReadingShortcuts } from './shortcutGuards'
import {
  dispatchAppShortcutAction,
  dispatchForwardedShortcutAction
} from '../services/shortcutService'
import * as pagesService from '../services/pagesService'
import { useTabsStore } from '../stores/tabsStore'

vi.mock('../services/pagesService', () => ({
  createPage: vi.fn(async () => ({ id: 'new' })),
  openPage: vi.fn()
}))
vi.mock('../runtime/client', () => ({ command: vi.fn(async () => undefined), query: vi.fn() }))
afterEach(() => {
  document.body.replaceChildren()
  vi.clearAllMocks()
})
describe('键盘焦点与全局/阅读快捷键', () => {
  it.each(['input', 'textarea', 'button', '[contenteditable]', '.search-bar'])(
    '阅读快捷键不会抢占 %s 的输入',
    (selector) => {
      const element = document.createElement(
        selector.startsWith('[') || selector.startsWith('.') ? 'div' : selector
      )
      if (selector === '[contenteditable]') element.setAttribute('contenteditable', 'true')
      if (selector === '.search-bar') element.className = 'search-bar'
      document.body.append(element)
      element.addEventListener('keydown', (event) =>
        expect(shouldIgnoreChatReadingShortcuts(event)).toBe(true)
      )
      fireEvent.keyDown(element, { key: 'ArrowDown' })
    }
  )
  it('Monaco、模态框和 IME 不触发新建聊天，正常全局动作可从普通输入框执行', async () => {
    const input = document.createElement('input')
    const wrapper = document.createElement('div')
    wrapper.append(input)
    document.body.append(wrapper)
    input.focus()
    wrapper.className = 'monaco-editor'
    await dispatchAppShortcutAction('new-chat')
    wrapper.className = ''
    wrapper.setAttribute('role', 'dialog')
    await dispatchAppShortcutAction('new-chat')
    wrapper.removeAttribute('role')
    await dispatchAppShortcutAction('new-chat', new KeyboardEvent('keydown', { isComposing: true }))
    expect(pagesService.createPage).not.toHaveBeenCalled()
    expect(shouldIgnoreAppShortcuts(new KeyboardEvent('keydown', { keyCode: 229 }))).toBe(true)
    await dispatchAppShortcutAction('new-chat')
    expect(pagesService.openPage).toHaveBeenCalledWith('new')
  })
  it('主进程转发的关闭动作尊重不可关闭标签及模态遮罩', async () => {
    const close = vi.spyOn(useTabsStore.getState(), 'closeTab')
    useTabsStore.setState({
      tabs: [{ id: 'x', type: 'settings', title: 'x', closable: false }],
      activeTabId: 'x'
    })
    await dispatchForwardedShortcutAction('close-tab')
    expect(close).not.toHaveBeenCalled()
    useTabsStore.setState({ tabs: [{ id: 'x', type: 'settings', title: 'x', closable: true }] })
    const overlay = document.createElement('div')
    overlay.dataset.shortcutBlockingOverlay = 'true'
    document.body.append(overlay)
    await dispatchForwardedShortcutAction('close-tab')
    expect(close).not.toHaveBeenCalled()
    overlay.remove()
    await dispatchForwardedShortcutAction('close-tab')
    expect(close).toHaveBeenCalledWith('x')
  })
})
