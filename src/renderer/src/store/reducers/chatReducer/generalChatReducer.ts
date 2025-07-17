import { AppState, AppAction } from '../../../types'
import { removeFromArray } from '../../helpers'
import { createNewFolder, updateFolderById } from '../../helpers'

export const handleGeneralChatActions = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'UPDATE_CHAT': {
      return {
        ...state,
        pages: state.pages.map((chat) =>
          chat.id === action.payload.id
            ? { ...chat, ...action.payload.updates, updatedAt: Date.now() }
            : chat
        )
      }
    }

    case 'UPDATE_PAGE_LINEAGE': {
      return {
        ...state,
        pages: state.pages.map((page) =>
          page.id === action.payload.pageId
            ? {
                ...page,
                lineage: {
                  ...page.lineage,
                  ...action.payload.lineage
                },
                updatedAt: Date.now()
              }
            : page
        )
      }
    }

    case 'ADD_GENERATED_PAGE': {
      return {
        ...state,
        pages: state.pages.map((page) =>
          page.id === action.payload.sourcePageId && page.lineage
            ? {
                ...page,
                lineage: {
                  ...page.lineage,
                  generatedPageIds: [
                    ...page.lineage.generatedPageIds,
                    action.payload.generatedPageId
                  ]
                },
                updatedAt: Date.now()
              }
            : page
        )
      }
    }

    case 'DELETE_CHAT': {
      const chatToDelete = state.pages.find((chat) => chat.id === action.payload.id)
      if (!chatToDelete) return state

      const newOpenTabs = state.openTabs.filter((id) => id !== action.payload.id)
      let newActiveTabId = state.activeTabId

      if (state.activeTabId === action.payload.id) {
        newActiveTabId = newOpenTabs.length > 0 ? newOpenTabs[newOpenTabs.length - 1] : null
      }

      return {
        ...state,
        pages: removeFromArray(state.pages, action.payload.id),
        openTabs: newOpenTabs,
        activeTabId: newActiveTabId,
        selectedNodeId: state.selectedNodeId === action.payload.id ? null : state.selectedNodeId
      }
    }

    case 'DELETE_MULTIPLE_PAGES': {
      const chatIdsToDelete = action.payload.chatIds
      const updatedChats = state.pages.filter((chat) => !chatIdsToDelete.includes(chat.id))
      const updatedOpenTabs = state.openTabs.filter((id) => !chatIdsToDelete.includes(id))

      let newActiveTabId = state.activeTabId
      if (state.activeTabId && chatIdsToDelete.includes(state.activeTabId)) {
        newActiveTabId =
          updatedOpenTabs.length > 0 ? updatedOpenTabs[updatedOpenTabs.length - 1] : null
      }

      return {
        ...state,
        pages: updatedChats,
        openTabs: updatedOpenTabs,
        activeTabId: newActiveTabId,
        selectedNodeId:
          state.selectedNodeId && chatIdsToDelete.includes(state.selectedNodeId)
            ? null
            : state.selectedNodeId
      }
    }

    case 'MOVE_CHAT': {
      const { chatId, targetFolderId, newOrder } = action.payload
      return {
        ...state,
        pages: state.pages.map((page) =>
          page.id === chatId
            ? {
                ...page,
                folderId: targetFolderId,
                order: newOrder ?? page.order,
                updatedAt: Date.now()
              }
            : page
        )
      }
    }

    case 'REORDER_PAGES_IN_FOLDER': {
      const { folderId, chatIds } = action.payload
      const baseOrder = Date.now()

      return {
        ...state,
        pages: state.pages.map((chat) => {
          const newIndex = chatIds.indexOf(chat.id)
          if (newIndex !== -1 && chat.folderId === folderId) {
            return {
              ...chat,
              order: baseOrder + newIndex,
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'CREATE_FOLDER': {
        const newFolder = createNewFolder(action.payload.name, action.payload.parentId)
        return {
          ...state,
          folders: [...state.folders, newFolder],
          selectedNodeId: newFolder.id,
          selectedNodeType: 'folder'
        }
      }
  
      case 'UPDATE_FOLDER': {
        return {
          ...state,
          folders: updateFolderById(state.folders, action.payload.id, action.payload.updates)
        }
      }
  
      case 'DELETE_FOLDER': {
        const isSelectedFolder =
          state.selectedNodeId === action.payload.id && state.selectedNodeType === 'folder'
        const folderToDelete = state.folders.find((f) => f.id === action.payload.id)
  
        return {
          ...state,
          folders: state.folders
            .filter((folder) => folder.id !== action.payload.id)
            .map((folder) =>
              // 如果删除的是父文件夹，将子文件夹移到其父级
              folder.parentId === action.payload.id
                ? { ...folder, parentId: folderToDelete?.parentId }
                : folder
            ),
          pages: state.pages.map((chat) =>
            chat.folderId === action.payload.id
              ? { ...chat, folderId: folderToDelete?.parentId }
              : chat
          ),
          selectedNodeId: isSelectedFolder ? null : state.selectedNodeId,
          selectedNodeType: isSelectedFolder ? null : state.selectedNodeType
        }
      }
  
      case 'MOVE_FOLDER': {
        const { folderId, targetParentId, newOrder } = action.payload
        return {
          ...state,
          folders: state.folders.map((folder) =>
            folder.id === folderId ? { ...folder, parentId: targetParentId, order: newOrder } : folder
          )
        }
      }

    default:
      return state
  }
}
