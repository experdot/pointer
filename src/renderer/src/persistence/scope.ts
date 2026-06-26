import type { AccountScope, WorkspaceScope } from './interfaces'
import { persistence } from './registry'

export function tryGetCurrentAccountScope(): AccountScope | null {
  const accountId = persistence.database.getActiveContext().accountId
  if (!accountId) {
    return null
  }
  return { accountId }
}

export function getCurrentAccountScope(): AccountScope {
  const scope = tryGetCurrentAccountScope()
  if (!scope) {
    throw new Error('No current account selected')
  }
  return scope
}

export function tryGetCurrentWorkspaceScope(): WorkspaceScope | null {
  const context = persistence.database.getActiveContext()
  if (!context.accountId || !context.workspacePath) {
    return null
  }
  return {
    accountId: context.accountId,
    workspacePath: context.workspacePath
  }
}

export function getCurrentWorkspaceScope(): WorkspaceScope {
  const scope = tryGetCurrentWorkspaceScope()
  if (!scope) {
    throw new Error('No current workspace selected')
  }
  return scope
}
