import { useHotkeys } from 'react-hotkeys-hook'
import { shouldIgnoreAppShortcuts, shouldIgnoreChatReadingShortcuts } from '../utils/shortcutGuards'
import { getSearchPrefillSelection } from '../utils/searchSelection'

interface UseChatShortcutsOptions {
  enabled: boolean
  navigationEnabled: boolean
  onOpenSearch: (selectedText: string | null) => void
  onScrollToPrev: () => void
  onScrollToNext: () => void
  onScrollToFirst: () => void
  onScrollToLast: () => void
}

export function useChatShortcuts({
  enabled,
  navigationEnabled,
  onOpenSearch,
  onScrollToPrev,
  onScrollToNext,
  onScrollToFirst,
  onScrollToLast
}: UseChatShortcutsOptions): void {
  useHotkeys(
    'mod+f',
    (event) => {
      if (shouldIgnoreAppShortcuts(event)) {
        return
      }

      onOpenSearch(getSearchPrefillSelection())
    },
    {
      enabled,
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true
    },
    [enabled, onOpenSearch]
  )

  useHotkeys(
    'space',
    (event) => {
      event.preventDefault()
      onScrollToNext()
    },
    {
      enabled: navigationEnabled,
      ignoreEventWhen: shouldIgnoreChatReadingShortcuts,
      preventDefault: true
    },
    [navigationEnabled, onScrollToNext]
  )

  useHotkeys(
    'shift+space',
    (event) => {
      event.preventDefault()
      onScrollToPrev()
    },
    {
      enabled: navigationEnabled,
      ignoreEventWhen: shouldIgnoreChatReadingShortcuts,
      preventDefault: true
    },
    [navigationEnabled, onScrollToPrev]
  )

  useHotkeys(
    'home',
    (event) => {
      event.preventDefault()
      onScrollToFirst()
    },
    {
      enabled: navigationEnabled,
      ignoreEventWhen: shouldIgnoreChatReadingShortcuts,
      preventDefault: true
    },
    [navigationEnabled, onScrollToFirst]
  )

  useHotkeys(
    'end',
    (event) => {
      event.preventDefault()
      onScrollToLast()
    },
    {
      enabled: navigationEnabled,
      ignoreEventWhen: shouldIgnoreChatReadingShortcuts,
      preventDefault: true
    },
    [navigationEnabled, onScrollToLast]
  )
}
