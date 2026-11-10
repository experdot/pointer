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
  flush: () => Promise<void>
  reset: () => void
}

export const useViewStateStore = create<ViewStateStore>((set, get) => {
  let pending: ViewState | null = null
  let inFlight: Promise<void> | null = null
  let generation = 0
  const flush = async (): Promise<void> => {
    if (inFlight) {
      await inFlight
      return flush()
    }
    const next = pending
    if (!next) return
    const epoch = generation
    inFlight = command('viewState.replace', { viewState: next })
    try {
      await inFlight
      if (epoch === generation && pending === next) pending = null
    } finally {
      inFlight = null
    }
    if (epoch === generation && pending) await flush()
  }
  return {
    viewState: defaultViewState(),
    initialized: false,

    setViewState: (state) => set({ viewState: pending ?? state, initialized: true }),

    patch: (patch) => {
      const next: ViewState = { ...get().viewState, ...patch }
      set({ viewState: next })
      pending = next
      void flush().catch((error) => {
        console.warn('[view-state] 保存失败：', error)
      })
    },

    flush,
    reset: () => {
      generation++
      pending = null
      set({ viewState: defaultViewState(), initialized: false })
    }
  }
})
