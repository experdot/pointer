# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

- **Main Process** (`src/main/`): Window management, IPC handlers, AI API streaming
- **Preload** (`src/preload/`): Context bridge exposing APIs to renderer
- **Renderer** (`src/renderer/src/`): React application

### Renderer Organization

```
components/
  layout/       # MainLayout, ActivityBar, Sidebar, EditorArea, Tabs, TitleBar
  editors/      # ChatEditor, SettingsEditor, ExportEditor, WelcomePage
  panels/       # Explorer (conversation tree), Search
  common/       # Reusable components

stores/         # Zustand stores (messagesStore, pagesStore, settingsStore, etc.)
services/       # Business logic (aiService, messagesService, pagesService, etc.)
hooks/          # Custom hooks (useChat, useChatStreaming, usePages, etc.)
utils/          # Utilities including tab registry system
types/          # TypeScript type definitions (ChatMessage, LLMConfig, Account, etc.)
features/       # Feature modules (export plugins, etc.)
persistence/    # Data persistence layer initialization
```

### Key Architectural Patterns

1. **Message Tree Structure**: Three-level hierarchy - Page (conversation) → Message branches (for branching conversations) → Individual messages

2. **Tab Registry System** (`utils/tabRegistry.ts`): Plugin-style registration for different tab types (chat, settings, export, welcome)

3. **State Management**: Zustand stores with Immer for immutable updates, file-based persistence via IPC

4. **AI Streaming**: Main process handles API calls; renderer receives streamed responses via IPC

## Code Style

- Single quotes, no semicolons, 100 char line width
- Prefer Ant Design components and patterns
- Decompose into small, focused components
- Chinese language context in some documentation

## Key Files

| File | Purpose |
|------|---------|
| `src/main/aiHandler.ts` | AI API streaming and request handling |
| `src/main/ipcHandlers.ts` | IPC event handlers |
| `src/renderer/src/stores/messagesStore.ts` | Message state and tree structure |
| `src/renderer/src/hooks/useChat.ts` | Core chat logic hook |
| `src/renderer/src/utils/tabRegistry.ts` | Tab type registration system |
