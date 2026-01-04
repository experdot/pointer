import { create } from 'zustand'
import * as db from '../utils/database'
import type { ActivityPanel, LayoutRecord } from '../utils/database'

export type { ActivityPanel } from '../utils/database'

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
  db.putLayout({
    sidebarWidth: state.sidebarWidth,
    sidebarVisible: state.sidebarVisible,
    activePanel: state.activePanel
  })
}

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  ...initialState,

  init: async () => {
    const layout = await db.getLayout()
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

  setCompactMode: (isCompact) => set({ isCompactMode: isCompact }),

  reset: async () => {
    await db.clearLayout()
    set(initialState)
  }
}))
