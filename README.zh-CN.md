# Pointer

<p align="center">
  <img src="./resources/icon.png" alt="Pointer Logo" width="128" height="128">
</p>

<p align="center">
  <strong>为深度思考者打造的安全 AI 聊天应用</strong>
</p>

<p align="center">
  <a href="https://github.com/experdot/pointer/releases"><img src="https://img.shields.io/github/v/release/experdot/pointer" alt="Release"></a>
  <a href="https://github.com/experdot/pointer/releases"><img src="https://img.shields.io/github/downloads/experdot/pointer/total" alt="Downloads"></a>
  <a href="https://github.com/experdot/pointer/blob/main/LICENSE"><img src="https://img.shields.io/github/license/experdot/pointer" alt="License"></a>
</p>

<p align="center">
  <strong>中文</strong> | <a href="README.md">English</a>
</p>

## 简介

Pointer 是一款注重安全与隐私的桌面 AI 聊天应用。自由选择模型，用树状分支探索不同思路，让长对话更容易整理、回顾和延续。聊天记录以 Markdown 保存在本地，方便阅读、备份和迁移，数据由你掌握。

应用纯净绿色，不含遥测、行为追踪或自动错误上报。模型请求直接发送至你配置的服务。

Pointer 不支持 MCP，不内置联网搜索，也不提供音频、视频处理。通过减少额外的数据流转与功能负担，专注于流畅、深入的文本交流。

## 功能特性

### 模型

- 配置多个 LLM（API 地址、API 密钥、模型名）与可复用的模型参数配置（系统提示词、temperature、top-p）
- 按消息选择模型，同一会话可以混用不同模型
- 流式响应，供应商返回思考内容时一并展示

### 对话分支

- 树状消息历史：重新生成与继续都会产生同级分支
- 切换分支，沿选中路径继承上下文
- 长对话大纲与话题分组，会话内搜索

### 知识组织

- 文件夹层级，直接映射为磁盘上的真实目录
- 页面星标，多页签并行工作
- 全局搜索与关键词高亮，可按角色、时间范围与文件夹筛选
- 每个会话独立的消息队列：空闲时自动按序发送排队的提问

### 数据管理

- 导入 ChatGPT（OpenAI 导出）、DeepSeek 与 Pointer 数据
- 导出采用「数据源 × 格式」矩阵（消息、文本片段、表格块、代码块 → Markdown、TXT、HTML、CSV），支持预览、编辑与截图复制
- 多账户与多工作区，工作区就是普通文件夹，可直接同步或提交到 git
- 全部数据保存在本地

## 安装

### 下载

