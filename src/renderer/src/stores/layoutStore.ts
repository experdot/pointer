import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createIndexedDBStorage } from '../utils/indexedDB'
import { registerStoreReset } from '../utils/storeRegistry'

// 活动栏面板类型
export type ActivityPanel = 'explorer' | 'search' | 'favorites' | 'tasks'

interface LayoutState {
  // 侧边栏
  sidebarWidth: number
  sidebarVisible: boolean
  activePanel: ActivityPanel

  // 侧边栏宽度限制
  minSidebarWidth: number
  maxSidebarWidth: number
}

interface LayoutActions {
  setSidebarWidth: (width: number) => void
  setSidebarVisible: (visible: boolean) => void
  toggleSidebar: () => void
  setActivePanel: (panel: ActivityPanel) => void
  reset: () => void
}

type LayoutStore = LayoutState & LayoutActions

const initialState: LayoutState = {
  sidebarWidth: 260,
  sidebarVisible: true,
  activePanel: 'explorer',
  minSidebarWidth: 200,
  maxSidebarWidth: 500
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setSidebarWidth: (width) => {
        const { minSidebarWidth, maxSidebarWidth } = get()
        const clampedWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, width))
        set({ sidebarWidth: clampedWidth })
      },

      setSidebarVisible: (visible) => set({ sidebarVisible: visible }),

      toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),

      setActivePanel: (panel) => {
        const { activePanel, sidebarVisible } = get()
        if (panel === activePanel && sidebarVisible) {
          // 点击当前激活的面板，切换侧边栏显示
          set({ sidebarVisible: false })
        } else {
          set({ activePanel: panel, sidebarVisible: true })
        }
      },

      reset: () => set(initialState)
    }),
    {
      name: 'layout-store',
      storage: createIndexedDBStorage(),
      skipHydration: true, // 延迟加载，等待数据库名设置
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        sidebarVisible: state.sidebarVisible,
        activePanel: state.activePanel
      })
    }
  )
)

// 注册重置回调
registerStoreReset(
  () => useLayoutStore.getState().reset(),
  () => useLayoutStore.persist.rehydrate()
)
