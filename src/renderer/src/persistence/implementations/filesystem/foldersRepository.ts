/**
 * File System Folders Repository
 * Workspace-level storage: {workspace}/folders.json
 */

import type { PageFolder } from '../../../types/type'
import type { IFolderRepository } from '../../interfaces'
import {
  getFoldersFilePath,
  isCustomWorkspacePath,
  getCurrentWorkspacePath,
  readJsonFile,
  writeJsonFile,
  deleteFile
} from './core'

interface FoldersFile {
  folders: PageFolder[]
}

function getFileOptions(): { allowCustomPath?: boolean } {
  const wsPath = getCurrentWorkspacePath()
  return wsPath && isCustomWorkspacePath(wsPath) ? { allowCustomPath: true } : {}
}

async function readFoldersFile(): Promise<FoldersFile> {
  const options = getFileOptions()
  const data = await readJsonFile<FoldersFile>(getFoldersFilePath(), options)
  return data ?? { folders: [] }
}

async function writeFoldersFile(data: FoldersFile): Promise<void> {
  const options = getFileOptions()
  await writeJsonFile(getFoldersFilePath(), data, options)
}

export function createFolderRepository(): IFolderRepository {
  return {
    async getAll(): Promise<PageFolder[]> {
      const file = await readFoldersFile()
      return file.folders
    },

    async getById(id: string): Promise<PageFolder | undefined> {
      const file = await readFoldersFile()
      return file.folders.find((f) => f.id === id)
    },

    async put(folder: PageFolder): Promise<void> {
      const file = await readFoldersFile()
      const index = file.folders.findIndex((f) => f.id === folder.id)

      if (index >= 0) {
        file.folders[index] = folder
      } else {
        file.folders.push(folder)
      }

      await writeFoldersFile(file)
    },

    async putBatch(folders: PageFolder[]): Promise<void> {
      const file = await readFoldersFile()

      for (const folder of folders) {
        const index = file.folders.findIndex((f) => f.id === folder.id)
        if (index >= 0) {
          file.folders[index] = folder
        } else {
          file.folders.push(folder)
        }
      }

      await writeFoldersFile(file)
    },

    async delete(id: string): Promise<void> {
      const file = await readFoldersFile()
      file.folders = file.folders.filter((f) => f.id !== id)
      await writeFoldersFile(file)
    },

    async deleteBatch(ids: string[]): Promise<void> {
      const file = await readFoldersFile()
      file.folders = file.folders.filter((f) => !ids.includes(f.id))
      await writeFoldersFile(file)
    },

    async clear(): Promise<void> {
      const options = getFileOptions()
      try {
        await deleteFile(getFoldersFilePath(), options)
      } catch {
        // Ignore if file doesn't exist
      }
    }
  }
}
