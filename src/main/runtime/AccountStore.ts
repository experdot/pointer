/**
 * 账户目录与当前账户；每个账户的当前工作区由 WorkspaceRegistry 维护
 */

import { msg, sourceTranslate } from '@shared/i18n/message'
import { en, zh } from '@shared/i18n/resources'
import type { Translate } from '@shared/i18n'

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

export class AccountStore {
  private accounts: Account[] = []
  private currentAccountId: string | null = null

  constructor(
    private readonly paths: PathResolver,
    private readonly t: Translate = sourceTranslate
  ) {}

  async load(): Promise<void> {
    const file = await readJson<AccountsFile>(this.paths.accountsFile)
    // 兼容旧版首个账户的默认名；显式改名或手动创建的账户不再按名称推断。
    this.accounts = (file?.accounts ?? []).map((account, index) => ({
      ...account,
      usesDefaultName:
        account.usesDefaultName ??
        (index === 0 && [zh['defaults.account'], en['defaults.account']].includes(account.name))
    }))
    this.currentAccountId =
      file?.currentAccountId && this.accounts.some((item) => item.id === file.currentAccountId)
        ? file.currentAccountId
        : (this.accounts[0]?.id ?? null)
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

    return this.create({ name: this.t('defaults.account') }, true)
  }

  async create(
    input: { name: string; avatar?: string },
    usesDefaultName = false
  ): Promise<Account> {
    const account = createAccount(
      {
        id: randomUUID(),
        name: input.name.trim() || this.t('defaults.unnamedAccount'),
        avatar: input.avatar,
        usesDefaultName
      },
      Date.now()
    )

    const diagnostics = validateAccount(account)
    if (diagnostics.length > 0) {
      throw new RuntimeError('account.invalid', diagnostics[0].localized ?? diagnostics[0].message)
    }

    const accounts = [...this.accounts, account]
    const currentAccountId = this.currentAccountId ?? account.id
    await ensureDir(this.paths.accountDir(account.id))
    await this.persist(accounts, currentAccountId)
    this.accounts = accounts
    this.currentAccountId = currentAccountId
    return account
  }

  async update(
    accountId: string,
    patch: { name?: string; avatar?: string },
    at: number
  ): Promise<Account> {
    const target = this.accounts.find((item) => item.id === accountId)
    if (!target)
      throw new RuntimeError(
        'account.not-found',
        msg('errors.account.missingId', { v0: String(accountId) })
      )

    const name = patch.name?.trim()
    const updated: Account = {
      ...target,
      ...(name ? { name, usesDefaultName: false } : {}),
      ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
      updatedAt: at
    }

    const diagnostics = validateAccount(updated)
    if (diagnostics.length > 0) {
      throw new RuntimeError('account.invalid', diagnostics[0].localized ?? diagnostics[0].message)
    }

    const accounts = this.accounts.map((item) => (item.id === accountId ? updated : item))
    await this.persist(accounts)
    this.accounts = accounts
    return updated
  }

  async remove(accountId: string): Promise<void> {
    if (this.accounts.length <= 1) {
      throw new RuntimeError('account.last-account', msg('errors.account.last'))
    }
    if (!this.accounts.some((item) => item.id === accountId)) {
      throw new RuntimeError(
        'account.not-found',
        msg('errors.account.missingId', { v0: String(accountId) })
      )
    }

    const accounts = this.accounts.filter((item) => item.id !== accountId)
    const currentAccountId =
      this.currentAccountId === accountId ? (accounts[0]?.id ?? null) : this.currentAccountId
    await this.persist(accounts, currentAccountId)
    this.accounts = accounts
    this.currentAccountId = currentAccountId
    await removePath(this.paths.accountDir(accountId), true)
  }

  async setCurrent(accountId: string): Promise<void> {
    if (!this.accounts.some((item) => item.id === accountId)) {
      throw new RuntimeError(
        'account.not-found',
        msg('errors.account.missingId', { v0: String(accountId) })
      )
    }
    await this.persist(this.accounts, accountId)
    this.currentAccountId = accountId
  }

  private async persist(
    accounts = this.accounts,
    currentAccountId = this.currentAccountId
  ): Promise<void> {
    await writeJsonAtomic(this.paths.accountsFile, {
      accounts,
      currentAccountId
    } satisfies AccountsFile)
  }
}
