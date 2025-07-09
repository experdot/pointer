import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { AppState, AppAction } from '../types'
import { StorageService } from '../utils/storage'
import { INITIAL_SETTINGS } from './constants'
import { appReducer } from './reducers'
import { useStatePersistence } from './hooks/useStatePersistence'

// Initial state
const initialState: AppState = {
  pages: [],
  folders: [],
  openTabs: [],
  activeTabId: null,
  selectedNodeId: null,
  selectedNodeType: null,
  multiSelectMode: false,
  checkedNodeIds: [],
  sidebarCollapsed: false,
  sidebarWidth: 300,
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  showSearchResults: false,
  collapsedMessages: {},
  allMessagesCollapsed: {},
  settings: INITIAL_SETTINGS
}

// Context definition
interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}

const AppContext = createContext<AppContextValue | undefined>(undefined)

// Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const [isLoaded, setIsLoaded] = React.useState(false)

  // Load initial state
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedState = StorageService.loadAppState()
        if (savedState) {
          console.log('Loading saved state:', savedState)
          dispatch({ type: 'LOAD_STATE', payload: savedState })
        }
      } catch (error) {
        console.error('Failed to load saved state:', error)
      } finally {
        setIsLoaded(true)
      }
    }

    loadState()
  }, [])

  // Handle state persistence
  useStatePersistence(state, isLoaded)

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}

// Hook for consuming context
export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}
