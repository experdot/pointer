import React, { useEffect, useRef, useCallback } from 'react'
import { Tabs, Empty, Badge, Tooltip, Dropdown, MenuProps, Button } from 'antd'
import {
  MessageOutlined,
  CloseOutlined,
  PushpinOutlined,
  PushpinFilled,
  CloseCircleOutlined,
  DeleteOutlined,
  SettingOutlined,
  PlusOutlined,
  TableOutlined,
  BlockOutlined
} from '@ant-design/icons'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { usePagesStore } from '../../../stores/pagesStore'
import { useTabsStore } from '../../../stores/tabsStore'
import { useUIStore } from '../../../stores/uiStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { ChatWindow, ChatWindowRef } from '../../pages/chat/index'
import { CrosstabChat } from '../../pages/crosstab/index'
import { ObjectPage } from '../../pages/object/index'
import SettingsPage from '../../pages/settings/SettingsPage'
import FavoriteDetailPage from '../../pages/favorites/FavoriteDetailPage'
import { useFavoritesStore } from '../../../stores/favoritesStore'
import './TabsArea.css'

// Tab Label Content Component (共用的标签内容)
interface TabLabelContentProps {
  chat: any
  chatStatus: { status: 'success' | 'processing' | 'default'; text: string }
  isPinned: boolean
  isDragging?: boolean
}

const TabLabelContent: React.FC<TabLabelContentProps> = ({
  chat,
  chatStatus,
  isPinned,
  isDragging = false
}) => {
  return (
    <span className={`tab-label-content ${isDragging ? 'dragging' : ''}`}>
      {chat.type === 'crosstab' ? (
        <TableOutlined className="message-icon" />
      ) : chat.type === 'object' ? (
        <BlockOutlined className="message-icon" />
      ) : chat.type === 'settings' ? (
        <SettingOutlined className="message-icon" />
      ) : (
        <MessageOutlined className="message-icon" />
      )}
      {isPinned && <PushpinFilled className="pin-icon" title="已固定标签页" />}
      <Tooltip title={chatStatus.text}>
        <Badge status={chatStatus.status} className="status-badge" />
      </Tooltip>
      <span className="tab-title">{chat.title}</span>
    </span>
  )
}

// Sortable Tab Label Component
interface SortableTabLabelProps {
  chatId: string
  chat: any
  chatStatus: { status: 'success' | 'processing' | 'default'; text: string }
  isPinned: boolean
  getContextMenuItems: (chatId: string) => MenuProps['items']
}

const SortableTabLabel: React.FC<SortableTabLabelProps> = ({
  chatId,
  chat,
  chatStatus,
  isPinned,
  getContextMenuItems
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chatId,
    // 禁用动画变换，让标签保持原位
    transition: null
  })

  const style: React.CSSProperties = {
    // 不应用 transform，让标签保持在原位
    transform: isDragging ? 'none' : undefined,
    opacity: isDragging ? 0 : 1, // 拖拽时完全透明，因为会显示在 DragOverlay 中
    cursor: 'pointer',
    position: 'relative'
  }

  return (
    <Dropdown menu={{ items: getContextMenuItems(chatId) }} trigger={['contextMenu']}>
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <TabLabelContent chat={chat} chatStatus={chatStatus} isPinned={isPinned} />
      </div>
    </Dropdown>
  )
}

