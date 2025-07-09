import React from 'react'
import { Card, Typography, Space, Tag, Button, Empty, Divider, Timeline } from 'antd'
import {
  UserOutlined,
  NodeIndexOutlined,
  TableOutlined,
  MessageOutlined,
  ArrowRightOutlined,
  HistoryOutlined,
  BranchesOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  CaretRightOutlined,
  CaretDownOutlined
} from '@ant-design/icons'
import { useAppContext } from '../../store/AppContext'

const { Text, Paragraph } = Typography

interface PageLineageDisplayProps {
  pageId: string
  showInCard?: boolean
  size?: 'small' | 'default'
}

const PageLineageDisplay: React.FC<PageLineageDisplayProps> = ({
  pageId,
  showInCard = true,
  size = 'default'
}) => {
  const { state, dispatch } = useAppContext()

  // 获取当前页面
  const currentPage = state.pages.find((page) => page.id === pageId)

  if (!currentPage) {
    return null
  }

  const lineage = currentPage.lineage

  // 获取折叠状态，默认为折叠状态
  const isCollapsed = state.lineageDisplayCollapsed[pageId] ?? true

  // 处理折叠状态切换
  const handleToggleCollapse = () => {
    dispatch({ type: 'TOGGLE_LINEAGE_DISPLAY_COLLAPSE', payload: { pageId } })
  }

  // 获取源页面信息
  const getSourcePageInfo = () => {
    if (!lineage?.sourcePageId) return null

    const sourcePage = state.pages.find((page) => page.id === lineage.sourcePageId)
    return sourcePage || null
  }

  // 获取后续生成的页面信息
  const getGeneratedPagesInfo = () => {
    if (!lineage?.generatedPageIds || lineage.generatedPageIds.length === 0) return []

    return lineage.generatedPageIds
      .map((id) => state.pages.find((page) => page.id === id))
      .filter(Boolean)
  }

  // 获取溯源类型的图标和描述
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'user':
        return <UserOutlined />
      case 'object_to_crosstab':
        return <NodeIndexOutlined />
      case 'crosstab_to_chat':
        return <TableOutlined />
      case 'object_to_chat':
        return <NodeIndexOutlined />
      case 'chat_to_object':
        return <MessageOutlined />
      default:
        return <InfoCircleOutlined />
    }
  }

  const getSourceDescription = (source: string) => {
    switch (source) {
      case 'user':
        return '用户手动创建'
      case 'object_to_crosstab':
        return '从对象页面生成'
      case 'crosstab_to_chat':
        return '从交叉分析表生成'
      case 'object_to_chat':
        return '从对象页面生成'
      case 'chat_to_object':
        return '从聊天页面生成'
      default:
        return '其他来源'
    }
  }

  const getPageTypeIcon = (type: string) => {
    switch (type) {
      case 'regular':
        return <MessageOutlined />
      case 'crosstab':
        return <TableOutlined />
      case 'object':
        return <NodeIndexOutlined />
      default:
        return <InfoCircleOutlined />
    }
  }

  const getPageTypeName = (type: string) => {
    switch (type) {
      case 'regular':
        return '聊天页面'
      case 'crosstab':
        return '交叉分析表'
      case 'object':
        return '对象页面'
      default:
        return '未知页面'
    }
  }

  // 处理导航到页面
  const handleNavigateToPage = (targetPageId: string) => {
    dispatch({ type: 'OPEN_TAB', payload: { chatId: targetPageId } })
    dispatch({ type: 'SET_ACTIVE_TAB', payload: { chatId: targetPageId } })
    // 同时选中该聊天节点
    dispatch({
      type: 'SET_SELECTED_NODE',
      payload: { nodeId: targetPageId, nodeType: 'chat' }
    })
  }

  // 获取上下文信息描述
  const getContextDescription = () => {
    if (!lineage?.sourceContext) return null

    const { objectCrosstab, crosstabChat, customContext } = lineage.sourceContext

    if (objectCrosstab) {
      return `基于对象节点 "${objectCrosstab.horizontalNodeName}" 和 "${objectCrosstab.verticalNodeName}" 的交叉分析`
    }

    if (crosstabChat) {
      return `基于交叉分析表单元格 "${crosstabChat.horizontalItem} × ${crosstabChat.verticalItem}" 的深度分析`
    }

    if (customContext) {
      return JSON.stringify(customContext, null, 2)
    }

    return null
  }

  const sourcePage = getSourcePageInfo()
  const generatedPages = getGeneratedPagesInfo()
  const contextDescription = getContextDescription()

  if (!lineage) {
    return null
  }

  // 折叠标题
  const collapseHeader = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        fontSize: size === 'small' ? '12px' : '14px'
      }}
      onClick={handleToggleCollapse}
    >
      {isCollapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
      <BranchesOutlined />
      <Text strong>页面溯源</Text>
    </div>
  )

  const content = (
    <div style={{ fontSize: size === 'small' ? '12px' : '14px' }}>
      <Space direction="vertical" size={size === 'small' ? 8 : 16} style={{ width: '100%' }}>
        {/* 折叠标题 */}
        {collapseHeader}

        {/* 折叠内容 */}
        {!isCollapsed && (
          <>
            {/* 当前页面信息 */}
            <div style={{ marginLeft: '16px' }}>
              <Space>
                {getPageTypeIcon(currentPage.type)}
                <Text strong>{currentPage.title}</Text>
                <Tag color="blue">{getPageTypeName(currentPage.type)}</Tag>
              </Space>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            {/* 来源信息 */}
            <div style={{ marginLeft: '16px' }}>
              <Space style={{ marginBottom: '8px' }}>
                <HistoryOutlined />
                <Text strong>来源：</Text>
                {getSourceIcon(lineage.source)}
                <Text>{getSourceDescription(lineage.source)}</Text>
              </Space>

              {sourcePage && (
                <div style={{ marginLeft: '16px', marginBottom: '8px' }}>
                  <Space>
                    <Text type="secondary">源页面：</Text>
                    <Button
                      type="link"
                      size="small"
                      icon={getPageTypeIcon(sourcePage.type)}
                      onClick={() => handleNavigateToPage(sourcePage.id)}
                      style={{ padding: 0, height: 'auto' }}
                    >
                      {sourcePage.title}
                    </Button>
                  </Space>
                </div>
              )}

              {contextDescription && (
                <div style={{ marginLeft: '16px', marginBottom: '8px' }}>
                  <Paragraph
                    type="secondary"
                    style={{
                      fontSize: size === 'small' ? '11px' : '12px',
                      margin: 0,
                      fontStyle: 'italic'
                    }}
                  >
                    {contextDescription}
                  </Paragraph>
                </div>
              )}

              {lineage.generatedAt && (
                <div style={{ marginLeft: '16px' }}>
                  <Text type="secondary" style={{ fontSize: size === 'small' ? '11px' : '12px' }}>
                    生成时间：{new Date(lineage.generatedAt).toLocaleString('zh-CN')}
                  </Text>
                </div>
              )}
            </div>

            {/* 后续生成的页面 */}
            {generatedPages.length > 0 && (
              <div style={{ marginLeft: '16px' }}>
                <Space style={{ marginBottom: '8px' }}>
                  <ArrowRightOutlined />
                  <Text strong>后续生成：</Text>
                </Space>
                <div style={{ marginLeft: '16px' }}>
                  <Space direction="vertical" size={4}>
                    {generatedPages.map((page) => (
                      <Space key={page.id}>
                        <Button
                          type="link"
                          size="small"
                          icon={getPageTypeIcon(page.type)}
                          onClick={() => handleNavigateToPage(page.id)}
                          style={{ padding: 0, height: 'auto' }}
                        >
                          {page.title}
                        </Button>
                        <Tag color="green">{getPageTypeName(page.type)}</Tag>
                      </Space>
                    ))}
                  </Space>
                </div>
              </div>
            )}

            {/* 溯源时间线 */}
            {(sourcePage || generatedPages.length > 0) && (
              <div style={{ marginLeft: '16px' }}>
                <Space style={{ marginBottom: '8px' }}>
                  <LinkOutlined />
                  <Text strong>溯源链路：</Text>
                </Space>
                <Timeline
                  items={[
                    ...(sourcePage
                      ? [
                          {
                            dot: getSourceIcon(lineage.source),
                            children: (
                              <Space>
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={() => handleNavigateToPage(sourcePage.id)}
                                  style={{ padding: 0, height: 'auto' }}
                                >
                                  {sourcePage.title}
                                </Button>
                                <Tag>{getPageTypeName(sourcePage.type)}</Tag>
                              </Space>
                            )
                          }
                        ]
                      : []),
                    {
                      dot: getPageTypeIcon(currentPage.type),
                      children: (
                        <Space>
                          <Text strong>{currentPage.title}</Text>
                          <Tag color="blue">{getPageTypeName(currentPage.type)}</Tag>
                          <Text type="secondary">当前页面</Text>
                        </Space>
                      )
                    },
                    ...generatedPages.map((page) => ({
                      dot: getPageTypeIcon(page.type),
                      children: (
                        <Space>
                          <Button
                            type="link"
                            size="small"
                            onClick={() => handleNavigateToPage(page.id)}
                            style={{ padding: 0, height: 'auto' }}
                          >
                            {page.title}
                          </Button>
                          <Tag color="green">{getPageTypeName(page.type)}</Tag>
                        </Space>
                      )
                    }))
                  ]}
                />
              </div>
            )}

            {/* 空状态 */}
            {lineage.source === 'user' && generatedPages.length === 0 && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="该页面为用户手动创建，暂无相关溯源信息"
                style={{ padding: '16px 0' }}
              />
            )}
          </>
        )}
      </Space>
    </div>
  )

  if (showInCard) {
    return (
      <Card
        size={size}
        style={{
          marginBottom: '16px',
          ...(size === 'small' && { fontSize: '12px' })
        }}
        bodyStyle={{
          padding: size === 'small' ? '12px' : '16px'
        }}
      >
        {content}
      </Card>
    )
  }

  return content
}

export default PageLineageDisplay
