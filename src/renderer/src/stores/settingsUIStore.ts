/**
 * 设置面板的界面状态
 *
 * `pendingTab` 用于"配置 LLM"这类入口：请求打开设置面板并定位到指定内页。
 * 之前用模块级变量 + 挂载时消费，设置页签已经打开过就不会再跳转；
 * 改成 store 后，无论是首次挂载还是后续请求都能生效。
 */

import { create } from 'zustand'

interface SettingsUIState {
  pendingTab?: string
  /** 请求打开某个内页（由 settingsService.openSettings 调用） */
  requestTab: (tab?: string) => void
  consumePendingTab: () => string | undefined
}

export const useSettingsUIStore = create<SettingsUIState>((set, get) => ({
  pendingTab: undefined,

  requestTab: (tab) => set({ pendingTab: tab }),

  consumePendingTab: () => {
    const tab = get().pendingTab
    if (tab) set({ pendingTab: undefined })
    return tab
  }
}))
