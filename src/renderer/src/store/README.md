# Store Structure

This directory contains the refactored application state management code, organized into modular files for better maintainability and separation of concerns.

## File Structure

```
store/
├── constants.ts              # App-wide constants and initial settings
├── helpers.ts               # Utility functions for state management
├── hooks/
│   └── useStatePersistence.ts # Custom hook for state persistence
├── reducers/
│   ├── chatReducer.ts       # Chat-related state actions
│   ├── folderReducer.ts     # Folder-related state actions
│   ├── messageReducer.ts    # Message-related state actions
│   ├── tabReducer.ts        # Tab-related state actions
│   ├── uiReducer.ts         # UI-related state actions
│   └── index.ts             # Main reducer combining all domain reducers
├── AppContext.tsx           # Main context provider and hook
└── README.md               # This documentation file
```

## Key Features

### 🔧 Modular Architecture

- **Domain-specific reducers**: Each reducer handles a specific domain (chats, folders, messages, tabs, UI)
- **Reusable helpers**: Common operations extracted into utility functions
- **Custom hooks**: State persistence logic encapsulated in a reusable hook

### ⚡ Performance Optimizations

- **Debounced state saving**: Prevents excessive localStorage writes
- **Efficient state updates**: Optimized reducer logic with early returns
- **Memory leak prevention**: Proper cleanup of timeouts and effects

### 🛡️ Error Handling

- **Graceful degradation**: Try-catch blocks for state persistence
- **Null checks**: Defensive programming for chat/folder operations
- **Loading states**: Proper handling of async state loading

## Usage

### Basic Usage

```tsx
import { useAppContext } from './store/AppContext'

function MyComponent() {
  const { state, dispatch } = useAppContext()

  // Access state
  const { chats, folders, settings } = state

  // Dispatch actions
  dispatch({
    type: 'CREATE_CHAT',
    payload: { title: 'New Chat', folderId: 'folder-id' }
  })
}
```

### Available Actions

#### Chat Actions

- `CREATE_CHAT` - Create a new chat
- `CREATE_AND_OPEN_CHAT` - Create and immediately open a chat
- `UPDATE_CHAT` - Update chat properties
- `DELETE_CHAT` - Delete a chat

#### Folder Actions

- `CREATE_FOLDER` - Create a new folder
- `UPDATE_FOLDER` - Update folder properties
- `DELETE_FOLDER` - Delete a folder (moves chats to root)

#### Tab Actions

- `OPEN_TAB` - Open a chat in a new tab
- `CLOSE_TAB` - Close a tab
- `SET_ACTIVE_TAB` - Switch to a specific tab

#### Message Actions

- `ADD_MESSAGE` - Add a message to a chat
- `UPDATE_STREAMING_MESSAGE` - Update streaming message content
- `COMPLETE_STREAMING_MESSAGE` - Complete streaming and add to history
- `ADD_MESSAGE_TO_PARENT` - Add a branched message
- `UPDATE_CURRENT_PATH` - Update the current conversation path
- `SWITCH_BRANCH` - Switch the current branch

#### UI Actions

- `SET_SELECTED_NODE` - Select a node in the sidebar
- `UPDATE_SETTINGS` - Update application settings
- `TOGGLE_SIDEBAR` - Toggle sidebar visibility
- `SET_SIDEBAR_WIDTH` - Set sidebar width

## Adding New Actions

1. **Identify the domain**: Determine which reducer should handle the action
2. **Add to the appropriate reducer**: Update the relevant reducer file
3. **Update types**: Add the action type to the `AppAction` union type
4. **Test thoroughly**: Ensure the action works correctly

## State Persistence

State is automatically saved to localStorage with the following features:

- **Debounced saving**: 500ms delay to prevent excessive writes
- **Error handling**: Graceful fallback if localStorage fails
- **Loading states**: Proper handling of initial state loading

## Best Practices

1. **Keep reducers pure**: No side effects in reducer functions
2. **Use helpers**: Leverage utility functions for common operations
3. **Handle edge cases**: Always check for null/undefined values
4. **Maintain immutability**: Never mutate state directly
5. **Add proper types**: Ensure all actions and state are properly typed
