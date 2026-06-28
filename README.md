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

Pointer is a cross-platform desktop AI chat client built with Electron, React 19, and TypeScript. It connects to various AI model APIs (OpenAI, Claude, DeepSeek, etc.) and provides advanced conversation management with a focus on knowledge organization and deep thinking workflows.

## Features

### Multi-Model Support

- Configure multiple llm configurations (OpenAI GPT, DeepSeek, etc.)
- Switch between models seamlessly during conversations

### Conversation Branch Management

- Tree-structured message history with version control
- Create and switch between conversation branches
- Maintain context inheritance across branches
- Navigate conversation history with ease

### Knowledge Organization

- Folder-based hierarchical organization
- Message bookmarking and tagging
- Parallel tab workflow for multiple conversations
- Global search with keyword highlighting

### Data Management

- Import data from ChatGPT and DeepSeek exports
- Export conversations for backup
- Local data storage with privacy focus
- Batch operations and drag-and-drop sorting

## Installation

### Download

Download the latest release for your platform from the [Releases](https://github.com/experdot/pointer/releases) page:

- **Windows**: `.exe` installer
- **macOS**: `.dmg` installer
- **Linux**: `.AppImage` or `.deb` package

### Build from Source

Requirements:

- Node.js 18+
- pnpm

```bash
# Clone the repository
git clone https://github.com/experdot/pointer.git
cd pointer

# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for your platform
pnpm build:win    # Windows
pnpm build:mac    # macOS
pnpm build:linux  # Linux
```

## Configuration

1. Launch the application
2. Open Settings
3. Add a new AI model configuration:
   - **Name**: Display name for the configuration
   - **API Endpoint**: The API URL (e.g., `https://api.openai.com/v1`)
   - **API Key**: Your access token
   - **Model**: Model identifier (e.g., `gpt-4o`, `claude-3-5-sonnet`)
4. Set as default and test the connection

## Tech Stack

| Category  | Technologies                                                 |
| --------- | ------------------------------------------------------------ |
| Frontend  | React 19, TypeScript, Ant Design, Tailwind CSS               |
| Desktop   | Electron 35, electron-vite                                   |
| State     | Zustand, Immer                                               |
| Build     | Vite, Electron Builder                                       |
| Editor    | Monaco Editor                                                |
| Rendering | Shiki (syntax highlighting), Streamdown (streaming markdown) |

## Project Structure

```
src/
├── main/              # Electron main process
│   ├── aiHandler.ts     # AI API request handling
│   ├── ipcHandlers.ts   # IPC communication
│   └── autoUpdater.ts   # Auto-update logic
├── preload/           # Preload scripts (context bridge)
└── renderer/          # React application
    └── src/
        ├── components/    # UI components
        ├── services/      # Business logic
        ├── stores/        # Zustand state management
        ├── hooks/         # Custom React hooks
        ├── features/      # Feature modules
        └── utils/         # Utility functions
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the coding standards (TypeScript, ESLint, Prettier)
4. Commit using conventional commits format
5. Open a Pull Request

## License

[MIT License](LICENSE)
