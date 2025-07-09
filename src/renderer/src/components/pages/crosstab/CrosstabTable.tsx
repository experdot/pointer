import React, { useMemo, useState, useEffect } from 'react'
import { Card, Table, Typography, Button, Tooltip } from 'antd'
import { TableOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons'
import { CrosstabMetadata } from '../../../types'
import { generateTableData, generateTableColumns } from './CrosstabUtils'

const { Text } = Typography

interface CrosstabTableProps {
  metadata: CrosstabMetadata | null
  horizontalValues: string[]
  verticalValues: string[]
  tableData: { [key: string]: { [key: string]: string } }
  onGenerateColumn?: (horizontalItem: string) => void
  isGeneratingColumn?: string | null
  onGenerateRow?: (verticalItem: string) => void
  isGeneratingRow?: string | null
  onGenerateCell?: (horizontalItem: string, verticalItem: string) => void
  isGeneratingCell?: string | null
  onClearColumn?: (horizontalItem: string) => void
  onClearRow?: (verticalItem: string) => void
  onClearCell?: (horizontalItem: string, verticalItem: string) => void
  onCreateChatFromCell?: (
    horizontalItem: string,
    verticalItem: string,
    cellContent: string,
    metadata: CrosstabMetadata | null
  ) => void
}

export default function CrosstabTable({
  metadata,
  horizontalValues,
  verticalValues,
  tableData,
  onGenerateColumn,
  isGeneratingColumn,
  onGenerateRow,
  isGeneratingRow,
  onGenerateCell,
  isGeneratingCell,
  onClearColumn,
  onClearRow,
  onClearCell,
  onCreateChatFromCell
}: CrosstabTableProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  // 生成表格数据
  const data = useMemo(() => {
    return generateTableData(verticalValues, horizontalValues, tableData)
  }, [verticalValues, horizontalValues, tableData])

  // 生成表格列
  const columns = useMemo(() => {
    return generateTableColumns(
      metadata,
      horizontalValues,
      onGenerateColumn,
      isGeneratingColumn,
      tableData,
      onGenerateRow,
      isGeneratingRow,
      onGenerateCell,
      isGeneratingCell,
      onClearColumn,
      onClearRow,
      onClearCell,
      onCreateChatFromCell
    )
  }, [
    metadata,
    horizontalValues,
    onGenerateColumn,
    isGeneratingColumn,
    tableData,
    onGenerateRow,
    isGeneratingRow,
    onGenerateCell,
    isGeneratingCell,
    onClearColumn,
    onClearRow,
    onClearCell,
    onCreateChatFromCell
  ])

  // 处理全屏切换
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  // 处理ESC键退出全屏
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isFullscreen])

  // 创建extra内容（全屏按钮）
  const extraContent = (
    <Tooltip title={isFullscreen ? '退出全屏' : '全屏显示'}>
      <Button
        type="text"
        size="small"
        icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        onClick={toggleFullscreen}
      />
    </Tooltip>
  )

  if (data.length === 0) {
    return (
      <Card className="tab-card">
        <div className="empty-state">
          <TableOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <div>
            <Text type="secondary">尚未生成交叉分析表</Text>
            <br />
            <Text type="secondary">请先完成前面的步骤，然后使用左侧步骤中的"生成表格"按钮</Text>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card
      title="交叉分析表"
      extra={extraContent}
      className={`tab-card table-card ${isFullscreen ? 'fullscreen-card' : ''}`}
    >
      <Table columns={columns} dataSource={data} pagination={false} bordered size="small" />
    </Card>
  )
}
