/**
 * Account persistence interface
 * Operates on the independent accounts database (pointer-accounts)
 */

import type { Account } from '../../types/type'
import type { IRepository } from './base'

/**
 * Account repository interface
 * Extends base repository with account-specific operations
 */
export interface IAccountRepository extends IRepository<Account> {
  /**
   * Get the currently active account ID
   */
  getCurrentAccountId(): Promise<string | null>

  /**
   * Set the currently active account ID
   */
  setCurrentAccountId(id: string | null): Promise<void>
}
