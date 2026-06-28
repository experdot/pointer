import { create } from 'zustand'

export type SwitchTransactionKind = 'account' | 'workspace'

interface SwitchTransactionState {
  inProgress: boolean
  kind: SwitchTransactionKind | null
  targetLabel: string | null
  message: string | null
  sequence: number
}

interface SwitchTransactionActions {
  begin: (kind: SwitchTransactionKind, targetLabel: string, message?: string) => number
  updateMessage: (message: string) => void
  complete: () => void
}

type SwitchTransactionStore = SwitchTransactionState & SwitchTransactionActions

const initialState: SwitchTransactionState = {
  inProgress: false,
  kind: null,
  targetLabel: null,
  message: null,
  sequence: 0
}

export const useSwitchTransactionStore = create<SwitchTransactionStore>((set, get) => ({
  ...initialState,

  begin: (kind, targetLabel, message) => {
    const sequence = get().sequence + 1
    set({
      inProgress: true,
      kind,
      targetLabel,
      message: message ?? null,
      sequence
    })
    return sequence
  },

  updateMessage: (message) => set({ message }),

  complete: () =>
    set((state) => ({
      inProgress: false,
      kind: null,
      targetLabel: null,
      message: null,
      sequence: state.sequence
    }))
}))

export function getSwitchGeneration(): number {
  return useSwitchTransactionStore.getState().sequence
}

export function isSwitchActive(): boolean {
  return useSwitchTransactionStore.getState().inProgress
}
