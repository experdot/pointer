import { create } from 'zustand'
import * as db from '../utils/database'
import type { ActivityPanel, LayoutRecord } from '../utils/database'

export type { ActivityPanel } from '../utils/database'

interface LayoutState extends LayoutRecord {
  minSidebarWidth: number
  maxSidebarWidth: number
  initialized: boolean
}

interface LayoutActions {
  init: () => Promise<void>
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
  maxSidebarWidth: 500,
  initialized: false
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

  reset: () => set(initialState)
}))
