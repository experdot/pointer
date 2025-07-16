import { useEffect, useRef, useCallback } from 'react'
import { AppState } from '../../types'
import { StorageService } from '../../services/storageService'
import { SAVE_DEBOUNCE_DELAY } from '../constants'

// Custom hook for managing state persistence
export const useStatePersistence = (state: AppState, isLoaded: boolean) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedSave = useCallback(() => {
    if (!isLoaded) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        StorageService.saveAppState(state)
      } catch (error) {
        console.error('Failed to save app state:', error)
      }
    }, SAVE_DEBOUNCE_DELAY)
  }, [state, isLoaded])

  useEffect(() => {
    debouncedSave()

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [debouncedSave])
}
