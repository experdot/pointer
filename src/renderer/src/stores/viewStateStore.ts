/**
 * 展示层状态（持久化于工作区）
 *
 * 内核把它当作不透明文档保存，这里负责与内存状态保持同步。
 */

import { create } from 'zustand'
import type { ViewState } from '@shared/contracts'
import { defaultViewState } from '@shared/contracts'
import { command } from '../runtime/client'

interface ViewStateStore {
  viewState: ViewState
  initialized: boolean
  setViewState: (state: ViewState) => void
  /** 局部更新并持久化 */
  patch: (patch: Partial<ViewState>) => void
  reset: () => void
}

export const useViewStateStore = create<ViewStateStore>((set, get) => ({
  viewState: defaultViewState(),
  initialized: false,

  setViewState: (state) => set({ viewState: state, initialized: true }),

  patch: (patch) => {
    const next: ViewState = { ...get().viewState, ...patch }
    set({ viewState: next })
    void command('viewState.replace', { viewState: next }).catch((error) => {
      console.warn('[view-state] 保存失败：', error)
    })
  },

  reset: () => set({ viewState: defaultViewState(), initialized: false })
}))
