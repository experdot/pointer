import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export interface UpdateInfo {
  version?: string
  releaseDate?: string
  releaseName?: string
  releaseNotes?: string
}

export interface DownloadProgress {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

export interface UpdateState {
  // 基本状态
  currentVersion: string
  checkingForUpdates: boolean
  downloading: boolean
  updateAvailable: boolean
  updateDownloaded: boolean
  error: string | null
  autoCheckEnabled: boolean

  // 更新信息
  updateInfo: UpdateInfo | null
  downloadProgress: DownloadProgress | null

  // 通知状态
  notificationShown: boolean
  downloadNotificationKey: string | null
  downloadNotificationHidden: boolean
}

export interface UpdateActions {
  // 基本状态管理
  setCurrentVersion: (version: string) => void
  setCheckingForUpdates: (checking: boolean) => void
  setDownloading: (downloading: boolean) => void
  setUpdateAvailable: (available: boolean) => void
  setUpdateDownloaded: (downloaded: boolean) => void
  setError: (error: string | null) => void
  setAutoCheckEnabled: (enabled: boolean) => void

  // 更新信息管理
  setUpdateInfo: (info: UpdateInfo | null) => void
  setDownloadProgress: (progress: DownloadProgress | null) => void

  // 通知状态管理
  setNotificationShown: (shown: boolean) => void
  setDownloadNotificationKey: (key: string | null) => void
  setDownloadNotificationHidden: (hidden: boolean) => void

  // 复合操作
  resetUpdateState: () => void
  handleUpdateAvailable: (info: UpdateInfo) => void
  handleUpdateNotAvailable: (info: any) => void
  handleDownloadProgress: (progress: DownloadProgress) => void
  handleUpdateDownloaded: (info: UpdateInfo) => void
  handleUpdateError: (error: string) => void
}

const initialState: UpdateState = {
  currentVersion: '',
  checkingForUpdates: false,
  downloading: false,
  updateAvailable: false,
  updateDownloaded: false,
  error: null,
  autoCheckEnabled: true,
  updateInfo: null,
  downloadProgress: null,
  notificationShown: false,
  downloadNotificationKey: null,
  downloadNotificationHidden: false
}

export const useUpdateStore = create<UpdateState & UpdateActions>()(
  immer((set, get) => ({
    ...initialState,

    // 基本状态管理
    setCurrentVersion: (version) =>
      set((state) => {
        state.currentVersion = version
      }),

    setCheckingForUpdates: (checking) =>
      set((state) => {
        state.checkingForUpdates = checking
        if (checking) {
          state.error = null
        }
      }),

    setDownloading: (downloading) =>
      set((state) => {
        state.downloading = downloading
        if (!downloading) {
          state.downloadProgress = null
        }
      }),

    setUpdateAvailable: (available) =>
      set((state) => {
        state.updateAvailable = available
        if (!available) {
          state.updateInfo = null
        }
      }),

    setUpdateDownloaded: (downloaded) =>
      set((state) => {
        state.updateDownloaded = downloaded
        if (downloaded) {
          state.downloading = false
          state.downloadProgress = null
        }
      }),

    setError: (error) =>
      set((state) => {
        state.error = error
        if (error) {
          state.checkingForUpdates = false
          state.downloading = false
          state.downloadProgress = null
        }
      }),

    setAutoCheckEnabled: (enabled) =>
      set((state) => {
        state.autoCheckEnabled = enabled
      }),

    // 更新信息管理
    setUpdateInfo: (info) =>
      set((state) => {
        state.updateInfo = info
      }),

    setDownloadProgress: (progress) =>
      set((state) => {
        state.downloadProgress = progress
      }),

    // 通知状态管理
    setNotificationShown: (shown) =>
      set((state) => {
        state.notificationShown = shown
      }),

    setDownloadNotificationKey: (key) =>
      set((state) => {
        state.downloadNotificationKey = key
      }),

    setDownloadNotificationHidden: (hidden) =>
      set((state) => {
        state.downloadNotificationHidden = hidden
      }),

    // 复合操作
    resetUpdateState: () =>
      set((state) => {
        state.checkingForUpdates = false
        state.downloading = false
        state.updateAvailable = false
        state.updateDownloaded = false
        state.error = null
        state.updateInfo = null
        state.downloadProgress = null
        state.notificationShown = false
        state.downloadNotificationKey = null
        state.downloadNotificationHidden = false
      }),

    handleUpdateAvailable: (info) =>
      set((state) => {
        state.updateAvailable = true
        state.updateInfo = info
        state.checkingForUpdates = false
        state.error = null
        state.notificationShown = true
      }),

    handleUpdateNotAvailable: (info) =>
      set((state) => {
        state.updateAvailable = false
        state.updateInfo = null
        state.checkingForUpdates = false
        state.error = null
      }),

    handleDownloadProgress: (progress) =>
      set((state) => {
        state.downloadProgress = progress
      }),

    handleUpdateDownloaded: (info) =>
      set((state) => {
        state.updateDownloaded = true
        state.downloading = false
        state.downloadProgress = null
        state.updateInfo = info
      }),

    handleUpdateError: (error) =>
      set((state) => {
        state.error = error
        state.checkingForUpdates = false
        state.downloading = false
        state.downloadProgress = null
      })
  }))
)
