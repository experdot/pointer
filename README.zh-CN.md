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

Pointer 是一款基于 Electron、React 19 和 TypeScript 构建的跨平台桌面 AI 聊天客户端。它可连接多种 AI 模型 API（OpenAI、Claude、DeepSeek 等），提供高级对话管理功能，专注于知识组织和深度思考工作流。

## 功能特性

### 多模型支持
- 配置多个 AI 服务商（OpenAI GPT、Anthropic Claude、DeepSeek 等）
- 对话中无缝切换模型
- 流式响应，实时显示推理过程

### 对话分支管理
- 树状消息历史结构，支持版本控制
- 创建并切换对话分支
- 跨分支上下文继承
- 便捷的历史记录导航

### 知识组织
- 基于文件夹的层级组织
- 消息收藏和标记
- 多标签页并行工作流
- 全局搜索与关键词高亮

### 数据管理
- 导入 ChatGPT 和 DeepSeek 导出数据
- 导出对话备份
- 本地数据存储，注重隐私
- 批量操作和拖拽排序

### 任务监控
- 全局 AI 生成任务管理
- 实时任务状态与取消
- 跨页面问答溯源

## 安装

### 下载

从 [Releases](https://github.com/experdot/pointer/releases) 页面下载适合您平台的最新版本：

- **Windows**：`.exe` 安装包
- **macOS**：`.dmg` 安装包
- **Linux**：`.AppImage` 或 `.deb` 安装包

### 从源码构建

环境要求：
- Node.js 18+
- pnpm

```bash
# 克隆仓库
git clone https://github.com/experdot/pointer.git
cd pointer

# 安装依赖
pnpm install

# 开发模式运行
pnpm dev

# 为您的平台构建
pnpm build:win    # Windows
pnpm build:mac    # macOS
pnpm build:linux  # Linux
```

## 配置

1. 启动应用
2. 打开设置
3. 添加新的 AI 模型配置：
   - **名称**：配置的显示名称
   - **API 地址**：API URL（如 `https://api.openai.com/v1`）
   - **API 密钥**：您的访问令牌
   - **模型**：模型标识符（如 `gpt-4o`、`claude-3-5-sonnet`）
4. 设为默认并测试连接

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端 | React 19、TypeScript、Ant Design、Tailwind CSS |
| 桌面端 | Electron 35、electron-vite |
| 状态管理 | Zustand、Immer |
| 构建工具 | Vite、Electron Builder |
| 编辑器 | Monaco Editor |
| 渲染 | Shiki（语法高亮）、Streamdown（流式 Markdown） |

## 项目结构

```
src/
├── main/              # Electron 主进程
│   ├── aiHandler.ts     # AI API 请求处理
│   ├── ipcHandlers.ts   # IPC 通信
│   └── autoUpdater.ts   # 自动更新逻辑
├── preload/           # 预加载脚本（上下文桥接）
└── renderer/          # React 应用
    └── src/
        ├── components/    # UI 组件
        ├── services/      # 业务逻辑
        ├── stores/        # Zustand 状态管理
        ├── hooks/         # 自定义 React Hooks
        ├── features/      # 功能模块
        └── utils/         # 工具函数
```

## 贡献

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 遵循代码规范（TypeScript、ESLint、Prettier）
4. 使用 conventional commits 格式提交
5. 提交 Pull Request

## 许可证

[MIT License](LICENSE)
