# Pointer 智能聊天助手

一个基于 Electron + React + TypeScript 构建的现代化AI聊天应用，**独有的文件夹管理系统和OpenAI/DeepSeek数据无缝导入**，让您的AI对话更有序高效。

## ✨ 主要特性

### 🤖 多模型AI对话

- 支持多个AI模型配置 (OpenAI GPT、Claude、DeepSeek等)
- 流式对话响应，实时显示生成内容，支持推理内容显示
- 模型间快速切换
- 连接测试和配置验证

### 💬 智能聊天管理

- **消息分支系统**: 支持对话分支和历史版本切换
- **聊天历史树**: 分层组织和管理聊天记录
- **标签页管理**: 多聊天窗口并行工作
- **消息收藏**: 重要消息标记和快速访问
- **消息折叠**: 长对话的便捷查看模式

### 🔍 强大的搜索功能

- **全局搜索**: 跨所有聊天记录的内容搜索
- **实时搜索**: 输入时即时显示结果
- **高亮显示**: 搜索关键词智能高亮
- **结果预览**: 搜索结果上下文片段展示

### 📁 文件夹组织

- **层级文件夹**: 支持嵌套文件夹结构
- **拖拽排序**: 直观的聊天和文件夹管理
- **批量操作**: 多选模式批量管理聊天

### 📤 导入导出功能

- **聊天导出**: 支持Markdown格式导出
- **历史导入**: 支持OpenAI和DeepSeek聊天历史导入
- **截图功能**: 对话内容一键截图到剪贴板
- **数据备份**: 完整的聊天数据备份和恢复

### 🎨 用户体验 (TODO)

- **现代化UI**: 基于Ant Design的美观界面
- **主题切换**: 明暗主题自由切换
- **响应式设计**: 窗口大小自适应
- **键盘快捷键**: 高效的操作体验
- **国际化**: 中英文界面和本地化支持

## 🚀 快速开始

### 系统要求

- Node.js 18+
- npm 或 pnpm 包管理器
- Windows 10+, macOS 10.15+, 或 Linux

### 安装依赖

```bash
# 使用 pnpm (推荐)
pnpm install

# 或使用 npm
npm install
```

### 开发模式

```bash
# 启动开发服务器
pnpm dev

# 或使用 npm
npm run dev
```

应用将在开发模式下启动，支持热重载和开发者工具。

### 构建应用

```bash
# Windows 平台
pnpm build:win

# macOS 平台
pnpm build:mac

# Linux 平台
pnpm build:linux

# 所有平台
pnpm build
```

## 🛠️ 技术架构

### 核心技术栈

- **Electron**: 跨平台桌面应用框架
- **React 19**: 用户界面库
- **TypeScript**: 类型安全的JavaScript
- **Ant Design**: UI组件库
- **Vite**: 快速构建工具

### 关键依赖

- `react-markdown`: Markdown渲染支持
- `mermaid`: 图表绘制支持
- `katex`: 数学公式渲染
- `html2canvas`: 截图功能
- `rehype-highlight`: 代码高亮
- `uuid`: 唯一标识符生成

### 项目结构

```
src/
├── main/                 # Electron 主进程
│   ├── aiHandler.ts     # AI服务处理器
│   └── index.ts         # 主进程入口
├── renderer/            # 渲染进程 (React)
│   └── src/
│       ├── components/   # React组件
│       │   ├── chat/    # 聊天相关组件
│       │   ├── sidebar/ # 侧边栏组件
│       │   └── settings/# 设置页面组件
│       ├── store/       # 状态管理
│       ├── utils/       # 工具函数
│       └── types/       # TypeScript类型定义
├── preload/             # 预加载脚本
└── shared/              # 共享类型定义
```

## ⚙️ 配置说明

### LLM模型配置

1. 打开设置页面
2. 进入"LLM设置"标签页
3. 点击"新增配置"按钮
4. 填写以下信息：
   - **配置名称**: 便于识别的名称
   - **API Host**: 模型服务的API地址
   - **API Key**: 访问密钥
   - **模型名称**: 具体的模型标识符

### 支持的AI服务

- OpenAI (GPT-3.5, GPT-4, GPT-4-turbo等)
- Anthropic Claude
- DeepSeek
- 其他兼容OpenAI API格式的服务

## 📋 功能详解

### 消息分支系统

应用支持对话的分支管理，每个消息可以有多个回复分支：

- 点击消息右上角的分支导航器切换不同回复
- 从任意历史消息继续新的对话分支
- 分支间独立，互不影响

### 聊天历史管理

- **文件夹组织**: 创建文件夹对聊天进行分类
- **标签页系统**: 同时打开多个聊天窗口
- **消息收藏**: 重要消息标记星号收藏
- **全局搜索**: 快速找到历史对话内容

### 导入导出功能

- **导入**: 支持从OpenAI ChatGPT和DeepSeek导入聊天历史
- **导出**: 聊天记录导出为Markdown格式
- **截图**: 一键截图对话内容到剪贴板

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

### 开发工作流

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 代码规范

- 使用 TypeScript 进行类型安全开发
- 遵循 ESLint 和 Prettier 配置
- 组件使用函数式组件和 Hooks
- 提交信息使用常规提交格式

## 🐛 问题反馈

如果您遇到问题或有功能建议，请：

1. 查看现有的 Issues
2. 创建新的 Issue 并提供详细信息
3. 包含错误截图或日志信息

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢以下开源项目：

- [Electron](https://electronjs.org/)
- [React](https://reactjs.org/)
- [Ant Design](https://ant.design/)
- [TypeScript](https://www.typescriptlang.org/)

---

**享受智能对话的乐趣！** 🎉
