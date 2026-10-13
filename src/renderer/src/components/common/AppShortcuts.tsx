import { useEffect } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import {
  dispatchAppShortcutAction,
  dispatchForwardedShortcutAction,
  type AppShortcutAction
} from '../../services/shortcutService'
import { isLinuxPlatform, isMacPlatform, isWindowsPlatform } from '../../utils/shortcutPresentation'
import { isMonacoFocused, shouldIgnoreAppShortcuts } from '../../utils/shortcutGuards'

// 与 VS Code 默认键位保持一致：Windows/Linux 走 win/linux 绑定，macOS 走 mac 绑定
const IS_MAC = isMacPlatform()
const IS_WINDOWS = isWindowsPlatform()
const IS_LINUX = isLinuxPlatform()

const appShortcutOptions = {
  enableOnFormTags: true as const,
  enableOnContentEditable: true,
  preventDefault: (event: KeyboardEvent) => !isMonacoFocused(event)
}

function createShortcutHandler(action: AppShortcutAction) {
  return (event: KeyboardEvent): void => {
    if (shouldIgnoreAppShortcuts(event)) {
      return
    }

    void dispatchAppShortcutAction(action, event)
  }
}

export function AppShortcuts(): null {
  useHotkeys('mod+n', createShortcutHandler('new-chat'), appShortcutOptions, [])
  useHotkeys('mod+b', createShortcutHandler('toggle-sidebar'), appShortcutOptions, [])
  useHotkeys('mod+shift+f', createShortcutHandler('global-search'), appShortcutOptions, [])

  // 会话历史导航（与 VS Code 一致）：
  // Windows Alt+←/→；macOS Ctrl+- / Ctrl+Shift+-；Linux Ctrl+Alt+- / Ctrl+Shift+-
  useHotkeys(
    'alt+arrowleft',
    createShortcutHandler('history-back'),
    {
      ...appShortcutOptions,
      enabled: IS_WINDOWS
    },
    []
  )
  useHotkeys(
    'alt+arrowright',
    createShortcutHandler('history-forward'),
    {
      ...appShortcutOptions,
      enabled: IS_WINDOWS
    },
    []
  )
  useHotkeys(
    'ctrl+minus',
    createShortcutHandler('history-back'),
    {
      ...appShortcutOptions,
      enabled: IS_MAC
    },
    []
  )
  useHotkeys(
    'ctrl+shift+minus',
    createShortcutHandler('history-forward'),
    {
      ...appShortcutOptions,
      enabled: IS_MAC || IS_LINUX
    },
    []
  )
  useHotkeys(
    'ctrl+alt+minus',
    createShortcutHandler('history-back'),
    {
      ...appShortcutOptions,
      enabled: IS_LINUX
    },
    []
  )

  // 切换标签页（VS Code 的 Open Next/Previous Editor）：
  // Windows/Linux Ctrl+PageDown/PageUp；macOS Cmd+Alt+→/←（备用 Cmd+Shift+]/[）
  useHotkeys(
    'ctrl+pagedown',
    createShortcutHandler('next-tab'),
    {
      ...appShortcutOptions,
      enabled: !IS_MAC
    },
    []
  )
  useHotkeys(
    'ctrl+pageup',
    createShortcutHandler('prev-tab'),
    {
      ...appShortcutOptions,
      enabled: !IS_MAC
    },
    []
  )
  useHotkeys(
    'mod+alt+arrowright',
    createShortcutHandler('next-tab'),
    {
      ...appShortcutOptions,
      enabled: IS_MAC
    },
    []
  )
  useHotkeys(
    'mod+alt+arrowleft',
    createShortcutHandler('prev-tab'),
    {
      ...appShortcutOptions,
      enabled: IS_MAC
    },
    []
  )
  useHotkeys(
    'mod+shift+bracketright',
    createShortcutHandler('next-tab'),
    {
      ...appShortcutOptions,
      enabled: IS_MAC
    },
    []
  )
  useHotkeys(
    'mod+shift+bracketleft',
    createShortcutHandler('prev-tab'),
    {
      ...appShortcutOptions,
      enabled: IS_MAC
    },
    []
  )

  useEffect(() => {
    return window.api.shortcuts.onAction((action) => {
      void dispatchForwardedShortcutAction(action)
    })
  }, [])

  return null
}