export default function TabsArea() {
  const {
    pages,
    createAndOpenChat,
    createAndOpenCrosstabChat,
    createAndOpenObjectChat,
    createAndOpenSettingsPage
  } = usePagesStore()
  const {
    openTabs,
    activeTabId,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabs,
    pinTab,
    unpinTab,
    isTabPinned,
    reorderTabs,
    setActiveTab
  } = useTabsStore()
  const { setSelectedNode, setSelectedFavorite } = useUIStore()
  const { settings } = useSettingsStore()
  const { items: favoriteItems } = useFavoritesStore()
  const chatWindowRefs = useRef<Map<string, ChatWindowRef>>(new Map())
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [overId, setOverId] = React.useState<string | null>(null)

  // Setup sensors for dnd-kit
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10 // Require 10px of movement before drag starts (避免点击被误认为拖拽)
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // Handle drag over - 用于显示插入指示线
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event
    setOverId(over ? (over.id as string) : null)
  }, [])

  // 设置ChatWindow引用的回调函数
  const setChatWindowRef = useCallback((chatId: string, ref: ChatWindowRef | null) => {
    if (ref) {
      chatWindowRefs.current.set(chatId, ref)
    } else {
      chatWindowRefs.current.delete(chatId)
    }
  }, [])

  // 创建新聊天
  const handleCreateChat = useCallback(() => {
    createAndOpenChat('新建聊天')
  }, [createAndOpenChat])

  // 创建交叉视图聊天
  const handleCreateCrosstabChat = useCallback(() => {
    createAndOpenCrosstabChat('新建交叉视图')
  }, [createAndOpenCrosstabChat])

  // 创建对象页面聊天
  const handleCreateObjectChat = useCallback(() => {
    createAndOpenObjectChat('新建对象页面')
  }, [createAndOpenObjectChat])

  // 处理打开设置
  const handleOpenSettings = useCallback(() => {
    const settingsPageId = createAndOpenSettingsPage('llm') // 配置模型按钮应该打开LLM配置
    setActiveTab(settingsPageId)
  }, [createAndOpenSettingsPage, setActiveTab])

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const activeId = active.id as string
        const overId = over.id as string

        // 使用统一的 pinned 状态检查
        const activePinned = isTabPinned(activeId)
        const overPinned = isTabPinned(overId)

        // Only allow reordering if both tabs have the same pinned status
        if (activePinned !== overPinned) {
          setActiveId(null)
          setOverId(null)
          return
        }

        const oldIndex = openTabs.indexOf(activeId)
        const newIndex = openTabs.indexOf(overId)

        if (oldIndex !== -1 && newIndex !== -1) {
          const newTabs = arrayMove(openTabs, oldIndex, newIndex)
          reorderTabs(newTabs)
        }
      }

      setActiveId(null)
      setOverId(null)
    },
    [openTabs, isTabPinned, reorderTabs]
  )

  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+T 创建新聊天
      if ((event.ctrlKey || event.metaKey) && event.key === 't') {
        event.preventDefault()
        handleCreateChat()
      }
      // Ctrl+W 关闭当前标签页
      if ((event.ctrlKey || event.metaKey) && event.key === 'w') {
        event.preventDefault()
        if (activeTabId) {
          closeTab(activeTabId)
        }
      }
      // Ctrl+Tab 切换到下一个标签页
      if ((event.ctrlKey || event.metaKey) && event.key === 'Tab') {
        event.preventDefault()
        if (openTabs.length > 0 && activeTabId) {
          const currentIndex = openTabs.indexOf(activeTabId)
          const nextIndex = (currentIndex + 1) % openTabs.length
          setActiveTab(openTabs[nextIndex])
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeTabId, openTabs, closeTab, setActiveTab, handleCreateChat])

  // 当活动标签页改变时，聚焦到输入框
  useEffect(() => {
    if (activeTabId) {
      const chatWindowRef = chatWindowRefs.current.get(activeTabId)
      if (chatWindowRef) {
        // 使用 setTimeout 确保 DOM 已经完成渲染
        setTimeout(() => {
          chatWindowRef.focus()
        }, 100)
      }
    }
  }, [activeTabId])

  // 动态添加/移除插入指示器的 CSS 类
  useEffect(() => {
    // 清除所有插入指示器
    const allTabs = document.querySelectorAll('.tabs-area .ant-tabs-tab')
    allTabs.forEach((tab) => {
      tab.classList.remove('drop-indicator-left', 'drop-indicator-right')
    })

    // 如果正在拖拽且有悬停目标
    if (activeId && overId && activeId !== overId) {
      const activeIndex = openTabs.indexOf(activeId)
      const overIndex = openTabs.indexOf(overId)

      // 找到对应的 DOM 元素
      const overTab = document.querySelector(`.tabs-area .ant-tabs-tab[data-node-key="${overId}"]`)

      if (overTab && activeIndex !== -1 && overIndex !== -1) {
        // 使用统一的 pinned 状态检查
        const activePinned = isTabPinned(activeId)
        const overPinned = isTabPinned(overId)

        if (activePinned === overPinned) {
          // 根据拖拽方向显示左侧或右侧插入线
          if (activeIndex < overIndex) {
            // 从左向右拖拽，显示右侧插入线
            overTab.classList.add('drop-indicator-right')
          } else {
            // 从右向左拖拽，显示左侧插入线
            overTab.classList.add('drop-indicator-left')
          }
        }
      }
    }
  }, [activeId, overId, openTabs, isTabPinned])

  const handleTabChange = (activeKey: string) => {
    setActiveTab(activeKey)

    // 同步侧边栏选中状态
    if (activeKey.startsWith('favorite-')) {
      // 如果是收藏详情页，更新收藏面板的选中状态
      const favoriteId = activeKey.substring(9) // 移除 'favorite-' 前缀
      setSelectedFavorite(favoriteId, 'item')
      // 清空聊天历史树的选中状态
      setSelectedNode(null, null)
      // 切换到收藏夹侧边栏
      const { setActiveTab: setSidebarTab } = useUIStore.getState()
      setSidebarTab('favorites')
    } else {
      // 如果是普通页面，更新聊天历史树的选中状态
      const page = pages.find((p) => p.id === activeKey)
      if (page) {
        setSelectedNode(activeKey, 'chat')
        // 清空收藏面板的选中状态
        setSelectedFavorite(null, null)
        // 切换到资源管理器侧边栏
        const { setActiveTab: setSidebarTab } = useUIStore.getState()
        setSidebarTab('explore')
      }
    }
  }

  const handleTabClose = (targetKey: string) => {
    closeTab(targetKey)
  }

  // 获取右键菜单项（统一逻辑，不区分类型）
  const getContextMenuItems = (chatId: string): MenuProps['items'] => {
    const isPinned = isTabPinned(chatId)
    const currentIndex = openTabs.indexOf(chatId)
    const hasTabsToRight = currentIndex < openTabs.length - 1
    const hasOtherTabs = openTabs.length > 1

    return [
      {
        key: 'pin',
        label: (
          <span className="tab-context-menu-item">
            <span>{isPinned ? '取消固定' : '固定标签页'}</span>
            <span className="tab-context-menu-shortcut">Ctrl+P</span>
          </span>
        ),
        icon: isPinned ? <PushpinOutlined /> : <PushpinFilled />,
        onClick: () => {
          if (isPinned) {
            unpinTab(chatId)
          } else {
            pinTab(chatId)
          }
        }
      },
      { type: 'divider' },
      {
        key: 'close',
        label: (
          <span className="tab-context-menu-item">
            <span>关闭标签页</span>
            <span className="tab-context-menu-shortcut">Ctrl+W</span>
          </span>
        ),
        icon: <CloseOutlined />,
        disabled: false,
        onClick: () => {
          handleTabClose(chatId)
        }
      },
      {
        key: 'closeOthers',
        label: (
          <span className="tab-context-menu-item">
            <span>关闭其他标签页</span>
            <span className="tab-context-menu-shortcut">Ctrl+Alt+W</span>
          </span>
        ),
        icon: <CloseCircleOutlined />,
        disabled: !hasOtherTabs,
        onClick: () => {
          closeOtherTabs(chatId)
        }
      },
      {
        key: 'closeToRight',
        label: (
          <span className="tab-context-menu-item">
            <span>关闭右侧标签页</span>
            <span className="tab-context-menu-shortcut">Ctrl+Shift+W</span>
          </span>
        ),
        icon: <CloseCircleOutlined />,
        disabled: !hasTabsToRight,
        onClick: () => {
          closeTabsToRight(chatId)
        }
      },
      {
        key: 'closeAll',
        label: (
          <span className="tab-context-menu-item">
            <span>关闭全部标签页</span>
            <span className="tab-context-menu-shortcut">Ctrl+Shift+Alt+W</span>
          </span>
        ),
        icon: <DeleteOutlined />,
        onClick: () => {
          closeAllTabs()
        }
      }
    ]
  }

  // 获取聊天状态指示器的颜色和状态文本
  const getChatStatus = (chat: any) => {
    // 对于收藏详情页
    if (chat.type === 'favorite') {
      return {
        status: 'default' as const,
        text: '收藏详情'
      }
    }

    // 对于交叉视图聊天，使用不同的状态计算
    if (chat.type === 'crosstab') {
      const currentStep = chat.crosstabData?.currentStep || 0
      const totalSteps = chat.crosstabData?.steps?.length || 4
      const completedSteps =
        chat.crosstabData?.steps?.filter((step: any) => step.isCompleted).length || 0

      if (completedSteps === totalSteps) {
        return {
          status: 'success' as const,
          text: '交叉表已完成'
        }
      } else if (completedSteps > 0) {
        return {
          status: 'processing' as const,
          text: `进度: ${completedSteps}/${totalSteps}`
        }
      } else {
        return {
          status: 'default' as const,
          text: '未开始生成'
        }
      }
    }

    // 对于对象页面，使用节点数量计算状态
    if (chat.type === 'object') {
      const nodeCount = chat.objectData?.nodes ? Object.keys(chat.objectData.nodes).length : 0
      const hasGenerationHistory = chat.objectData?.generationHistory?.length > 0

      if (nodeCount > 1 && hasGenerationHistory) {
        return {
          status: 'success' as const,
          text: `已创建 ${nodeCount} 个节点`
        }
      } else if (nodeCount > 1) {
        return {
          status: 'processing' as const,
          text: `包含 ${nodeCount} 个节点`
        }
      } else {
        return {
          status: 'default' as const,
          text: '空对象结构'
        }
      }
    }

    // 普通聊天的状态计算
    const messageCount = chat.messages?.length || 0
    const hasStreamingMessage = !!chat.streamingMessage
    const hasStreamingInMessages = chat.messages?.some((msg: any) => msg.isStreaming) || false
    const isStreaming = hasStreamingMessage || hasStreamingInMessages

    if (isStreaming) {
      return {
        status: 'processing' as const,
        text: '正在生成中'
      }
    } else if (messageCount > 1) {
      return {
        status: 'success' as const,
        text: '已完成对话'
      }
    } else {
      return {
        status: 'default' as const,
        text: '未开始对话'
      }
    }
  }

  const hasLLMConfigs = settings.llmConfigs && settings.llmConfigs.length > 0

  if (openTabs.length === 0) {
    return (
      <div className="tabs-area-empty">
        {!hasLLMConfigs ? (
          <Empty
            image={<SettingOutlined style={{ fontSize: 64, color: '#faad14' }} />}
            imageStyle={{ height: 80, marginBottom: 24 }}
            description={
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ color: '#262626', marginBottom: 8 }}>尚未配置AI模型</h3>
                <p style={{ color: '#8c8c8c', marginBottom: 24 }}>开始使用前，请先配置您的AI模型</p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <Button
                    type="primary"
                    size="large"
                    icon={<SettingOutlined />}
                    onClick={handleOpenSettings}
                  >
                    配置模型
                  </Button>
                </div>
              </div>
            }
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            imageStyle={{ height: 60 }}
            description={
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ color: '#262626', marginBottom: 8 }}>暂无打开的聊天</h3>
                <p style={{ color: '#8c8c8c', marginBottom: 24 }}>
                  创建一个新聊天开始对话，或者尝试新的交叉视图分析
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlusOutlined />}
                    onClick={handleCreateChat}
                  >
                    新建聊天
                  </Button>
                  <Button
                    type="default"
                    size="large"
                    icon={<TableOutlined />}
                    onClick={handleCreateCrosstabChat}
                  >
                    新建交叉视图
                  </Button>
                  <Button
                    type="default"
                    size="large"
                    icon={<BlockOutlined />}
                    onClick={handleCreateObjectChat}
                  >
                    新建对象页面
                  </Button>
                </div>
              </div>
            }
          />
        )}
      </div>
    )
  }

  const tabItems = openTabs
    .map((chatId) => {
      // 检查是否是收藏详情tab
      if (chatId.startsWith('favorite-')) {
        const favoriteId = chatId.substring(9) // 移除 'favorite-' 前缀
        const favorite = favoriteItems.find((f) => f.id === favoriteId)
        if (!favorite) return null

        // 构建一个类似 chat 的对象，以便复用 SortableTabLabel
        const favoriteAsChat = {
          id: chatId,
          type: 'favorite',
          title: favorite.title,
          pinned: false,
          messages: [] // 收藏详情页没有 messages，但为了计算状态需要提供
        }

        const chatStatus = getChatStatus(favoriteAsChat)
        const isPinned = isTabPinned(chatId)

        const tabLabel = (
          <SortableTabLabel
            chatId={chatId}
            chat={favoriteAsChat}
            chatStatus={chatStatus}
            isPinned={isPinned}
            getContextMenuItems={getContextMenuItems}
          />
        )

        return {
          key: chatId,
          label: tabLabel,
          children: <FavoriteDetailPage favoriteId={favoriteId} />,
          closable: true
        }
      }

      const chat = pages.find((c) => c.id === chatId)
      if (!chat) return null

      const chatStatus = getChatStatus(chat)
      const isPinned = isTabPinned(chatId)

      const tabLabel = (
        <SortableTabLabel
          chatId={chatId}
          chat={chat}
          chatStatus={chatStatus}
          isPinned={isPinned}
          getContextMenuItems={getContextMenuItems}
        />
      )

      return {
        key: chatId,
        label: tabLabel,
        children:
          chat.type === 'crosstab' ? (
            <CrosstabChat chatId={chatId} />
          ) : chat.type === 'object' ? (
            <ObjectPage chatId={chatId} />
          ) : chat.type === 'settings' ? (
            <SettingsPage chatId={chatId} defaultActiveTab={chat.data?.defaultActiveTab} />
          ) : (
            <ChatWindow chatId={chatId} ref={(ref) => setChatWindowRef(chatId, ref)} />
          ),
        closable: true
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  // 获取当前拖拽的标签信息（用于 DragOverlay）
  const activeTab = activeId
    ? (() => {
        // 先检查是否是收藏详情tab
        if (activeId.startsWith('favorite-')) {
          const favoriteId = activeId.substring(9)
          const favorite = favoriteItems.find((f) => f.id === favoriteId)
          if (favorite) {
            return {
              type: 'favorite',
              title: favorite.title,
              pinned: false // 收藏详情页不支持固定
            }
          }
        }
        // 否则是普通页面
        const page = pages.find((p) => p.id === activeId)
        return page
      })()
    : null

  return (
    <div className="tabs-area">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={openTabs}>
          <Tabs
            type="editable-card"
            activeKey={activeTabId || undefined}
            onChange={handleTabChange}
            onEdit={(targetKey, action) => {
              if (action === 'add') {
                handleCreateChat()
              } else if (action === 'remove' && typeof targetKey === 'string') {
                handleTabClose(targetKey)
              }
            }}
            items={tabItems}
            size="small"
            style={
              {
                '--pinned-tabs': openTabs
                  .filter((id) => isTabPinned(id))
                  .map((id) => `[data-node-key="${id}"]`)
                  .join(','),
                '--pinned-count': openTabs.filter((id) => isTabPinned(id)).length
              } as React.CSSProperties
            }
          />
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeId && activeTab ? (
            <div className="tab-drag-overlay">
              <TabLabelContent
                chat={activeTab}
                chatStatus={getChatStatus(activeTab)}
                isPinned={activeTab.pinned || false}
                isDragging={true}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <style>{`
        ${openTabs
          .filter((id) => isTabPinned(id))
          .map(
            (id, index, pinnedTabs) => `
          .tabs-area .ant-tabs-tab[data-node-key="${id}"] {
            background: linear-gradient(135deg, rgba(24, 144, 255, 0.1), rgba(24, 144, 255, 0.05)) !important;
            border-color: rgba(24, 144, 255, 0.3) !important;
            position: relative;
          }
          .tabs-area .ant-tabs-tab[data-node-key="${id}"]::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: #1890ff;
            border-radius: 0 2px 2px 0;
          }
          ${
            index === pinnedTabs.length - 1
              ? `
          .tabs-area .ant-tabs-tab[data-node-key="${id}"]::after {
            content: '';
            position: absolute;
            right: -8px;
            top: 50%;
            transform: translateY(-50%);
            width: 1px;
            height: 20px;
            background: rgba(24, 144, 255, 0.3);
            border-radius: 1px;
          }
          `
              : ''
          }
        `
          )
          .join('')}
      `}</style>
    </div>
  )
}
