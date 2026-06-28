/**
 * File System Accounts Repository
 * Stores account list in AppData/accounts.json
 */

import type { Account } from '../../../types/type'
import type { IAccountRepository } from '../../interfaces'
import {
  getAccountsFilePath,
  getAccountPath,
  readJsonFile,
  writeJsonFile,
  deleteFile,
  ensureDirectory
} from './core'

interface AccountsFile {
  currentAccountId: string | null
  accounts: Account[]
}

const DEFAULT_ACCOUNTS_FILE: AccountsFile = {
  currentAccountId: null,
  accounts: []
}

async function readAccountsFile(): Promise<AccountsFile> {
  const data = await readJsonFile<AccountsFile>(getAccountsFilePath())
  return data ?? DEFAULT_ACCOUNTS_FILE
}

async function writeAccountsFile(data: AccountsFile): Promise<void> {
  await writeJsonFile(getAccountsFilePath(), data)
}

export function createAccountRepository(): IAccountRepository {
  return {
    async getAll(): Promise<Account[]> {
      const file = await readAccountsFile()
      return file.accounts
    },

    async getById(id: string): Promise<Account | undefined> {
      const file = await readAccountsFile()
      return file.accounts.find((a) => a.id === id)
    },

    async put(account: Account): Promise<void> {
      const file = await readAccountsFile()
      const index = file.accounts.findIndex((a) => a.id === account.id)

      if (index >= 0) {
        file.accounts[index] = account
      } else {
        file.accounts.push(account)
        // Create account directory
        await ensureDirectory(getAccountPath(account.id))
      }

      await writeAccountsFile(file)
    },

    async putBatch(accounts: Account[]): Promise<void> {
      const file = await readAccountsFile()

      for (const account of accounts) {
        const index = file.accounts.findIndex((a) => a.id === account.id)
        if (index >= 0) {
          file.accounts[index] = account
        } else {
          file.accounts.push(account)
          await ensureDirectory(getAccountPath(account.id))
        }
      }

      await writeAccountsFile(file)
    },

    async delete(id: string): Promise<void> {
      const file = await readAccountsFile()
      file.accounts = file.accounts.filter((a) => a.id !== id)

      // Clear current account if deleted
      if (file.currentAccountId === id) {
        file.currentAccountId = null
      }

      await writeAccountsFile(file)

      // Delete account directory
      try {
        await deleteFile(getAccountPath(id), { recursive: true })
      } catch {
        // Ignore errors if directory doesn't exist
      }
    },

    async deleteBatch(ids: string[]): Promise<void> {
      const file = await readAccountsFile()
      file.accounts = file.accounts.filter((a) => !ids.includes(a.id))

      if (file.currentAccountId && ids.includes(file.currentAccountId)) {
        file.currentAccountId = null
      }

      await writeAccountsFile(file)

      // Delete account directories
      for (const id of ids) {
        try {
          await deleteFile(getAccountPath(id), { recursive: true })
        } catch {
          // Ignore errors
        }
      }
    },

    async clear(): Promise<void> {
      const file = await readAccountsFile()
      const ids = file.accounts.map((a) => a.id)

      file.accounts = []
      file.currentAccountId = null
      await writeAccountsFile(file)

      // Delete all account directories
      for (const id of ids) {
        try {
          await deleteFile(getAccountPath(id), { recursive: true })
        } catch {
          // Ignore errors
        }
      }
    },

    async getCurrentAccountId(): Promise<string | null> {
      const file = await readAccountsFile()
      return file.currentAccountId
    },

    async setCurrentAccountId(id: string | null): Promise<void> {
      const file = await readAccountsFile()
      file.currentAccountId = id
      await writeAccountsFile(file)
    }
  }
}
