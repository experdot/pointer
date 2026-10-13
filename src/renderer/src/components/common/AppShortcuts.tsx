import { useEffect } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import {
  dispatchAppShortcutAction,
  dispatchForwardedShortcutAction
} from '../../services/shortcutService'
import {
  isMonacoFocused,
  isTextEditingTarget,
  shouldIgnoreAppShortcuts
} from '../../utils/shortcutGuards'
import { isMacPlatform } from '../../utils/shortcutPresentation'

const appShortcutOptions = {
  enableOnFormTags: true as const,
  enableOnContentEditable: true,
  preventDefault: (event: KeyboardEvent) => !isMonacoFocused(event)
}

// macOS 上 Option+←/→ 是文本内的按词移动，编辑文本时不拦截，交给系统处理
const historyShortcutOptions = {
  enableOnFormTags: true as const,
  enableOnContentEditable: true,
  preventDefault: (event: KeyboardEvent) =>
    !isMonacoFocused(event) && !(isMacPlatform() && isTextEditingTarget(event))
}

function shouldIgnoreHistoryShortcut(event: KeyboardEvent): boolean {
  return shouldIgnoreAppShortcuts(event) || (isMacPlatform() && isTextEditingTarget(event))
}

export function AppShortcuts(): null {
  useHotkeys(
    'mod+n',
    (event) => {
      if (shouldIgnoreAppShortcuts(event)) {
        return
      }

      void dispatchAppShortcutAction('new-chat', event)
    },
    appShortcutOptions,
    []
  )

  useHotkeys(
    'mod+b',
    (event) => {
      if (shouldIgnoreAppShortcuts(event)) {
        return
      }

      void dispatchAppShortcutAction('toggle-sidebar', event)
    },
    appShortcutOptions,
    []
  )

  useHotkeys(
    'mod+shift+f',
    (event) => {
      if (shouldIgnoreAppShortcuts(event)) {
        return
      }

      void dispatchAppShortcutAction('global-search', event)
    },
    appShortcutOptions,
    []
  )

  useHotkeys(
    'alt+arrowleft',
    (event) => {
      if (shouldIgnoreHistoryShortcut(event)) {
        return
      }

      void dispatchAppShortcutAction('history-back', event)
    },
    historyShortcutOptions,
    []
  )

  useHotkeys(
    'alt+arrowright',
    (event) => {
      if (shouldIgnoreHistoryShortcut(event)) {
        return
      }

      void dispatchAppShortcutAction('history-forward', event)
    },
    historyShortcutOptions,
    []
  )

  useEffect(() => {
    return window.api.shortcuts.onAction((action) => {
      void dispatchForwardedShortcutAction(action)
    })
  }, [])

  return null
}
