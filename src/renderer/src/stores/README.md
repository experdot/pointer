# Zustand Store 系统

本项目使用 Zustand 进行状态管理，将原有的 React Context + useReducer 系统重构为多个专门的 store，提供更好的性能和开发体验。

## 架构设计

### Store 拆分

状态管理被拆分为以下几个独立的 store：

1. **pagesStore** - 页面和文件夹管理
2. **tabsStore** - 标签页管理
3. **uiStore** - UI状态管理
4. **searchStore** - 搜索功能
5. **settingsStore** - 应用设置
6. **aiTasksStore** - AI任务管理
7. **messagesStore** - 消息操作
8. **crosstabStore** - 交叉表管理
9. **objectStore** - 对象节点管理

### 特性

- ✅ **持久化** - 所有 store 都支持自动持久化到 localStorage
- ✅ **类型安全** - 完整的 TypeScript 类型支持
- ✅ **错误处理** - 统一的错误处理机制
- ✅ **Immer集成** - 使用 Immer 中间件简化状态更新
- ✅ **模块化** - 每个 store 职责单一，便于维护

## 使用方法

### 1. 基本使用

```typescript
import { useAppStores } from '@/stores'

function MyComponent() {
  const stores = useAppStores()

  // 访问页面数据
  const pages = stores.pages.pages

  // 执行操作
  const handleCreatePage = () => {
    stores.pages.createPage('新页面')
  }

  return (
    <div>
      {pages.map(page => (
        <div key={page.id}>{page.title}</div>
      ))}
      <button onClick={handleCreatePage}>创建页面</button>
    </div>
  )
}
```

### 2. 单独使用特定 Store

```typescript
import { usePagesStore, useTabsStore } from '@/stores'

function PageManager() {
  const { pages, createPage, deletePage } = usePagesStore()
  const { openTab, closeTab } = useTabsStore()

  return (
    // 组件内容
  )
}
```

### 3. 便捷 Hook

```typescript
import { usePages, useTabs, useUI } from '@/stores'

function MyComponent() {
  const pages = usePages()
  const tabs = useTabs()
  const ui = useUI()

  // 直接使用
}
```

## Store 详细说明

### PagesStore

管理页面和文件夹的基本 CRUD 操作。

```typescript
const pagesStore = usePagesStore()

// 页面操作
pagesStore.updatePage(id, updates)
pagesStore.deletePage(id)
pagesStore.movePage(chatId, targetFolderId)

// 文件夹操作
pagesStore.createFolder(name, parentId)
pagesStore.deleteFolder(id)

// 查询方法
pagesStore.findPageById(id)
pagesStore.getPagesByFolderId(folderId)
```

### TabsStore

管理标签页的打开、关闭、切换等操作。

```typescript
const tabsStore = useTabsStore()

// 标签页操作
tabsStore.openTab(chatId)
tabsStore.closeTab(chatId)
tabsStore.setActiveTab(chatId)

// 标签页固定
tabsStore.pinTab(chatId)
tabsStore.unpinTab(chatId)

// 重排序
tabsStore.reorderTabs(newOrder)
```

### UIStore

管理UI相关状态，如侧边栏、选择状态等。

```typescript
const uiStore = useUIStore()

// 侧边栏
uiStore.toggleSidebar()
uiStore.setSidebarWidth(width)

// 节点选择
uiStore.setSelectedNode(nodeId, nodeType)
uiStore.setCheckedNodes(nodeIds)

// 消息折叠
uiStore.toggleMessageCollapse(chatId, messageId)
uiStore.collapseAllMessages(chatId, messageIds)
```

### SearchStore

管理搜索功能和搜索结果。

```typescript
const searchStore = useSearchStore()

// 搜索操作
searchStore.setSearchQuery(query)
searchStore.performSearch(query)
searchStore.clearSearch()

// 搜索选项
searchStore.toggleMatchCase()
searchStore.toggleUseRegex()
```

