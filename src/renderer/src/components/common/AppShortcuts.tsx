import { useEffect } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import {
  dispatchAppShortcutAction,
  dispatchForwardedShortcutAction
} from '../../services/shortcutService'
import { isMonacoFocused, shouldIgnoreAppShortcuts } from '../../utils/shortcutGuards'

const appShortcutOptions = {
  enableOnFormTags: true as const,
  enableOnContentEditable: true,
  preventDefault: (event: KeyboardEvent) => !isMonacoFocused(event)
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

  useEffect(() => {
    return window.api.shortcuts.onAction((action) => {
      void dispatchForwardedShortcutAction(action)
    })
  }, [])

  return null
}
