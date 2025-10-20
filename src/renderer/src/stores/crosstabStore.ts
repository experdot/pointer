import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { CrosstabData, CrosstabStep, CrosstabMetadata } from '../types/type'
import { createPersistConfig, handleStoreError } from './persistence/storeConfig'
import { usePagesStore } from './pagesStore'

export interface CrosstabState {
  // 交叉表相关的状态通过pagesStore访问，这里主要提供操作方法
}

export interface CrosstabActions {
  // 交叉表数据操作
  updateCrosstabData: (chatId: string, data: Partial<CrosstabData>) => void
  updateCrosstabStep: (chatId: string, stepIndex: number, response: string) => void
  completeCrosstabStep: (chatId: string, stepIndex: number) => void

  // 元数据操作
  updateMetadata: (chatId: string, metadata: Partial<CrosstabMetadata>) => void

  // 表格数据操作
  updateTableData: (
    chatId: string,
    dimensionPath: string,
    valueDimensionId: string,
    value: string
  ) => void
  clearTableData: (chatId: string) => void

  // 工具方法
  getCrosstabData: (chatId: string) => CrosstabData | undefined
  getCurrentStep: (chatId: string) => CrosstabStep | undefined
  getNextStep: (chatId: string) => CrosstabStep | undefined
  isStepCompleted: (chatId: string, stepIndex: number) => boolean
}

const initialState: CrosstabState = {}

export const useCrosstabStore = create<CrosstabState & CrosstabActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // 交叉表数据操作
      updateCrosstabData: (chatId, data) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'crosstab') {
            let updatedCrosstabData = { ...page.crosstabData }

            // 特殊处理tableData的合并，避免对象不可扩展的问题
            if (data.tableData && page.crosstabData.tableData) {
              updatedCrosstabData = {
                ...updatedCrosstabData,
                ...data,
                tableData: { ...page.crosstabData.tableData, ...data.tableData }
              }
            } else {
              updatedCrosstabData = { ...updatedCrosstabData, ...data }
            }

            updatePage(chatId, { crosstabData: updatedCrosstabData })
          }
        } catch (error) {
          handleStoreError('crosstabStore', 'updateCrosstabData', error)
        }
      },

      updateCrosstabStep: (chatId, stepIndex, response) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'crosstab' && page.crosstabData) {
            const updatedSteps = page.crosstabData.steps.map((step, index) =>
              index === stepIndex ? { ...step, response } : step
            )

            const updatedCrosstabData = {
              ...page.crosstabData,
              steps: updatedSteps
            }

            updatePage(chatId, { crosstabData: updatedCrosstabData })
          }
        } catch (error) {
          handleStoreError('crosstabStore', 'updateCrosstabStep', error)
        }
      },

      completeCrosstabStep: (chatId, stepIndex) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'crosstab' && page.crosstabData) {
            const updatedSteps = page.crosstabData.steps.map((step, index) =>
              index === stepIndex ? { ...step, isCompleted: true } : step
            )

            const updatedCrosstabData = {
              ...page.crosstabData,
              steps: updatedSteps
            }

            updatePage(chatId, { crosstabData: updatedCrosstabData })
          }
        } catch (error) {
          handleStoreError('crosstabStore', 'completeCrosstabStep', error)
        }
      },

      // 元数据操作
      updateMetadata: (chatId, metadata) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'crosstab' && page.crosstabData) {
            const updatedMetadata = { ...page.crosstabData.metadata, ...metadata }
            const updatedCrosstabData = {
              ...page.crosstabData,
              metadata: updatedMetadata
            }

            updatePage(chatId, { crosstabData: updatedCrosstabData })
          }
        } catch (error) {
          handleStoreError('crosstabStore', 'updateMetadata', error)
        }
      },

      // 表格数据操作
      updateTableData: (chatId, dimensionPath, valueDimensionId, value) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'crosstab' && page.crosstabData) {
            const updatedTableData = { ...page.crosstabData.tableData }

            if (!updatedTableData[dimensionPath]) {
              updatedTableData[dimensionPath] = {}
            }

            updatedTableData[dimensionPath][valueDimensionId] = value

            const updatedCrosstabData = {
              ...page.crosstabData,
              tableData: updatedTableData
            }

            updatePage(chatId, { crosstabData: updatedCrosstabData })
          }
        } catch (error) {
          handleStoreError('crosstabStore', 'updateTableData', error)
        }
      },

      clearTableData: (chatId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'crosstab' && page.crosstabData) {
            const updatedCrosstabData = {
              ...page.crosstabData,
              tableData: {}
            }

            updatePage(chatId, { crosstabData: updatedCrosstabData })
          }
        } catch (error) {
          handleStoreError('crosstabStore', 'clearTableData', error)
        }
      },

      // 工具方法
      getCrosstabData: (chatId) => {
        const page = usePagesStore.getState().findPageById(chatId)
        if (page && page.type === 'crosstab') {
          return page.crosstabData
        }
        return undefined
      },

      getCurrentStep: (chatId) => {
        const page = usePagesStore.getState().findPageById(chatId)
        if (page && page.type === 'crosstab' && page.crosstabData) {
          return page.crosstabData.steps[page.crosstabData.currentStep]
        }
        return undefined
      },

      getNextStep: (chatId) => {
        const page = usePagesStore.getState().findPageById(chatId)
        if (page && page.type === 'crosstab' && page.crosstabData) {
          const nextIndex = page.crosstabData.currentStep + 1
          return page.crosstabData.steps[nextIndex]
        }
        return undefined
      },

      isStepCompleted: (chatId, stepIndex) => {
        const page = usePagesStore.getState().findPageById(chatId)
        if (page && page.type === 'crosstab' && page.crosstabData) {
          const step = page.crosstabData.steps[stepIndex]
          return step?.isCompleted || false
        }
        return false
      }
    })),
    createPersistConfig('crosstab-store', 1, (state) => ({
      // crosstabStore 只提供方法，没有状态数据
    }))
  )
)
