import { AppState, AppAction } from '../../types'
import { createNewFolder, updateFolderById, removeFromArray } from '../helpers'

export const handleFolderActions = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
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
