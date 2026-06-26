/**
 * File System Folders Repository
 * Workspace-level storage: {workspace}/folders.json
 */

import type { PageFolder } from '../../../types/type'
import type { IFolderRepository, WorkspaceScope } from '../../interfaces'
import {
  getFoldersFilePath,
  getWorkspaceFileOptions,
  readJsonFile,
  writeJsonFile,
  deleteFile
} from './core'
import { withWriteLock } from './writeLock'

interface FoldersFile {
  folders: PageFolder[]
}

async function readFoldersFile(scope: WorkspaceScope): Promise<FoldersFile> {
  const options = getWorkspaceFileOptions(scope)
  const data = await readJsonFile<FoldersFile>(getFoldersFilePath(scope), options)
  return data ?? { folders: [] }
}

async function writeFoldersFile(scope: WorkspaceScope, data: FoldersFile): Promise<void> {
  const options = getWorkspaceFileOptions(scope)
  await writeJsonFile(getFoldersFilePath(scope), data, options)
}

export function createFolderRepository(scope: WorkspaceScope): IFolderRepository {
  return {
    async getAll(): Promise<PageFolder[]> {
      const file = await readFoldersFile(scope)
      return file.folders
    },

    async getById(id: string): Promise<PageFolder | undefined> {
      const file = await readFoldersFile(scope)
      return file.folders.find((f) => f.id === id)
    },

    async put(folder: PageFolder): Promise<void> {
      await withWriteLock(getFoldersFilePath(scope), async () => {
        const file = await readFoldersFile(scope)
        const index = file.folders.findIndex((f) => f.id === folder.id)

        if (index >= 0) {
          file.folders[index] = folder
        } else {
          file.folders.push(folder)
        }

        await writeFoldersFile(scope, file)
      })
    },

    async putBatch(folders: PageFolder[]): Promise<void> {
      await withWriteLock(getFoldersFilePath(scope), async () => {
        const file = await readFoldersFile(scope)

        for (const folder of folders) {
          const index = file.folders.findIndex((f) => f.id === folder.id)
          if (index >= 0) {
            file.folders[index] = folder
          } else {
            file.folders.push(folder)
          }
        }

        await writeFoldersFile(scope, file)
      })
    },

    async delete(id: string): Promise<void> {
      await withWriteLock(getFoldersFilePath(scope), async () => {
        const file = await readFoldersFile(scope)
        file.folders = file.folders.filter((f) => f.id !== id)
        await writeFoldersFile(scope, file)
      })
    },

    async deleteBatch(ids: string[]): Promise<void> {
      await withWriteLock(getFoldersFilePath(scope), async () => {
        const file = await readFoldersFile(scope)
        file.folders = file.folders.filter((f) => !ids.includes(f.id))
        await writeFoldersFile(scope, file)
      })
    },

    async clear(): Promise<void> {
      const options = getWorkspaceFileOptions(scope)
      try {
        await deleteFile(getFoldersFilePath(scope), options)
      } catch {
        // Ignore if file doesn't exist
      }
    }
  }
}
