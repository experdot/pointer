import { create } from 'zustand'
import type { FileAttachment } from '../types/type'

interface ChatUIState {
  scrollTop: number
  inputContent: string
  pendingAttachments: FileAttachment[]
}

interface ChatUIStore {
  states: Map<string, ChatUIState>
  getState: (pageId: string) => ChatUIState
  setScrollTop: (pageId: string, scrollTop: number) => void
  setInputContent: (pageId: string, content: string) => void
  addPendingAttachment: (pageId: string, attachment: FileAttachment) => void
  removePendingAttachment: (pageId: string, attachmentId: string) => void
  clearPendingAttachments: (pageId: string) => void
  clearState: (pageId: string) => void
}

const defaultState: ChatUIState = {
  scrollTop: -1, // -1 表示滚动到底部
  inputContent: '',
  pendingAttachments: []
}

export const useChatUIStore = create<ChatUIStore>((set, get) => ({
  states: new Map(),

  getState: (pageId) => {
    return get().states.get(pageId) ?? defaultState
  },

  setScrollTop: (pageId, scrollTop) => {
    set((state) => {
      const newStates = new Map(state.states)
      const current = newStates.get(pageId) ?? { ...defaultState }
      newStates.set(pageId, { ...current, scrollTop })
      return { states: newStates }
    })
  },

  setInputContent: (pageId, content) => {
    set((state) => {
      const newStates = new Map(state.states)
      const current = newStates.get(pageId) ?? { ...defaultState }
      newStates.set(pageId, { ...current, inputContent: content })
      return { states: newStates }
    })
  },

  addPendingAttachment: (pageId, attachment) => {
    set((state) => {
      const newStates = new Map(state.states)
      const current = newStates.get(pageId) ?? { ...defaultState }
      newStates.set(pageId, {
        ...current,
        pendingAttachments: [...current.pendingAttachments, attachment]
      })
      return { states: newStates }
    })
  },

  removePendingAttachment: (pageId, attachmentId) => {
    set((state) => {
      const newStates = new Map(state.states)
      const current = newStates.get(pageId) ?? { ...defaultState }
      newStates.set(pageId, {
        ...current,
        pendingAttachments: current.pendingAttachments.filter((a) => a.id !== attachmentId)
      })
      return { states: newStates }
    })
  },

  clearPendingAttachments: (pageId) => {
    set((state) => {
      const newStates = new Map(state.states)
      const current = newStates.get(pageId) ?? { ...defaultState }
      newStates.set(pageId, { ...current, pendingAttachments: [] })
      return { states: newStates }
    })
  },

  clearState: (pageId) => {
    set((state) => {
      const newStates = new Map(state.states)
      newStates.delete(pageId)
      return { states: newStates }
    })
  }
}))
