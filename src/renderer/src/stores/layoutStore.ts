import { create } from 'zustand'
import { persistence } from '../persistence/registry'
import type { ActivityPanel, LayoutRecord } from '../persistence/interfaces/userData'
import type { ILayoutStore } from './interfaces/ui'

export type { ActivityPanel } from '../persistence/interfaces/userData'

// 紧凑模式阈值
const COMPACT_MODE_THRESHOLD = 768

interface LayoutState extends LayoutRecord {
  minSidebarWidth: number
  maxSidebarWidth: number
  initialized: boolean
  isCompactMode: boolean
}

interface LayoutActions {
  init: () => Promise<void>
  setSidebarWidth: (width: number) => void
  setSidebarVisible: (visible: boolean) => void
  toggleSidebar: () => void
  setActivePanel: (panel: ActivityPanel) => void
  revealPanel: (panel: ActivityPanel) => void
  setCompactMode: (isCompact: boolean) => void
  reset: () => Promise<void>
}

type LayoutStore = LayoutState & LayoutActions

const initialState: LayoutState = {
  sidebarWidth: 260,
  sidebarVisible: true,
  activePanel: 'explorer',
  minSidebarWidth: 200,
  maxSidebarWidth: 500,
  initialized: false,
  isCompactMode: window.innerWidth < COMPACT_MODE_THRESHOLD
}

const persist = (state: LayoutState): void => {
  persistence.layout.put({
    sidebarWidth: state.sidebarWidth,
    sidebarVisible: state.sidebarVisible,
    activePanel: state.activePanel
  })
}

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  ...initialState,

  init: async () => {
    const layout = await persistence.layout.get()
    set({
      ...(layout ?? {}),
      initialized: true
    })
  },

  setSidebarWidth: (width) => {
    const state = get()
    const clampedWidth = Math.max(state.minSidebarWidth, Math.min(state.maxSidebarWidth, width))
    set({ sidebarWidth: clampedWidth })
    persist({ ...state, sidebarWidth: clampedWidth })
  },

  setSidebarVisible: (visible) => {
    const state = get()
    set({ sidebarVisible: visible })
    persist({ ...state, sidebarVisible: visible })
  },

  toggleSidebar: () => {
    const state = get()
    const visible = !state.sidebarVisible
    set({ sidebarVisible: visible })
    persist({ ...state, sidebarVisible: visible })
  },

  setActivePanel: (panel) => {
    const state = get()
    if (panel === state.activePanel && state.sidebarVisible) {
      set({ sidebarVisible: false })
      persist({ ...state, sidebarVisible: false })
    } else {
      set({ activePanel: panel, sidebarVisible: true })
      persist({ ...state, activePanel: panel, sidebarVisible: true })
    }
  },

  revealPanel: (panel) => {
    const state = get()
    // 强制显示指定面板，不触发 toggle 行为
    if (panel !== state.activePanel || !state.sidebarVisible) {
      set({ activePanel: panel, sidebarVisible: true })
      persist({ ...state, activePanel: panel, sidebarVisible: true })
    }
  },

  setCompactMode: (isCompact) => set({ isCompactMode: isCompact }),

  reset: async () => {
    // Only reset memory state, don't clear persistence data
    set(initialState)
  }
}))

/**
 * 获取布局 Store 的接口实现
 */
export function getLayoutStoreInterface(): ILayoutStore {
  const store = useLayoutStore
  return {
    get initialized() {
      return store.getState().initialized
    },
    get sidebarWidth() {
      return store.getState().sidebarWidth
    },
    get sidebarVisible() {
      return store.getState().sidebarVisible
    },
    get activePanel() {
      return store.getState().activePanel
    },
    get isCompactMode() {
      return store.getState().isCompactMode
    },
    get minSidebarWidth() {
      return store.getState().minSidebarWidth
    },
    get maxSidebarWidth() {
      return store.getState().maxSidebarWidth
    },
    init: () => store.getState().init(),
    reset: () => store.getState().reset(),
    setSidebarWidth: (width) => store.getState().setSidebarWidth(width),
    setSidebarVisible: (visible) => store.getState().setSidebarVisible(visible),
    toggleSidebar: () => store.getState().toggleSidebar(),
    setActivePanel: (panel) => store.getState().setActivePanel(panel),
    revealPanel: (panel) => store.getState().revealPanel(panel),
    setCompactMode: (isCompact) => store.getState().setCompactMode(isCompact)
  }
}
