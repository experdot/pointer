import { create } from 'zustand'

interface ChatUIState {
  scrollTop: number
  inputContent: string
}

interface ChatUIStore {
  states: Map<string, ChatUIState>
  getState: (pageId: string) => ChatUIState
  setScrollTop: (pageId: string, scrollTop: number) => void
  setInputContent: (pageId: string, content: string) => void
  clearState: (pageId: string) => void
}

const defaultState: ChatUIState = {
  scrollTop: -1, // -1 表示滚动到底部
  inputContent: ''
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

  clearState: (pageId) => {
    set((state) => {
      const newStates = new Map(state.states)
      newStates.delete(pageId)
      return { states: newStates }
    })
  }
}))
