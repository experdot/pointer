/**
 * 账户目录（accounts.json）与当前会话记录
 */

import { randomUUID } from 'node:crypto'
import type { Account } from '@shared/domain'
import { createAccount, validateAccount } from '@shared/domain'
import { RuntimeError } from '@shared/contracts'
import type { PathResolver } from './paths'
import { ensureDir, readJson, removePath, writeJsonAtomic } from './fsx'

interface AccountsFile {
  accounts: Account[]
  currentAccountId: string | null
}

export interface SessionFile {
  accountId: string | null
  workspaceId: string | null
}

export class AccountStore {
  private accounts: Account[] = []
  private currentAccountId: string | null = null
  private session: SessionFile = { accountId: null, workspaceId: null }

  constructor(private readonly paths: PathResolver) {}

  async load(): Promise<void> {
    const file = await readJson<AccountsFile>(this.paths.accountsFile)
    this.accounts = file?.accounts ?? []
    this.currentAccountId =
      file?.currentAccountId && this.accounts.some((item) => item.id === file.currentAccountId)
        ? file.currentAccountId
        : (this.accounts[0]?.id ?? null)

    const session = await readJson<SessionFile>(this.paths.sessionFile)
    if (session) this.session = { accountId: session.accountId, workspaceId: session.workspaceId }
  }

  list(): Account[] {
    return this.accounts.map((account) => ({ ...account }))
  }

  getById(accountId: string): Account | undefined {
    const account = this.accounts.find((item) => item.id === accountId)
    return account ? { ...account } : undefined
  }

  getCurrentId(): string | null {
    return this.currentAccountId
  }

  getCurrent(): Account | null {
    if (!this.currentAccountId) return null
    return this.getById(this.currentAccountId) ?? null
  }

  async ensureDefaultAccount(): Promise<Account> {
    const existing = this.getCurrent()
    if (existing) return existing

    return this.create({ name: '默认账户' })
  }

  async create(input: { name: string; avatar?: string }): Promise<Account> {
    const account = createAccount(
      { id: randomUUID(), name: input.name.trim() || '未命名账户', avatar: input.avatar },
      Date.now()
    )

    const diagnostics = validateAccount(account)
    if (diagnostics.length > 0) {
      throw new RuntimeError('account.invalid', diagnostics[0].message)
    }

    this.accounts = [...this.accounts, account]
    this.currentAccountId = account.id
    await ensureDir(this.paths.accountDir(account.id))
    await this.persist()
    return account
  }

  async update(
    accountId: string,
    patch: { name?: string; avatar?: string },
    at: number
  ): Promise<Account> {
    const target = this.accounts.find((item) => item.id === accountId)
    if (!target) throw new RuntimeError('account.not-found', `账户不存在：${accountId}`)

    const updated: Account = {
      ...target,
      ...(patch.name !== undefined ? { name: patch.name.trim() || target.name } : {}),
      ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
      updatedAt: at
    }

    const diagnostics = validateAccount(updated)
    if (diagnostics.length > 0) {
      throw new RuntimeError('account.invalid', diagnostics[0].message)
    }

    this.accounts = this.accounts.map((item) => (item.id === accountId ? updated : item))
    await this.persist()
    return updated
  }

  async remove(accountId: string): Promise<void> {
    if (this.accounts.length <= 1) {
      throw new RuntimeError('account.last-account', '至少需要保留一个账户')
    }
    if (!this.accounts.some((item) => item.id === accountId)) {
      throw new RuntimeError('account.not-found', `账户不存在：${accountId}`)
    }

    this.accounts = this.accounts.filter((item) => item.id !== accountId)
    if (this.currentAccountId === accountId) {
      this.currentAccountId = this.accounts[0]?.id ?? null
    }
    await this.persist()
    await removePath(this.paths.accountDir(accountId), true)
  }

  async setCurrent(accountId: string): Promise<void> {
    if (!this.accounts.some((item) => item.id === accountId)) {
      throw new RuntimeError('account.not-found', `账户不存在：${accountId}`)
    }
    this.currentAccountId = accountId
    await this.persist()
  }

  getSession(): SessionFile {
    return { ...this.session }
  }

  async setSession(session: SessionFile): Promise<void> {
    this.session = { ...session }
    await writeJsonAtomic(this.paths.sessionFile, this.session)
  }

  private async persist(): Promise<void> {
    await writeJsonAtomic(this.paths.accountsFile, {
      accounts: this.accounts,
      currentAccountId: this.currentAccountId
    } satisfies AccountsFile)
  }
}
