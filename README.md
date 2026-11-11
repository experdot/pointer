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

Pointer is a desktop AI chat app built around security and privacy. Choose your models, explore different ideas through conversation branches, and keep long conversations easy to organize, revisit, and continue. Chat history is stored locally as Markdown, making it easy to read, back up, and move while keeping you in control of your data.

Pointer offers a clean experience with no telemetry, activity tracking, or automatic error reporting. Model requests go directly to the service you configure.

Pointer does not support MCP, include built-in web search, or process audio and video. These boundaries reduce additional data sharing and complexity, keeping the focus on smooth, in-depth text conversations.

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

The release workflow uploads all three platforms to one draft. After review and publication, packages are available on the [Releases](https://github.com/experdot/pointer/releases) page:

- **Windows**: `pointer-<version>-setup.exe`
- **macOS**: `pointer-<version>-mac-<arch>.dmg` and `.zip`, for Intel (`x64`) and Apple Silicon (`arm64`)
- **Linux**: `pointer-<version>-linux-x86_64.AppImage` and `pointer-<version>-linux-amd64.deb`

macOS packages are currently unsigned, non-notarized **test builds** that require no Apple signing credentials in CI. Gatekeeper may block installation or launch, and macOS automatic updates are not supported for these builds. Install later test builds manually. See the [release guide](docs/release-guide.md) for platform coverage and validation requirements.

### Build from source

Requirements:

- Node.js 22 (>= 22.12; `.nvmrc` pins 22.16.0) (required by Vitest 5, which runs the test suite; the app itself runs on the Node bundled with Electron 35)
- pnpm 10.26.2 (pinned in `packageManager`)

```bash
# Clone the repository
git clone https://github.com/experdot/pointer.git
cd pointer

# Install dependencies
pnpm install --frozen-lockfile

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
pnpm test           # domain, kernel, IPC, mirrors and React DOM tests
pnpm test:coverage  # full-source coverage report and regression thresholds
pnpm test:stress    # large trees, seeded inputs and storage budgets
pnpm test:release   # release tag guards and draft metadata
pnpm test:e2e       # production build + real Electron desktop scenarios
pnpm smoke:kernel   # boot the kernel in a temp dir and verify the query/command/event chain
pnpm package:local  # build and package locally without uploading
pnpm release        # verify tag, build and upload a Windows release draft
```

Testing scope, isolation rules and verification records are documented in [docs/testing.md](docs/testing.md).

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
- [Release guide](docs/release-guide.md)（中文）— branches, tags, CI and release publication
- [Auto-update guide](docs/auto-update-guide.md)（中文）

## Contributing

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the code style (TypeScript, ESLint, Prettier) and run `pnpm lint && pnpm typecheck && pnpm test` before committing
4. Commit using conventional commits format
5. Open a Pull Request

## License

[MIT License](LICENSE)
