/**
 * Store 接口统一导出
 */

// 基础接口
export type { IInitializable, IResettable, IEntityStore, ICachedStore } from './base'

// 实体接口
export type {
  IPageStore,
  IFolderStore,
  IMessageStore,
  IAccountStore,
  PageCreateDTO,
  FolderCreateDTO,
  AccountCreateDTO
} from './entities'

// UI 接口
export type { ILayoutStore, ITabStore, ISettingsStore } from './ui'

// 导航接口
export type { INavigationStore, NavigationRequest, RelativeNavigationRequest } from './navigation'

/**
 * Store 注册表接口
 * 包含所有 Store 的统一访问入口
 */
export interface IStoreRegistry {
  readonly page: import('./entities').IPageStore
  readonly folder: import('./entities').IFolderStore
  readonly message: import('./entities').IMessageStore
  readonly account: import('./entities').IAccountStore
  readonly layout: import('./ui').ILayoutStore
  readonly tab: import('./ui').ITabStore
  readonly settings: import('./ui').ISettingsStore
  readonly navigation: import('./navigation').INavigationStore
}
