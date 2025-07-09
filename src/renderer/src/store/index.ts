// Re-export the main context and hook
export { AppProvider, useAppContext } from './AppContext'

// Re-export constants that might be needed elsewhere
export { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, INITIAL_SETTINGS } from './constants'

// Re-export helpers that might be useful in components
export { createNewChat, createNewFolder, constrainSidebarWidth } from './helpers'

// Re-export the state persistence hook for potential reuse
export { useStatePersistence } from './hooks/useStatePersistence'
