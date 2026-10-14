import { create } from 'zustand'
import type { ActivityPanel, LayoutState } from '@shared/contracts'
import { useViewStateStore } from './viewStateStore'

export type { ActivityPanel, LayoutState }

// 紧凑模式阈值
const COMPACT_MODE_THRESHOLD = 768

interface LayoutStateInternal extends LayoutState {
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

type LayoutStore = LayoutStateInternal & LayoutActions

const initialState: LayoutStateInternal = {
  sidebarWidth: 260,
  sidebarVisible: true,
  activePanel: 'explorer',
  minSidebarWidth: 200,
  maxSidebarWidth: 500,
  initialized: false,
  isCompactMode: typeof window === 'undefined' ? false : window.innerWidth < COMPACT_MODE_THRESHOLD
}

const validActivePanels: ActivityPanel[] = ['explorer', 'search', 'favorites']

const persist = (state: LayoutStateInternal): void => {
  useViewStateStore.getState().patch({
    layout: {
      sidebarWidth: state.sidebarWidth,
      sidebarVisible: state.sidebarVisible,
      activePanel: state.activePanel
    }
  })
}

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  ...initialState,

  init: async () => {
    const layout = useViewStateStore.getState().viewState.layout
    const activePanel =
      layout && validActivePanels.includes(layout.activePanel)
        ? layout.activePanel
        : initialState.activePanel
    set({
      ...layout,
      activePanel,
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
