/**
 * IndexedDB Folder Repository Implementation
 */

import type { PageFolder } from '../../../types/type'
import type { IFolderRepository } from '../../interfaces/userData'
import {
  getUserDB,
  USER_STORES,
  dbGetAll,
  dbGet,
  dbPut,
  dbPutBatch,
  dbDelete,
  dbDeleteBatch,
  dbClear
} from './core'

export function createFolderRepository(): IFolderRepository {
  const storeName = USER_STORES.folders

  return {
    getAll: () => dbGetAll<PageFolder>(getUserDB, storeName),

    getById: (id) => dbGet<PageFolder>(getUserDB, storeName, id),

    put: (folder) => dbPut(getUserDB, storeName, folder),

    putBatch: (folders) => dbPutBatch(getUserDB, storeName, folders),

    delete: (id) => dbDelete(getUserDB, storeName, id),

    deleteBatch: (ids) => dbDeleteBatch(getUserDB, storeName, ids),

    clear: () => dbClear(getUserDB, storeName)
  }
}
