/**
 * File System Persistence Implementation
 */

import type {
  AccountScope,
  IAccountRepository,
  IAccountScopedPersistence,
  IDatabaseManager,
  IMessageQueueRepository,
  IMessagesRepository,
  IPersistenceRegistry,
  IWorkspaceRepository,
  IWorkspaceScopedPersistence,
  IPageRepository,
  IFolderRepository,
  ISettingsRepository,
  ILayoutRepository,
  ITabsRepository,
  PersistenceContext,
  WorkspaceScope
} from '../../interfaces'
import {
  initAppDataPath,
  setCurrentAccount,
  setCurrentWorkspace,
  getCurrentPersistenceContext
} from './core'
import { createAccountRepository } from './accountsRepository'
import { createWorkspaceRepository } from './workspaceRepository'
import { createPageRepository, invalidatePageCache } from './pagesRepository'
import { createFolderRepository } from './foldersRepository'
import { createMessagesRepository } from './messagesRepository'
import { createSettingsRepository } from './settingsRepository'
import { createLayoutRepository } from './layoutRepository'
import { createTabsRepository } from './tabsRepository'
import { createMessageQueueRepository } from './messageQueueRepository'
import { clearAllLocks } from './writeLock'
import { flushAllPersistenceQueues } from '../../../stores/persistenceQueue'

function toAccountScope(scope: AccountScope | string): AccountScope {
  return typeof scope === 'string' ? { accountId: scope } : scope
}

function workspaceKey(scope: WorkspaceScope): string {
  return `${scope.accountId}::${scope.workspacePath}`
}

function trackMethods<T extends object>(repo: T, register: (promise: Promise<unknown>) => void): T {
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') {
        return value
      }
      return (...args: unknown[]) => {
        const result = Reflect.apply(value, target, args)
        if (result instanceof Promise) {
          register(result)
        }
        return result
      }
    }
  })
}

class ScopeTracker<TKey> {
  private readonly inflight = new Map<TKey, Set<Promise<unknown>>>()

  track(key: TKey, promise: Promise<unknown>): void {
    let set = this.inflight.get(key)
    if (!set) {
      set = new Set<Promise<unknown>>()
      this.inflight.set(key, set)
    }
    set.add(promise)
    promise.finally(() => {
      const pending = this.inflight.get(key)
      if (!pending) return
      pending.delete(promise)
      if (pending.size === 0) {
        this.inflight.delete(key)
      }
    })
  }

  async wait(key: TKey): Promise<void> {
    const pending = this.inflight.get(key)
    if (!pending || pending.size === 0) {
      return
    }
    await Promise.allSettled(Array.from(pending))
  }
}

class FileSystemPersistenceRegistry implements IPersistenceRegistry {
  readonly database: IDatabaseManager
  readonly accounts: IAccountRepository

  private readonly accountTracker = new ScopeTracker<string>()
  private readonly workspaceTracker = new ScopeTracker<string>()
  private readonly accountsRepo = createAccountRepository()
  private readonly accountRepos = new Map<string, IAccountScopedPersistence>()
  private readonly workspaceRepos = new Map<string, IWorkspaceScopedPersistence>()
  private context: PersistenceContext = { accountId: null, workspacePath: null }

  constructor() {
    this.accounts = this.accountsRepo

    this.database = {
      init: async () => {
        await initAppDataPath()
      },

      setAccount: async (accountId: string) => {
        this.context = { accountId, workspacePath: null }
        setCurrentAccount(accountId)
      },

      setWorkspace: async (workspacePath: string) => {
        this.context = {
          accountId: this.context.accountId,
          workspacePath
        }
        setCurrentWorkspace(workspacePath)
      },

      syncWorkspaceAccess: async (currentWorkspacePath, approvedWorkspacePaths) => {
        this.context = {
          accountId: this.context.accountId,
          workspacePath: currentWorkspacePath
        }
        setCurrentWorkspace(currentWorkspacePath)
        await window.api.fs.syncWorkspaceAccess({
          currentWorkspacePath,
          approvedWorkspacePaths
        })
      },

      approveWorkspacePath: async (workspacePath: string) => {
        await window.api.fs.approveWorkspacePath(workspacePath)
      },

      commitContext: async ({ accountId, workspacePath, approvedWorkspacePaths = [] }) => {
        this.context = { accountId, workspacePath }
        setCurrentAccount(accountId)
        setCurrentWorkspace(workspacePath)
        await window.api.fs.syncWorkspaceAccess({
          currentWorkspacePath: workspacePath,
          approvedWorkspacePaths
        })
      },

      getActiveContext: () => ({ ...this.context }),

      flushActiveContext: async () => {
        await flushAllPersistenceQueues()

        const activeContext = this.context
        if (activeContext.accountId) {
          await this.accountTracker.wait(activeContext.accountId)
        }
        if (activeContext.accountId && activeContext.workspacePath) {
          await this.workspaceTracker.wait(
            workspaceKey({
              accountId: activeContext.accountId,
              workspacePath: activeContext.workspacePath
            })
          )
        }
      },

      waitForAccountIdle: async (accountId: string) => {
        await this.accountTracker.wait(accountId)
      },

      waitForWorkspaceIdle: async (scope: WorkspaceScope) => {
        await this.workspaceTracker.wait(workspaceKey(scope))
      }
    }
  }

