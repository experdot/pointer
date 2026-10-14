# Agents.md

This file provides guidance to coding agent when working with code in this repository.

## Project Overview

Pointer is a cross-platform desktop AI chat application built with Electron, React 19, and TypeScript. It features tree-structured conversation branches, multi-model support (OpenAI, Claude, DeepSeek, etc.), and a VSCode-like interface with tabs, sidebar, and activity bar.

## Commands

```bash
# Development
pnpm dev              # Start development server with hot reload
pnpm start            # Run preview mode

# Code quality
pnpm lint             # Run ESLint
pnpm format           # Run Prettier
pnpm typecheck        # Type check both main and renderer processes
pnpm test             # Run unit tests (domain + renderer mirror)
pnpm smoke:kernel     # Boot the kernel in a temp dir and verify the full command/query chain

# Building
pnpm build            # Build with type checking
pnpm build:win        # Windows build
pnpm build:mac        # macOS build
pnpm build:linux      # Linux build
pnpm build:unpack     # Build without packaging (for testing)

# Release
pnpm release          # Build and publish to GitHub Releases
pnpm release:draft    # Build for release testing (no publish)
```

## Architecture

### Three-Tier Electron Structure

- **Domain** (`src/shared/domain/`): pure TypeScript entities, invariants and algorithms
  (message tree, topics, workspace layout, `.pointer.md` codec, importers). No Electron, no IO.
- **Contracts** (`src/shared/contracts/`): the single `RuntimePort` surface — queries, commands, events.
- **Kernel** (`src/main/runtime/`): system of record. Owns persistence (atomic writes), the SQLite
  index, sessions, AI streaming, search, attachments and secrets. Exposed to the renderer only
  through `src/main/ipc/runtimeIpc.ts`.
- **Presentation** (`src/renderer/src/`): React UI holding view state plus a mirror of kernel state
  fed by events. It never touches paths, files or the filesystem.
- **Preload** (`src/preload/`): exposes `window.runtime` (query/command/subscribe),
  `window.electronWindow` and `window.shortcuts` only.

Data flow: UI → `services/*` → `stores/*` → `runtime/client` → kernel command → kernel event →
mirror store → UI. See `docs/architecture.md` for the rationale and migration status.

### Renderer Organization

```
 runtime/      # 内核客户端与镜像装配（client.ts, bootstrap.ts, generation.ts）
components/
  layout/       # MainLayout, ActivityBar, Sidebar, EditorArea, Tabs, TitleBar
  editors/      # ChatEditor, SettingsEditor, ExportEditor, WelcomePage
  panels/       # Explorer (conversation tree), Search
  common/       # Reusable components

stores/         # Zustand mirrors + view state (messagesStore, pagesStore, settingsStore, etc.)
services/       # Thin wrappers that issue kernel commands (messagesService, pagesService, ...)
hooks/          # Custom hooks (useChat, useChatStreaming, usePages, etc.)
utils/          # Utilities including tab registry system
types/shared.ts # Re-export of domain + contract types used by the UI
features/       # Feature modules (export plugins, etc.)
```

### Key Architectural Patterns

1. **Message Tree Structure**: Three-level hierarchy - Page (conversation) → Message branches (for branching conversations) → Individual messages

2. **Tab Registry System** (`utils/tabRegistry.ts`): Plugin-style registration for different tab types (chat, settings, export, welcome)

3. **State Management**: Zustand stores hold view state and a mirror of kernel state; all writes go
   through kernel commands and return as events (no local persistence logic)

4. **AI Streaming**: The kernel owns the request lifecycle; the renderer only reacts to
   `chat.delta` / `chat.reasoning` / `chat.completed` events

## Code Style

- Single quotes, no semicolons, 100 char line width
- Prefer Ant Design components and patterns
- Decompose into small, focused components
- Chinese language context in some documentation

## Key Files

| File                                       | Purpose                                       |
| ------------------------------------------ | --------------------------------------------- |
| `src/shared/domain/index.ts`               | Domain entities, invariants, algorithms       |
| `src/shared/contracts/queries.ts`          | Query contract (read side)                    |
| `src/shared/contracts/commands.ts`         | Command contract (write side)                 |
| `src/main/runtime/RuntimeCore.ts`          | Kernel assembly, session switching, dispatch  |
| `src/main/runtime/WorkspaceStore.ts`       | Page tree, conversations, disk reconciliation |
| `src/main/runtime/ChatEngine.ts`           | Streaming lifecycle and queue drain           |
| `src/renderer/src/runtime/bootstrap.ts`    | Kernel mirror wiring for the UI               |
| `src/renderer/src/stores/messagesStore.ts` | Conversation mirror and commands              |
| `src/renderer/src/hooks/useChat.ts`        | Core chat logic hook                          |
| `src/renderer/src/utils/tabRegistry.ts`    | Tab type registration system                  |
