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

Pointer 是一款基于 Electron 35、React 19 和 TypeScript 构建的跨平台桌面 AI 聊天客户端。它连接任何 OpenAI 兼容接口（OpenAI、DeepSeek、兼容网关），专注于两件事：以树状结构管理对话分支，以及纯文本存储的聊天历史——每个对话都是工作区目录里的一个 Markdown 文件。

内核运行在主进程，是系统唯一的事实源：持久化、SQLite 索引、会话、AI 流式、检索与附件都由它负责。渲染进程只持有视图状态和一份由事件驱动的内核状态镜像，从不接触文件与路径。分层、数据流与存储布局见 [docs/architecture.md](docs/architecture.md)。

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

CI 会在 [Releases](https://github.com/experdot/pointer/releases) 页面发布 Windows 安装包：

- **Windows**：`pointer-<版本>-setup.exe`

macOS 与 Linux 的打包配置已经就绪，但尚未纳入自动发布：`pnpm build:mac`、`pnpm build:linux` 可在本地生成，当前发布工作流只构建 Windows。

### 从源码构建

环境要求：

- Node.js >= 22.12（运行测试套件的 Vitest 5 有此要求；应用本身运行在 Electron 35 自带的 Node 上）
- pnpm

```bash
# 克隆仓库
git clone https://github.com/experdot/pointer.git
cd pointer

# 安装依赖
pnpm install

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
pnpm test           # 单元测试（领域层 + 渲染进程镜像）
pnpm smoke:kernel   # 在临时目录启动内核，验证查询/命令/事件链路
pnpm release        # 构建并发布到 GitHub Releases
```

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
| 渲染     | react-markdown（流式）、Shiki、KaTeX、Mermaid                |
| 更新     | electron-updater（GitHub Releases）                          |

## 文档

- [架构说明](docs/architecture.md)——分层、数据流、契约与存储布局
- [自动更新指南](docs/auto-update-guide.md)
- [Windows 代码签名指南](docs/code-signing-guide.md)

## 贡献

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 遵循代码规范（TypeScript、ESLint、Prettier），提交前运行 `pnpm lint && pnpm typecheck && pnpm test`
4. 使用 conventional commits 格式提交
5. 提交 Pull Request

## 许可证

[MIT License](LICENSE)
