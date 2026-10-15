/**
 * 账户服务
 */

import type { Account } from '@shared/domain'
import { getDefaultAccountId, useAccountStore } from '../stores/accountStore'
import { useSettingsStore } from '../stores/settingsStore'

export async function switchAccount(accountId: string): Promise<void> {
  // 切换前先把待写入的设置落盘，避免写到新账户名下
  useSettingsStore.getState().flush()
  await useAccountStore.getState().setCurrentAccountId(accountId)
}

export async function createAccount(name: string, avatar?: string): Promise<Account> {
  useSettingsStore.getState().flush()
  return useAccountStore.getState().create({ name, avatar })
}

export async function updateAccount(
  id: string,
  updates: { name?: string; avatar?: string }
): Promise<void> {
  await useAccountStore.getState().update(id, updates)
}

export async function removeAccount(accountId: string): Promise<void> {
  // 与迁移前一致：默认账户与当前账户不允许删除
  if (accountId === getDefaultAccountId()) {
    throw new Error('Cannot delete default account')
  }
  if (accountId === useAccountStore.getState().currentAccountId) {
    throw new Error('Cannot delete current account')
  }
  await useAccountStore.getState().remove(accountId)
}

export async function logout(): Promise<void> {
  // 与迁移前一致：退出登录 = 切回默认账户（列表中的第一个账户）
  const { accounts, currentAccountId } = useAccountStore.getState()
  const target = accounts[0]
  if (!target || target.id === currentAccountId) return
  await switchAccount(target.id)
}
