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
import { usePagesStore } from '../../../stores/pagesStore'
import { useTabsStore } from '../../../stores/tabsStore'
import { useUIStore } from '../../../stores/uiStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { ChatWindow, ChatWindowRef } from '../../pages/chat/index'
import { CrosstabChat } from '../../pages/crosstab/index'
import { ObjectPage } from '../../pages/object/index'
import Settings from '../../settings/Settings'
import './TabsArea.css'

export default function TabsArea() {
  const { pages, createAndOpenChat, createAndOpenCrosstabChat, createAndOpenObjectChat } =
    usePagesStore()
  const {
    openTabs,
    activeTabId,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabs,
    pinTab,
    unpinTab,
    reorderTabs,
    setActiveTab
  } = useTabsStore()
  const {} = useUIStore()
  const { settings } = useSettingsStore()
  const chatWindowRefs = useRef<Map<string, ChatWindowRef>>(new Map())
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [draggedTabId, setDraggedTabId] = React.useState<string | null>(null)
  const [dragOverTabId, setDragOverTabId] = React.useState<string | null>(null)

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
    setSettingsOpen(true)
  }, [])

  // 拖拽排序处理函数
  const handleDragStart = useCallback((event: React.DragEvent, chatId: string) => {
    setDraggedTabId(chatId)
    event.dataTransfer.setData('text/plain', chatId)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback(
    (event: React.DragEvent, chatId: string) => {
      event.preventDefault()

      if (draggedTabId) {
        const sourceChat = pages.find((p) => p.id === draggedTabId)
        const targetChat = pages.find((p) => p.id === chatId)

        const sourcePinned = sourceChat?.pinned || false
        const targetPinned = targetChat?.pinned || false

        // 检查是否可以拖拽
        if (sourcePinned !== targetPinned) {
          event.dataTransfer.dropEffect = 'none'
          return
        }
      }

      event.dataTransfer.dropEffect = 'move'
      setDragOverTabId(chatId)
    },
    [draggedTabId, pages]
  )

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    // 只在离开整个标签区域时清除
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setDragOverTabId(null)
    }
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent, targetChatId: string) => {
      event.preventDefault()
      const sourceChatId = event.dataTransfer.getData('text/plain')

      if (sourceChatId && sourceChatId !== targetChatId) {
        const sourceChat = pages.find((p) => p.id === sourceChatId)
        const targetChat = pages.find((p) => p.id === targetChatId)

        // 检查是否可以进行拖拽排序
        const sourcePinned = sourceChat?.pinned || false
        const targetPinned = targetChat?.pinned || false

        // 固定标签页和非固定标签页不能互相拖拽
        if (sourcePinned !== targetPinned) {
          setDraggedTabId(null)
          setDragOverTabId(null)
          return
        }

        const currentTabs = [...openTabs]
        const sourceIndex = currentTabs.indexOf(sourceChatId)
        const targetIndex = currentTabs.indexOf(targetChatId)

        if (sourceIndex !== -1 && targetIndex !== -1) {
          // 移除源标签
          currentTabs.splice(sourceIndex, 1)
          // 在目标位置插入
          const newTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
          currentTabs.splice(newTargetIndex, 0, sourceChatId)

          // 通过reorderTabs进行排序，确保固定标签页在前
          reorderTabs(currentTabs)
        }
      }

      setDraggedTabId(null)
      setDragOverTabId(null)
    },
    [openTabs, pages, reorderTabs]
  )

  const handleDragEnd = useCallback(() => {
    setDraggedTabId(null)
    setDragOverTabId(null)
  }, [])

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

  const handleTabChange = (activeKey: string) => {
    setActiveTab(activeKey)
  }

  const handleTabClose = (targetKey: string) => {
    closeTab(targetKey)
  }

  // 获取右键菜单项
  const getContextMenuItems = (chatId: string): MenuProps['items'] => {
    const chat = pages.find((c) => c.id === chatId)
    const isPinned = chat?.pinned || false
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
        <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    )
  }

  const tabItems = openTabs
    .map((chatId) => {
      const chat = pages.find((c) => c.id === chatId)
      if (!chat) return null

      const chatStatus = getChatStatus(chat)
      const isPinned = chat.pinned || false

      // 检查是否可以与当前拖拽的标签页进行拖拽
      const canDragToThis =
        !draggedTabId ||
        (() => {
          const sourceChat = pages.find((p) => p.id === draggedTabId)
          const sourcePinned = sourceChat?.pinned || false
          const targetPinned = chat.pinned || false
          return sourcePinned === targetPinned
        })()

      const tabLabel = (
        <Dropdown menu={{ items: getContextMenuItems(chatId) }} trigger={['contextMenu']}>
          <span
            className={`tab-label-content ${draggedTabId === chatId ? 'dragging' : ''} ${dragOverTabId === chatId ? (canDragToThis ? 'drag-over' : 'drag-over-forbidden') : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, chatId)}
            onDragOver={(e) => handleDragOver(e, chatId)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, chatId)}
            onDragEnd={handleDragEnd}
          >
            {chat.type === 'crosstab' ? (
              <TableOutlined className="message-icon" />
            ) : chat.type === 'object' ? (
              <BlockOutlined className="message-icon" />
            ) : (
              <MessageOutlined className="message-icon" />
            )}
            {isPinned && <PushpinFilled className="pin-icon" title="已固定标签页" />}
            <Tooltip title={chatStatus.text}>
              <Badge status={chatStatus.status} className="status-badge" />
            </Tooltip>
            <span className="tab-title">{chat.title}</span>
          </span>
        </Dropdown>
      )

      return {
        key: chatId,
        label: tabLabel,
        children:
          chat.type === 'crosstab' ? (
            <CrosstabChat chatId={chatId} />
          ) : chat.type === 'object' ? (
            <ObjectPage chatId={chatId} />
          ) : (
            <ChatWindow chatId={chatId} ref={(ref) => setChatWindowRef(chatId, ref)} />
          ),
        closable: true,
        className: `${draggedTabId === chatId ? 'dragging' : ''} ${dragOverTabId === chatId ? 'drag-over' : ''}`
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  return (
    <div className="tabs-area">
      <Tabs
        type="editable-card"
        activeKey={activeTabId || undefined}
        onChange={handleTabChange}
        onEdit={(targetKey, action) => {
          if (action === 'remove' && typeof targetKey === 'string') {
            handleTabClose(targetKey)
          }
        }}
        items={tabItems}
        hideAdd
        size="small"
        style={
          {
            '--pinned-tabs': openTabs
              .filter((id) => {
                const chat = pages.find((c) => c.id === id)
                return chat?.pinned
              })
              .map((id) => `[data-node-key="${id}"]`)
              .join(','),
            '--pinned-count': openTabs.filter((id) => {
              const chat = pages.find((c) => c.id === id)
              return chat?.pinned
            }).length
          } as React.CSSProperties
        }
      />
      <style>{`
        ${openTabs
          .filter((id) => {
            const chat = pages.find((c) => c.id === id)
            return chat?.pinned
          })
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
