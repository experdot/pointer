# Pointer 开发顺序

基于依赖关系和功能优先级的开发顺序规划。

## 阶段 1：基础设施

| 顺序 | 模块                    | 说明                               |
| ---- | ----------------------- | ---------------------------------- |
| 1.1  | types/                  | 类型定义                           |
| 1.2  | utils/indexedDB         | Zustand persist IndexedDB 适配器   |
| 1.3  | stores/accountStore     | 账户管理（全局，不隔离）           |
| 1.4  | services/accountService | 账户切换、数据库重置               |
| 1.5  | App.tsx                 | Ant Design ConfigProvider 主题配置 |

## 阶段 2：通用组件

| 顺序 | 模块                            | 说明       |
| ---- | ------------------------------- | ---------- |
| 2.1  | components/common/ContextMenu   | 右键菜单   |
| 2.2  | components/common/ConfirmDialog | 确认对话框 |

## 阶段 3：布局框架

| 顺序 | 模块                          | 说明                             |
| ---- | ----------------------------- | -------------------------------- |
| 3.1  | stores/layoutStore            | 布局状态（侧边栏宽度、面板展开） |
| 3.2  | components/layout/TitleBar    | 标题栏                           |
| 3.3  | components/layout/ActivityBar | 活动栏（图标导航）               |
| 3.4  | components/layout/Sidebar     | 侧边栏容器                       |
| 3.5  | components/layout/EditorArea  | 编辑器区域容器                   |

## 阶段 4：标签页系统

| 顺序 | 模块                   | 说明                     |
| ---- | ---------------------- | ------------------------ |
| 4.1  | stores/tabsStore       | 标签页状态               |
| 4.2  | components/layout/Tabs | 标签页组件（含拖拽排序） |

## 阶段 5：页面管理

| 顺序 | 模块                       | 说明                               |
| ---- | -------------------------- | ---------------------------------- |
| 5.1  | stores/pagesStore          | 页面和文件夹状态                   |
| 5.2  | services/pagesService      | 页面 CRUD、排序                    |
| 5.3  | hooks/usePages             | 页面操作 Hook                      |
| 5.4  | components/panels/Explorer | 资源管理器面板（含 @dnd-kit 拖拽） |

## 阶段 6：设置功能

| 顺序 | 模块                              | 说明                                      |
| ---- | --------------------------------- | ----------------------------------------- |
| 6.1  | stores/settingsStore              | 设置状态（LLM配置、模型配置、提示词列表） |
| 6.2  | services/settingsService          | 设置管理                                  |
| 6.3  | hooks/useSettings                 | 设置 Hook                                 |
| 6.4  | components/editors/SettingsEditor | 设置编辑器                                |

## 阶段 7：聊天核心

| 顺序 | 模块                                      | 说明                                    |
| ---- | ----------------------------------------- | --------------------------------------- |
| 7.1  | stores/messagesStore                      | 消息状态（含分支结构）                  |
| 7.2  | services/messagesService                  | 消息 CRUD、分支操作                     |
| 7.3  | services/aiService                        | AI 调用、流式响应（依赖 settingsStore） |
| 7.4  | services/attachmentService                | 文件附件上传、存储、读取                |
| 7.5  | hooks/useChat                             | 聊天操作 Hook                           |
| 7.6  | components/editors/ChatEditor             | 聊天编辑器                              |
| 7.7  | components/editors/ChatEditor/MessageList | 消息列表（含分支切换）                  |
| 7.8  | components/editors/ChatEditor/InputArea   | 输入区域（含附件上传）                  |

## 阶段 8：消息队列

| 顺序 | 模块                           | 说明                                      |
| ---- | ------------------------------ | ----------------------------------------- |
| 8.1  | stores/messageQueueStore       | 队列状态                                  |
| 8.2  | hooks/useMessageQueue          | 队列操作（依赖 messagesStore、aiService） |
| 8.3  | components/common/MessageQueue | 队列 UI 组件                              |

## 阶段 9：AI 任务管理

| 顺序 | 模块                    | 说明                     |
| ---- | ----------------------- | ------------------------ |
| 9.1  | stores/tasksStore       | 任务状态                 |
| 9.2  | services/tasksService   | 任务创建、状态更新、中止 |
| 9.3  | hooks/useTasks          | 任务 Hook                |
| 9.4  | components/panels/Tasks | 任务面板                 |

## 阶段 10：搜索功能

| 顺序 | 模块                     | 说明                                       |
| ---- | ------------------------ | ------------------------------------------ |
| 10.1 | stores/searchStore       | 搜索状态（纯 UI）                          |
| 10.2 | hooks/useSearch          | 搜索逻辑（遍历 pagesStore、messagesStore） |
| 10.3 | components/panels/Search | 搜索面板                                   |

## 阶段 11：收藏功能

| 顺序 | 模块                        | 说明                         |
| ---- | --------------------------- | ---------------------------- |
| 11.1 | stores/favoritesStore       | 收藏状态                     |
| 11.2 | services/favoritesService   | 收藏 CRUD                    |
| 11.3 | hooks/useFavorites          | 收藏 Hook                    |
| 11.4 | components/panels/Favorites | 收藏面板（含 @dnd-kit 拖拽） |

## 依赖关系图

箭头表示"依赖于"（A --> B 表示 A 依赖 B）

```
                        accountStore（全局）
                              |
        +---------------------+---------------------+
        |                     |                     |
        v                     v                     v
   layoutStore           pagesStore           settingsStore
        |                     |                     |
        v                     |                     v
    布局组件                  |                aiService
        |                     |                     |
        v                     v                     v
   tabsStore ----------> messagesStore <---- attachmentService
        |                     |
        v                     +---------------------+
    Tabs组件                  |                     |
                              v                     v
                      messageQueueStore        tasksStore
                              |                     |
                              v                     v
                        ChatEditor             Tasks面板
                              |
              +---------------+---------------+
              |                               |
              v                               v
         searchStore                    favoritesStore
              |                               |
              v                               v
         Search面板                     Favorites面板
```

## 账户切换机制

```
切换账户 --> accountService.switchAccount()
         --> 清空所有隔离 Store 内存状态
         --> 更新 IndexedDB 数据库名（含账户 ID）
         --> 触发各 Store rehydrate
```

## 开发原则

1. 每个阶段完成后应可独立运行测试
2. Store 先行，Service 次之，Hook 和 Component 最后
3. 优先实现核心路径（账户 --> 页面 --> 设置 --> 聊天）
4. 阶段 9-11（任务、搜索、收藏）可并行开发
5. 拖拽功能（@dnd-kit）在 Explorer 和 Favorites 面板中集成
