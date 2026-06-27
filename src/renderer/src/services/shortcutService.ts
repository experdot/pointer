import type { ForwardedShortcutAction } from '../../../shared/shortcuts'
import { useLayoutStore } from '../stores/layoutStore'
import { useGlobalSearchStore } from '../stores/globalSearchStore'
import { useTabsStore } from '../stores/tabsStore'
import * as pagesService from './pagesService'
import { shouldIgnoreAppShortcuts } from '../utils/shortcutGuards'
import { getSearchPrefillSelection } from '../utils/searchSelection'

export type AppShortcutAction =
  | ForwardedShortcutAction
  | 'new-chat'
  | 'toggle-sidebar'
  | 'global-search'

function closeActiveTab(): void {
  const { tabs, activeTabId, closeTab } = useTabsStore.getState()
  const activeTab = tabs.find((tab) => tab.id === activeTabId)

  if (!activeTab || activeTab.closable === false) {
    return
  }

  closeTab(activeTab.id)
}

export async function dispatchAppShortcutAction(
  action: AppShortcutAction,
  event?: KeyboardEvent | null
): Promise<void> {
  if (shouldIgnoreAppShortcuts(event)) {
    return
  }

  switch (action) {
    case 'close-tab':
      closeActiveTab()
      break
    case 'next-tab':
      useTabsStore.getState().activateNextTab()
      break
    case 'prev-tab':
      useTabsStore.getState().activatePrevTab()
      break
    case 'new-chat': {
      const page = await pagesService.createPage()
      await pagesService.openPage(page.id)
      break
    }
    case 'toggle-sidebar':
      useLayoutStore.getState().toggleSidebar()
      break
    case 'global-search': {
      const selectedText = getSearchPrefillSelection()
      const globalSearchStore = useGlobalSearchStore.getState()

      if (selectedText) {
        globalSearchStore.setQuery(selectedText)
      }

      useLayoutStore.getState().revealPanel('search')
      globalSearchStore.requestFocus()

      if (selectedText) {
        globalSearchStore.triggerSearch()
      }
      break
    }
  }
}

export async function dispatchForwardedShortcutAction(
  action: ForwardedShortcutAction
): Promise<void> {
  await dispatchAppShortcutAction(action)
}