发布工作流将三个平台的产物上传到同一个草稿；验收并公开后，可从 [Releases](https://github.com/experdot/pointer/releases) 下载：

- **Windows**：`pointer-<版本>-setup.exe`
- **macOS**：`pointer-<版本>-mac-<架构>.dmg` 和 `.zip`，分别支持 Intel（`x64`）和 Apple Silicon（`arm64`）
- **Linux**：`pointer-<版本>-linux-x86_64.AppImage` 和 `pointer-<版本>-linux-amd64.deb`

macOS 当前提供未签名、未公证的**测试包**，CI 无需 Apple 签名凭据。系统 Gatekeeper 可能阻止安装或启动，这些测试包不支持 macOS 自动更新；后续测试版本需要手动下载安装。平台范围与验收要求见 [发布指南](docs/release-guide.md)。

### 从源码构建

环境要求：

- Node.js 22（>= 22.12，`.nvmrc` 固定 22.16.0）（运行测试套件的 Vitest 5 有此要求；应用本身运行在 Electron 35 自带的 Node 上）
- pnpm 10.26.2（由 `packageManager` 固定）

```bash
# 克隆仓库
git clone https://github.com/experdot/pointer.git
cd pointer

# 安装依赖
pnpm install --frozen-lockfile

# 开发模式运行
pnpm dev
```

## 开发

```bash
pnpm dev            # 开发模式，热重载
pnpm start          # 本地运行生产构建
pnpm build          # 类型检查 + 构建
pnpm build:win      # Windows 构建
pnpm build:mac      # macOS 构建
pnpm build:linux    # Linux 构建
pnpm build:unpack   # 只构建，不打包
pnpm lint           # ESLint（出现 warning 也会失败）
pnpm format         # Prettier
pnpm typecheck      # 主进程 + 渲染进程类型检查
pnpm test           # 领域、内核、IPC、镜像和 React DOM 测试
pnpm test:coverage  # 全量源码覆盖率及回退门槛
pnpm test:stress    # 大树、固定种子输入和落盘预算
pnpm test:release   # 发布 tag 校验与草稿元数据回归
pnpm test:e2e       # 生产构建 + 真实 Electron 桌面场景
pnpm smoke:kernel   # 在临时目录启动内核，验证查询/命令/事件链路
pnpm package:local  # 构建并本地打包，不上传
pnpm release        # 校验 tag、构建并上传 Windows 发布草稿
```

测试范围、隔离约束和验证记录见 [docs/testing.md](docs/testing.md)。

## 配置

1. 启动应用并打开设置
2. 在「LLM 配置」中新增一条配置：
   - **名称**：配置的显示名称
   - **API 地址**：OpenAI 兼容的基础地址（如 `https://api.openai.com/v1`）
   - **API 密钥**：你的访问令牌
   - **模型**：模型标识符（如 `gpt-4o`、`deepseek-chat`）
3. 可选：新增「模型配置」（系统提示词、temperature、top-p）并设为默认
4. 在同一个面板里测试连接

## 数据与隐私

- 应用数据（账户、会话记录、账户级设置）位于 Electron 的用户数据目录。
- 每个工作区都是普通文件夹：页面是 `<文件夹>/<页面>.pointer.md`，正文是可以用任何编辑器打开、也可以提交到 git 的 Markdown；内核私有数据放在 `.pointer/`（文件夹元数据、展示层状态、SQLite 索引、附件、消息队列）。
- SQLite 索引是派生数据：删掉后会通过重新扫描工作区自动重建。
- 在应用之外修改页面文件会被检测到，并反映到界面上。
- 支持自定义工作区目录，对话可以放在你已经在备份或同步的文件夹里。

## 项目结构

```
src/
├── main/                 # Electron 主进程
│   ├── index.ts          # 窗口、内核装配、IPC 接线
│   ├── runtime/          # 内核：持久化、SQLite 索引、会话、AI 流式、检索
│   ├── ipc/              # runtimeIpc.ts（渲染进程入口）、windowIpc.ts
│   ├── runtimeHost.ts    # 注入内核的对话框与系统集成
│   └── autoUpdater.ts
├── preload/              # 上下文桥接：runtime / electronWindow / shortcuts
├── renderer/src/         # React 界面（组件、store、service、hook、内核镜像）
└── shared/
    ├── domain/           # 纯 TypeScript 实体、不变量与算法
    └── contracts/        # RuntimePort：查询、命令、事件
```

## 技术栈

| 类别     | 技术                                                         |
| -------- | ------------------------------------------------------------ |
| 前端     | React 19、TypeScript、Ant Design                             |
| 桌面端   | Electron 35、electron-vite                                   |
| 状态管理 | Zustand（Immer 中间件仅用于更新 store）                      |
| 存储     | `.pointer.md` 文件、node:sqlite 索引（FTS5，trigram 分词器） |
| 构建工具 | Vite、Electron Builder                                       |
| 编辑器   | Monaco Editor                                                |
| 渲染     | react-markdown（流式）、rehype-highlight、KaTeX、Mermaid     |
| 更新     | electron-updater（GitHub Releases）                          |

## 文档

- [架构说明](docs/architecture.md)——分层、数据流、契约与存储布局
- [发布指南](docs/release-guide.md)——分支、版本号、tag、CI 与正式发布
- [自动更新指南](docs/auto-update-guide.md)

## 贡献

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 遵循代码规范（TypeScript、ESLint、Prettier），提交前运行 `pnpm lint && pnpm typecheck && pnpm test`
4. 使用 conventional commits 格式提交
5. 提交 Pull Request

## 许可证

[MIT License](LICENSE)
