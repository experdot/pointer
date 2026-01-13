/**
 * 导航 Store
 * 管理消息导航状态，从 messagesStore 拆分
 */

import { create } from 'zustand'
import type {
  INavigationStore,
  NavigationRequest,
  RelativeNavigationRequest
} from './interfaces/navigation'

interface NavigationState {
  pendingNavigation: NavigationRequest | null
  pendingRelativeNavigation: RelativeNavigationRequest | null
}

type NavigationStore = NavigationState & INavigationStore

const initialState: NavigationState = {
  pendingNavigation: null,
  pendingRelativeNavigation: null
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  ...initialState,

  requestNavigation: (request) => {
    set({ pendingNavigation: request })
  },

  requestRelativeNavigation: (request) => {
    set({ pendingRelativeNavigation: request })
  },

  clearNavigation: (version) => {
    set((state) => {
      if (state.pendingNavigation?.version === version) {
        return { pendingNavigation: null }
      }
      return state
    })
  },

  clearRelativeNavigation: (version) => {
    set((state) => {
      if (state.pendingRelativeNavigation?.version === version) {
        return { pendingRelativeNavigation: null }
      }
      return state
    })
  }
}))

/**
 * 获取导航 Store 的接口实现
 */
export function getNavigationStoreInterface(): INavigationStore {
  const store = useNavigationStore
  return {
    get pendingNavigation() {
      return store.getState().pendingNavigation
    },
    get pendingRelativeNavigation() {
      return store.getState().pendingRelativeNavigation
    },
    requestNavigation: (request) => store.getState().requestNavigation(request),
    requestRelativeNavigation: (request) => store.getState().requestRelativeNavigation(request),
    clearNavigation: (version) => store.getState().clearNavigation(version),
    clearRelativeNavigation: (version) => store.getState().clearRelativeNavigation(version)
  }
}
