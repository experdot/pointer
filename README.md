# Pointer

<p align="center">
  <img src="./resources/icon.png" alt="Pointer Logo" width="128" height="128">
</p>

<p align="center">
  <strong>A secure AI chat application crafted for deep thinkers</strong>
</p>

<p align="center">
  <a href="https://github.com/experdot/pointer/releases"><img src="https://img.shields.io/github/v/release/experdot/pointer" alt="Release"></a>
  <a href="https://github.com/experdot/pointer/releases"><img src="https://img.shields.io/github/downloads/experdot/pointer/total" alt="Downloads"></a>
  <a href="https://github.com/experdot/pointer/blob/main/LICENSE"><img src="https://img.shields.io/github/license/experdot/pointer" alt="License"></a>
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> | <strong>English</strong>
</p>

## Overview

Pointer is a cross-platform desktop AI chat client built with Electron 35, React 19 and TypeScript. It talks to any OpenAI-compatible API (OpenAI, DeepSeek, compatible gateways) and centers on two things: conversation branches kept as a tree, and data you can read yourself — every conversation is a Markdown file inside a workspace folder.

The kernel runs in the main process and is the single source of truth: it owns persistence, the SQLite index, sessions, AI streaming, search and attachments. The renderer holds view state plus a mirror of kernel state fed by events, and never touches files or paths. See [docs/architecture.md](docs/architecture.md) for the layering, data flow and storage layout.

## Features

### Models

- Configure multiple LLMs (base URL, API key, model name) and reusable model parameter configs (system prompt, temperature, top-p)
- Pick the LLM per message, so a conversation can mix models
- Streaming responses with reasoning content when the provider reports it

### Conversation branches

- Tree-structured message history: regenerate or continue creates sibling branches
- Switch branches and inherit context along the selected path
- Outline and topics for long conversations, plus in-conversation search

### Knowledge organization

- Folder hierarchy that maps to real directories on disk
- Starred pages and a multi-tab workspace for parallel conversations
- Workspace-wide search with keyword highlighting, filtered by role, time range and folder
- Message queue per conversation: queued prompts are sent automatically while the conversation is idle

### Data management

- Import ChatGPT (OpenAI export), DeepSeek and Pointer data
- Export through a source × format matrix (messages, text snippet, table block, code block → Markdown, TXT, HTML, CSV) with preview, editing and screenshot copy
- Multiple accounts and workspaces, each workspace an ordinary folder that can be synced or committed
- All data stays local

## Installation

### Download

CI publishes a Windows installer on the [Releases](https://github.com/experdot/pointer/releases) page:

- **Windows**: `pointer-<version>-setup.exe`

macOS and Linux packages are configured but not published automatically yet: `pnpm build:mac` and `pnpm build:linux` produce them locally, while the release workflow currently builds Windows only.

### Build from source

Requirements:

- Node.js >= 22.12 (required by Vitest 5, which runs the test suite; the app itself runs on the Node bundled with Electron 35)
- pnpm

```bash
# Clone the repository
git clone https://github.com/experdot/pointer.git
cd pointer

# Install dependencies
pnpm install

# Run in development mode
pnpm dev
```

## Development

```bash
pnpm dev            # development server with hot reload
pnpm start          # run the production build locally
pnpm build          # type check + build
pnpm build:win      # Windows build
pnpm build:mac      # macOS build
pnpm build:linux    # Linux build
pnpm build:unpack   # build without packaging
pnpm lint           # ESLint (warnings fail the run)
pnpm format         # Prettier
pnpm typecheck      # type check main + renderer
pnpm test           # unit tests (domain + renderer mirror)
pnpm smoke:kernel   # boot the kernel in a temp dir and verify the query/command/event chain
pnpm release        # build and publish to GitHub Releases
```

## Configuration

1. Launch the application and open Settings
2. Add an LLM configuration under "LLM 配置":
   - **Name**: display name for the configuration
   - **API endpoint**: an OpenAI-compatible base URL (e.g. `https://api.openai.com/v1`)
   - **API key**: your access token
   - **Model**: model identifier (e.g. `gpt-4o`, `deepseek-chat`)
3. Optionally add a model parameter config (system prompt, temperature, top-p) and set the defaults
4. Test the connection from the same panel

## Data and privacy

- Application data (accounts, session, per-account settings) lives in the Electron user data directory.
- Every workspace is an ordinary folder: pages are `<folder>/<page>.pointer.md` — Markdown you can open in any editor or commit to git — while kernel-private data lives in `.pointer/` (folder metadata, view state, SQLite index, attachments, message queues).
- The SQLite index is derived data: delete it and it is rebuilt by rescanning the workspace.
- Edits made to page files outside the app are detected and reflected in the UI.
- Custom workspace directories are supported, so conversations can live in a folder you already back up or sync.

## Project structure

```
src/
├── main/                 # Electron main process
│   ├── index.ts          # window, kernel assembly, IPC wiring
│   ├── runtime/          # kernel: persistence, SQLite index, sessions, AI streaming, search
│   ├── ipc/              # runtimeIpc.ts (renderer entry), windowIpc.ts
│   ├── runtimeHost.ts    # dialogs and system integration injected into the kernel
│   └── autoUpdater.ts
├── preload/              # context bridge: runtime / electronWindow / shortcuts
├── renderer/src/         # React UI (components, stores, services, hooks, runtime mirror)
└── shared/
    ├── domain/           # pure entities, invariants and algorithms
    └── contracts/        # RuntimePort: queries, commands, events
```

## Tech stack

| Category  | Technologies                                                     |
| --------- | ---------------------------------------------------------------- |
| Frontend  | React 19, TypeScript, Ant Design                                 |
| Desktop   | Electron 35, electron-vite                                       |
| State     | Zustand (Immer middleware in the update store)                   |
| Storage   | `.pointer.md` files, node:sqlite index (FTS5, trigram tokenizer) |
| Build     | Vite, Electron Builder                                           |
| Editor    | Monaco Editor                                                    |
| Rendering | react-markdown (streaming), Shiki, KaTeX, Mermaid                |
| Updates   | electron-updater (GitHub Releases)                               |

## Documentation

- [Architecture](docs/architecture.md) — layering, data flow, contracts, storage layout
- [Auto-update guide](docs/auto-update-guide.md)（中文）
- [Windows code signing guide](docs/code-signing-guide.md)（中文）

## Contributing

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the code style (TypeScript, ESLint, Prettier) and run `pnpm lint && pnpm typecheck && pnpm test` before committing
4. Commit using conventional commits format
5. Open a Pull Request

## License

[MIT License](LICENSE)
