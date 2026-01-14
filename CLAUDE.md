# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Install dependencies
pnpm install

# Development mode with hot reload
pnpm dev

# Type checking (runs both node and web)
pnpm typecheck

# Linting
pnpm lint

# Code formatting
pnpm format

# Build for production (includes typecheck)
pnpm build

# Platform-specific builds
pnpm build:win    # Windows
pnpm build:mac    # macOS
pnpm build:linux  # Linux
```

## Architecture Overview

Pointer is an Electron desktop AI chat application with a VS Code-like interface. The codebase follows a three-process Electron architecture.

### Process Structure

- **Main Process** (`src/main/`): Electron main process handling system operations
  - `aiHandler.ts` - OpenAI-compatible API streaming via SSE, manages concurrent requests with AbortController
  - `ipcHandlers.ts` - IPC communication bridge
  - `attachmentHandler.ts` - File attachment management in userData directory
  - `autoUpdater.ts` - electron-updater integration

- **Preload** (`src/preload/`): Context bridge exposing safe APIs to renderer

- **Renderer** (`src/renderer/src/`): React 19 application

### State Management Pattern

The app uses Zustand with a **Store Registry** pattern for dependency inversion:

```
stores/registry.ts      - Central access point via `stores` object
stores/interfaces/      - TypeScript interfaces defining store contracts
stores/initStores.ts    - Registry initialization at app startup
```

Each store exposes a `get[Name]StoreInterface()` function that returns an interface implementation, enabling loose coupling between services and stores.

**Core Stores:**

- `pagesStore` - Chat session metadata (name, folder, timestamps)
- `messagesStore` - Message cache with lazy loading per page
- `foldersStore` - Folder hierarchy for organization
- `tabsStore` - Multi-tab navigation with history
- `settingsStore` - LLM configurations and app preferences
- `navigationStore` - Message tree navigation (branching conversations)

### Data Layer

**IndexedDB** (`persistence/`):

- Multi-account support via separate databases (`pointer-{accountId}`)
- Separate accounts DB (`pointer-accounts`) for account management
- Messages stored separately from page metadata for performance

**Key data separation:**

- `PageRecord` - Page metadata without messages
- `MessagesRecord` - Messages, topics, and tree navigation state per page

### Message Tree Structure

Conversations use a tree structure for branching:

- Messages have `parentId` for tree relationships
- `rootMessageId`, `leafMessageId`, `selectedMessageId` track navigation state
- `Topic` entities mark conversation segments within the tree

### Services Layer

Services (`services/`) orchestrate business logic using the store registry:

- `aiService.ts` - AI request/response handling
- `streamingManager.ts` - SSE stream lifecycle management
- `navigationService.ts` - Message tree traversal
- `messagesService.ts` - Message CRUD operations

### Component Organization

```
components/
├── layout/          # Shell: TitleBar, ActivityBar, Sidebar, EditorArea, Tabs
├── editors/         # Tab content: ChatEditor, SettingsEditor
├── panels/          # Sidebar panels: Explorer, Search
└── common/          # Shared components
```

### Key Technical Details

- **Path alias**: `@renderer/*` maps to `src/renderer/src/*`
- **Streaming**: Uses `eventsource-parser` for SSE parsing, supports `reasoning_content` field for reasoning models
- **Markdown rendering**: Shiki for syntax highlighting, Streamdown for streaming markdown
- **Drag-and-drop**: @dnd-kit for sortable lists
- **Editor**: Monaco Editor for code blocks

### UI Framework Notes

- Uses Ant Design (antd) - prefer official components and patterns
- Tailwind CSS for utility styling
- Sass for component-scoped styles (`.css` files use SCSS)
