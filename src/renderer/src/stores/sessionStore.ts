/**
 * 会话状态（当前账户与工作区）
 */

import { create } from 'zustand'
import type { SessionSnapshot } from '@shared/contracts'

interface SessionStore extends SessionSnapshot {
  initialized: boolean
  error: string | null
  setSession: (session: SessionSnapshot) => void
  reset: () => void
}

const emptySession: SessionSnapshot = {
  scopeId: null,
  accountId: null,
  workspaceId: null,
  workspacePath: null
}

export const useSessionStore = create<SessionStore>((set) => ({
  ...emptySession,
  initialized: false,
  error: null,
  setSession: (session) => set({ ...session, initialized: true, error: null }),
  reset: () => set({ ...emptySession, initialized: false, error: null })
}))
