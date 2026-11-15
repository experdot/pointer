import { create } from 'zustand'
import type { LocaleSnapshot } from '@shared/contracts'
import type { LanguagePreference } from '@shared/domain/locale'
import { command } from '../runtime/client'
import { rendererI18n } from '../i18n'

interface LocaleState {
  snapshot: LocaleSnapshot | null
  saving: boolean
  accept: (snapshot: LocaleSnapshot) => void
  setPreference: (preference: LanguagePreference) => Promise<void>
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  snapshot: null,
  saving: false,
  accept: (snapshot) => {
    if (get().snapshot && snapshot.revision < get().snapshot!.revision) return
    void rendererI18n.changeLanguage(snapshot.language)
    if (typeof document !== 'undefined') document.documentElement.lang = snapshot.language
    set({ snapshot })
  },
  setPreference: async (preference) => {
    set({ saving: true })
    try {
      get().accept(await command('app.locale.set', { preference }))
    } finally {
      set({ saving: false })
    }
  }
}))
