/**
 * Store 初始化
 * 在应用启动时调用，初始化 Store 注册表
 */

import { initStoreRegistry } from './registry'
import { getPageStoreInterface } from './pagesStore'
import { getFolderStoreInterface } from './foldersStore'
import { getMessageStoreInterface } from './messagesStore'
import { getAccountStoreInterface } from './accountStore'
import { getLayoutStoreInterface } from './layoutStore'
import { getTabStoreInterface } from './tabsStore'
import { getSettingsStoreInterface } from './settingsStore'
import { getNavigationStoreInterface } from './navigationStore'
import { getWorkspaceStoreInterface } from './workspaceStore'

/**
 * 初始化所有 Store
 * 必须在应用启动时调用一次
 */
export function initStores(): void {
  initStoreRegistry({
    page: getPageStoreInterface(),
    folder: getFolderStoreInterface(),
    message: getMessageStoreInterface(),
    account: getAccountStoreInterface(),
    layout: getLayoutStoreInterface(),
    tab: getTabStoreInterface(),
    settings: getSettingsStoreInterface(),
    navigation: getNavigationStoreInterface(),
    workspace: getWorkspaceStoreInterface()
  })
}