### SettingsStore

管理应用设置，包括 LLM 配置等。

```typescript
const settingsStore = useSettingsStore()

// 设置管理
settingsStore.updateSettings(updates)
settingsStore.resetSettings()

// LLM 配置
settingsStore.addLLMConfig(config)
settingsStore.updateLLMConfig(id, updates)
settingsStore.setDefaultLLM(id)
```

### AITasksStore

管理 AI 任务的状态和生命周期。

```typescript
const aiTasksStore = useAITasksStore()

// 任务管理
aiTasksStore.addTask(task)
aiTasksStore.updateTask(taskId, updates)
aiTasksStore.removeTask(taskId)

// 任务状态
aiTasksStore.startTask(taskId)
aiTasksStore.completeTask(taskId)
aiTasksStore.cancelTask(taskId)
```

## 迁移指南

### 从旧的 Context 系统迁移

1. **更新导入**：

```typescript
// 旧的方式
import { useAppContext } from '@/store/AppContext'

// 新的方式
import { useAppStores } from '@/stores'
```

2. **更新使用方式**：

```typescript
// 旧的方式
const { state, dispatch } = useAppContext()
dispatch({ type: 'UPDATE_CHAT', payload: { id, updates } })

// 新的方式
const stores = useAppStores()
stores.pages.updatePage(id, updates)
```

3. **使用迁移函数**：

```typescript
import { migrateFromOldContext } from '@/stores/ZustandAppContext'

// 在应用初始化时调用
migrateFromOldContext(oldState)
```

## 最佳实践

### 1. 状态访问

```typescript
// ✅ 推荐：使用解构获取需要的状态和操作
const { pages, createPage } = usePagesStore()

// ❌ 避免：访问整个 store 对象
const pagesStore = usePagesStore()
```

### 2. 性能优化

```typescript
// ✅ 推荐：只订阅需要的状态
const pages = usePagesStore((state) => state.pages)

// ❌ 避免：订阅整个 store
const pagesStore = usePagesStore()
```

### 3. 错误处理

所有 store 操作都内置了错误处理，但建议在组件中添加额外的错误处理：

```typescript
const handleCreatePage = async () => {
  try {
    await stores.pages.createPage(title)
  } catch (error) {
    // 处理错误
    console.error('Failed to create page:', error)
  }
}
```

### 4. 类型安全

充分利用 TypeScript 类型系统：

```typescript
import type { Page, PageFolder } from '@/types/type'

const handlePageUpdate = (page: Page, updates: Partial<Page>) => {
  stores.pages.updatePage(page.id, updates)
}
```

## 开发工具

### 1. Zustand DevTools

在开发环境中可以使用 Zustand DevTools：

```typescript
import { devtools } from 'zustand/middleware'

export const usePagesStore = create<PagesState & PagesActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        // store implementation
      })),
      createPersistConfig('pages-store', 1)
    ),
    { name: 'pages-store' }
  )
)
```

### 2. Store 状态监控

```typescript
import { subscribeToStores } from '@/stores/useAppStores'

// 监听所有 store 变化
const unsubscribe = subscribeToStores(() => {
  console.log('Store updated')
})

// 清理监听
unsubscribe()
```

## 注意事项

1. **持久化**：所有 store 都会自动持久化到 localStorage，请注意数据的迁移和版本控制。

2. **循环依赖**：避免在 store 之间创建循环依赖，使用组合的方式来访问其他 store。

3. **性能**：虽然 Zustand 性能很好，但仍要注意避免不必要的重渲染。

4. **错误边界**：建议在应用中添加错误边界来处理 store 操作中的异常。

## 总结

新的 Zustand store 系统提供了：

- 更好的性能
- 更清晰的代码结构
- 更强的类型安全
- 更简单的状态管理

通过合理使用这些 store，可以构建更稳定、可维护的应用程序。
