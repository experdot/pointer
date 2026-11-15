/**
 * 账户领域模型
 */

import { describe } from '@shared/i18n/message'

import type { Diagnostic, Timestamps } from './common'

export interface Account extends Timestamps {
  id: string
  name: string
  avatar?: string
  /** 系统默认名称在展示时翻译；旧数据可能没有此字段。 */
  usesDefaultName?: boolean
}

interface CreateAccountInput {
  id: string
  name: string
  avatar?: string
  usesDefaultName?: boolean
}

export function createAccount(input: CreateAccountInput, at: number): Account {
  return {
    id: input.id,
    name: input.name,
    avatar: input.avatar,
    usesDefaultName: input.usesDefaultName ?? false,
    createdAt: at
  }
}

export function validateAccount(account: Account): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  if (!account.id) {
    diagnostics.push({ code: 'account.id-required', ...describe('errors.account.idRequired') })
  }
  if (!account.name.trim()) {
    diagnostics.push({
      code: 'account.name-required',
      ...describe('errors.account.nameRequired'),
      entityId: account.id
    })
  }

  return diagnostics
}