  account(scope: AccountScope | string): IAccountScopedPersistence {
    const resolved = toAccountScope(scope)
    const existing = this.accountRepos.get(resolved.accountId)
    if (existing) {
      return existing
    }

    const tracked = this.createTrackedRepositories(resolved)
    this.accountRepos.set(resolved.accountId, tracked.account)
    this.workspaceRepos.set(workspaceKey({ accountId: resolved.accountId, workspacePath: '__invalid__' }), tracked.invalidWorkspace)
    return tracked.account
  }

  workspace(scope: WorkspaceScope): IWorkspaceScopedPersistence {
    const key = workspaceKey(scope)
    const existing = this.workspaceRepos.get(key)
    if (existing) {
      return existing
    }

    const created = this.createWorkspaceScoped(scope)
    this.workspaceRepos.set(key, created)
    return created
  }

  get workspaces(): IWorkspaceRepository {
    const accountId = this.requireAccountId()
    return this.account(accountId).workspaces
  }

  get pages(): IPageRepository {
    return this.requireActiveWorkspace().pages
  }

  get folders(): IFolderRepository {
    return this.requireActiveWorkspace().folders
  }

  get messages(): IMessagesRepository {
    return this.requireActiveWorkspace().messages
  }

  get settings(): ISettingsRepository {
    const accountId = this.requireAccountId()
    return this.account(accountId).settings
  }

  get layout(): ILayoutRepository {
    const accountId = this.requireAccountId()
    return this.account(accountId).layout
  }

  get tabs(): ITabsRepository {
    return this.requireActiveWorkspace().tabs
  }

  get messageQueue(): IMessageQueueRepository {
    return this.requireActiveWorkspace().messageQueue
  }

  private requireAccountId(): string {
    const accountId = this.context.accountId ?? getCurrentPersistenceContext().accountId
    if (!accountId) {
      throw new Error('No active account context')
    }
    return accountId
  }

  private requireActiveWorkspace(): IWorkspaceScopedPersistence {
    const accountId = this.requireAccountId()
    const workspacePath = this.context.workspacePath ?? getCurrentPersistenceContext().workspacePath
    if (!workspacePath) {
      throw new Error('No active workspace context')
    }
    return this.workspace({ accountId, workspacePath })
  }

  private createTrackedRepositories(scope: AccountScope): {
    account: IAccountScopedPersistence
    invalidWorkspace: IWorkspaceScopedPersistence
  } {
    const registerAccount = (promise: Promise<unknown>) => this.accountTracker.track(scope.accountId, promise)

    const account: IAccountScopedPersistence = {
      workspaces: trackMethods(createWorkspaceRepository(scope), registerAccount),
      settings: trackMethods(createSettingsRepository(scope), registerAccount),
      layout: trackMethods(createLayoutRepository(scope), registerAccount)
    }

    const invalidWorkspace: IWorkspaceScopedPersistence = {
      pages: trackMethods(createPageRepository({ ...scope, workspacePath: '__invalid__' }), registerAccount),
      folders: trackMethods(createFolderRepository({ ...scope, workspacePath: '__invalid__' }), registerAccount),
      messages: trackMethods(createMessagesRepository({ ...scope, workspacePath: '__invalid__' }), registerAccount),
      tabs: trackMethods(createTabsRepository({ ...scope, workspacePath: '__invalid__' }), registerAccount),
      messageQueue: trackMethods(createMessageQueueRepository({ ...scope, workspacePath: '__invalid__' }), registerAccount)
    }

    return { account, invalidWorkspace }
  }

  private createWorkspaceScoped(scope: WorkspaceScope): IWorkspaceScopedPersistence {
    const register = (promise: Promise<unknown>) => {
      this.accountTracker.track(scope.accountId, promise)
      this.workspaceTracker.track(workspaceKey(scope), promise)
    }

    return {
      pages: trackMethods(createPageRepository(scope), register),
      folders: trackMethods(createFolderRepository(scope), register),
      messages: trackMethods(createMessagesRepository(scope), register),
      tabs: trackMethods(createTabsRepository(scope), register),
      messageQueue: trackMethods(createMessageQueueRepository(scope), register)
    }
  }
}

/**
 * Create File System persistence registry
 */
export function createFileSystemPersistence(): IPersistenceRegistry {
  return new FileSystemPersistenceRegistry()
}

/**
 * Export cache reset helpers for tests or hard resets.
 */
export function resetFileSystemPersistenceCaches(): void {
  invalidatePageCache()
  clearAllLocks()
}
