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
import { useAppContext } from '../store/AppContext'
import { ChatWindow, ChatWindowRef } from './pages/chat/index'
import { CrosstabChat } from './pages/crosstab/index'
import { ObjectPage } from './pages/object/index'
import Settings from './Settings'
import './TabsArea.css'

export default function TabsArea() {
  const { state, dispatch } = useAppContext()
  const chatWindowRefs = useRef<Map<string, ChatWindowRef>>(new Map())
  const [settingsOpen, setSettingsOpen] = React.useState(false)

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
    dispatch({
      type: 'CREATE_AND_OPEN_CHAT',
      payload: { title: '新建聊天' }
    })
  }, [dispatch])

  // 创建交叉视图聊天
  const handleCreateCrosstabChat = useCallback(() => {
    dispatch({
      type: 'CREATE_AND_OPEN_CROSSTAB_CHAT',
      payload: { title: '新建交叉视图' }
    })
  }, [dispatch])

  // 创建对象页面聊天
  const handleCreateObjectChat = useCallback(() => {
    dispatch({
      type: 'CREATE_AND_OPEN_OBJECT_CHAT',
      payload: { title: '新建对象页面' }
    })
  }, [dispatch])

  // 处理打开设置
  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true)
  }, [])

  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { ctrlKey, altKey, shiftKey, key } = event
      const activeTabId = state.activeTabId

      if (!activeTabId) return

      // Ctrl+W: 关闭当前标签页
      if (ctrlKey && !altKey && !shiftKey && key === 'w') {
        event.preventDefault()
        dispatch({ type: 'CLOSE_TAB', payload: { chatId: activeTabId } })
        return
      }

      // Ctrl+P: 固定/取消固定当前标签页
      if (ctrlKey && !altKey && !shiftKey && key === 'p') {
        event.preventDefault()
        const chat = state.pages.find((c) => c.id === activeTabId)
        const isPinned = chat?.pinned || false
        dispatch({
          type: isPinned ? 'UNPIN_TAB' : 'PIN_TAB',
          payload: { chatId: activeTabId }
        })
        return
      }

      // Ctrl+Alt+W: 关闭其他标签页
      if (ctrlKey && altKey && !shiftKey && key === 'w') {
        event.preventDefault()
        dispatch({ type: 'CLOSE_OTHER_TABS', payload: { chatId: activeTabId } })
        return
      }

      // Ctrl+Shift+W: 关闭右侧标签页
      if (ctrlKey && !altKey && shiftKey && key === 'w') {
        event.preventDefault()
        dispatch({ type: 'CLOSE_TABS_TO_RIGHT', payload: { chatId: activeTabId } })
        return
      }

      // Ctrl+Shift+Alt+W: 关闭全部标签页
      if (ctrlKey && altKey && shiftKey && key === 'w') {
        event.preventDefault()
        dispatch({ type: 'CLOSE_ALL_TABS' })
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [state.activeTabId, state.pages, dispatch])

  // 当活动标签页改变时，聚焦到输入框
  useEffect(() => {
    if (state.activeTabId) {
      const chatWindowRef = chatWindowRefs.current.get(state.activeTabId)
      if (chatWindowRef) {
        // 使用 setTimeout 确保 DOM 已经完成渲染
        setTimeout(() => {
          chatWindowRef.focus()
        }, 100)
      }
    }
  }, [state.activeTabId])

  const handleTabChange = (activeKey: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: { chatId: activeKey } })
  }

  const handleTabClose = (targetKey: string) => {
    dispatch({ type: 'CLOSE_TAB', payload: { chatId: targetKey } })
  }

  // 获取右键菜单项
  const getContextMenuItems = (chatId: string): MenuProps['items'] => {
    const chat = state.pages.find((c) => c.id === chatId)
    const isPinned = chat?.pinned || false
    const currentIndex = state.openTabs.indexOf(chatId)
    const hasTabsToRight = currentIndex < state.openTabs.length - 1
    const hasOtherTabs = state.openTabs.length > 1

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
          dispatch({
            type: isPinned ? 'UNPIN_TAB' : 'PIN_TAB',
            payload: { chatId }
          })
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
        disabled: isPinned && hasOtherTabs,
        onClick: () => {
          if (!isPinned || !hasOtherTabs) {
            handleTabClose(chatId)
          }
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
          dispatch({ type: 'CLOSE_OTHER_TABS', payload: { chatId } })
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
          dispatch({ type: 'CLOSE_TABS_TO_RIGHT', payload: { chatId } })
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
          dispatch({ type: 'CLOSE_ALL_TABS' })
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

  const hasLLMConfigs = state.settings.llmConfigs && state.settings.llmConfigs.length > 0

  if (state.openTabs.length === 0) {
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

  const tabItems = state.openTabs
    .map((chatId) => {
      const chat = state.pages.find((c) => c.id === chatId)
      if (!chat) return null

      const chatStatus = getChatStatus(chat)
      const isPinned = chat.pinned || false

      const tabLabel = (
        <Dropdown menu={{ items: getContextMenuItems(chatId) }} trigger={['contextMenu']}>
          <span className="tab-label-content">
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
        closable: !isPinned || state.openTabs.length === 1
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  return (
    <div className="tabs-area">
      <Tabs
        type="editable-card"
        activeKey={state.activeTabId || undefined}
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
            '--pinned-tabs': state.openTabs
              .filter((id) => {
                const chat = state.pages.find((c) => c.id === id)
                return chat?.pinned
              })
              .map((id) => `[data-node-key="${id}"]`)
              .join(',')
          } as React.CSSProperties
        }
      />
      <style>{`
        ${state.openTabs
          .filter((id) => {
            const chat = state.pages.find((c) => c.id === id)
            return chat?.pinned
          })
          .map(
            (id) => `
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
          .tabs-area .ant-tabs-tab[data-node-key="${id}"] .ant-tabs-tab-remove {
            opacity: 0.5 !important;
            pointer-events: none !important;
          }
        `
          )
          .join('')}
      `}</style>
    </div>
  )
}
