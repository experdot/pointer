# 开发顺序

## 第一阶段：基础框架

1. 搭建目录结构（components/hooks/stores/services/types）
2. 配置 Ant Design（ConfigProvider + 主题）
3. 实现 storageService（IndexedDB 适配器）
4. 实现布局骨架（TitleBar + ActivityBar + Sidebar + EditorArea）
5. 实现 layoutStore

## 第二阶段：标签页系统

6. 实现 tabsStore
7. 实现 EditorArea 中的 Tabs 组件
8. 实现标签页切换逻辑

## 第三阶段：聊天核心

9. 实现 types（ChatMessage, ChatSession, Page 等）
10. 实现 messagesStore
11. 实现 pagesStore
12. 实现 chatService
13. 实现 pageService
14. 实现 ChatEditor（消息列表 + 输入框）
15. 实现 Explorer 面板（页面/文件夹树）

## 第四阶段：设置功能

16. 实现 settingsStore
17. 实现 settingsService
18. 实现 SettingsEditor

## 第五阶段：增强功能

19. 实现 searchStore + Search 面板
20. 实现 favoritesStore + favoriteService + Favorites 面板
21. 实现 tasksStore + taskService + Tasks 面板

## 第六阶段：完善

22. 实现导入导出（exportService）
23. 实现拖拽排序
24. 实现快捷键
