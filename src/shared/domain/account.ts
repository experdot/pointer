/**
 * 账户领域模型
 */

import type { Diagnostic, Timestamps } from './common'

export interface Account extends Timestamps {
  id: string
  name: string
  avatar?: string
}

interface CreateAccountInput {
  id: string
  name: string
  avatar?: string
}

export function createAccount(input: CreateAccountInput, at: number): Account {
  return {
    id: input.id,
    name: input.name,
    avatar: input.avatar,
    createdAt: at
  }
}

export function validateAccount(account: Account): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  if (!account.id) {
    diagnostics.push({ code: 'account.id-required', message: '账户缺少 id' })
  }
  if (!account.name.trim()) {
    diagnostics.push({
      code: 'account.name-required',
      message: '账户名称不能为空',
      entityId: account.id
    })
  }

  return diagnostics
}
