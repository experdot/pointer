# Pointer 架构设计

## 概述

类似 VSCode 界面布局的 LLM 聊天软件，样式风格是 Ant Design 现代风格，采用 `components/hooks/stores/services` 分层结构。

## 目录结构

```
src/renderer/src/
├── components/           # UI 组件
│   ├── layout/          # 布局（TitleBar, ActivityBar, Sidebar, EditorArea）
│   ├── panels/          # 侧边栏面板（Explorer, Search, Favorites, Tasks）
│   ├── editors/         # 编辑器（ChatEditor, SettingsEditor）
│   └── common/          # 通用组件
├── hooks/               # 自定义 Hooks
├── stores/              # Zustand 状态管理
├── services/            # 业务服务层
├── types/               # 类型定义
└── App.tsx
```

## 布局

```
┌─────────────────────────────────────────────────┐
│                   TitleBar                      │
├────┬────────────┬───────────────────────────────┤
│ A  │            │          EditorArea           │
│ c  │  Sidebar   │  ┌─────────────────────────┐  │
│ t  │            │  │         Tabs            │  │
│ i  │            │  ├─────────────────────────┤  │
│ v  │            │  │     Editor Content      │  │
│ i  │            │  └─────────────────────────┘  │
│ t  │            │                               │
│ y  │            │                               │
└────┴────────────┴───────────────────────────────┘
```

## 分层架构

```
UI Component → Hook → Service → Store
```

| 层        | 职责                             |
| --------- | -------------------------------- |
| Component | 纯渲染，通过 Hook 获取数据和操作 |
| Hook      | 组合 Store 状态和 Service 方法   |
| Service   | 业务逻辑，调用 Store action      |
| Store     | 状态管理                         |

## Store 分类

| 类型           | Store                                                                | 说明         |
| -------------- | -------------------------------------------------------------------- | ------------ |
| 需要 Service   | messagesStore, pagesStore, tasksStore, favoritesStore, settingsStore | 复杂业务逻辑 |
| 不需要 Service | layoutStore, tabsStore, searchStore                                  | 纯 UI 状态   |

## 设计规范

| 规范 | 要求                                         |
| ---- | -------------------------------------------- |
| UI   | 全部使用 Ant Design 标准组件，禁止自定义 CSS |
| 主题 | 通过 ConfigProvider + Design Token 定制      |
| 存储 | IndexedDB（Zustand persist 中间件）          |

## 技术栈

Electron + React 19 + TypeScript + Zustand + Ant Design + react-router-dom + @dnd-kit
