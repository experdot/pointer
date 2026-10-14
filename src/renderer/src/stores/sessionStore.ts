/**
 * 会话状态（当前账户与工作区）
 */

import { create } from 'zustand'
import type { SessionSnapshot } from '@shared/contracts'

interface SessionStore extends SessionSnapshot {
  initialized: boolean
  setSession: (session: SessionSnapshot) => void
  reset: () => void
}

const emptySession: SessionSnapshot = {
  accountId: null,
  workspaceId: null,
  workspacePath: null
}

export const useSessionStore = create<SessionStore>((set) => ({
  ...emptySession,
  initialized: false,
  setSession: (session) => set({ ...session, initialized: true }),
  reset: () => set({ ...emptySession, initialized: false })
}))
