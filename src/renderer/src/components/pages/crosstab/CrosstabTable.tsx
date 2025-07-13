import React, { useMemo, useState, useEffect } from 'react'
import { Card, Table, Typography, Button, Tooltip, Space, Tag, Dropdown } from 'antd'
import { 
  TableOutlined, 
  FullscreenOutlined, 
  FullscreenExitOutlined,
  PlayCircleOutlined,
  LoadingOutlined,
  DeleteOutlined,
  CommentOutlined
} from '@ant-design/icons'
import { CrosstabMetadata, CrosstabMultiDimensionData } from '../../../types'
import { 
  generateAxisCombinations, 
  generateDimensionPath, 
} from './CrosstabUtils'

const { Text } = Typography

interface CrosstabTableProps {
  metadata: CrosstabMetadata | null
  tableData: CrosstabMultiDimensionData
  onGenerateColumn?: (columnPath: string) => void
  isGeneratingColumn?: string | null
  onGenerateRow?: (rowPath: string) => void
  isGeneratingRow?: string | null
  onGenerateCell?: (columnPath: string, rowPath: string) => void
  isGeneratingCell?: string | null
  onClearColumn?: (columnPath: string) => void
  onClearRow?: (rowPath: string) => void
  onClearCell?: (columnPath: string, rowPath: string) => void
  onCreateChatFromCell?: (
    columnPath: string,
    rowPath: string,
    cellContent: string,
    metadata: CrosstabMetadata | null
  ) => void
}

export default function CrosstabTable({
  metadata,
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
  const [selectedValueDimension, setSelectedValueDimension] = useState<string>('')

  // 初始化选中的值维度
  useEffect(() => {
    if (metadata && metadata.valueDimensions.length > 0 && !selectedValueDimension) {
      setSelectedValueDimension(metadata.valueDimensions[0].id)
    }
  }, [metadata, selectedValueDimension])

  // 生成多维度表格数据
  const { dataSource, columns } = useMemo(() => {
    if (!metadata || !metadata.horizontalDimensions.length || !metadata.verticalDimensions.length) {
      return { dataSource: [], columns: [] }
    }

    // 生成所有横轴和纵轴的组合
    const horizontalCombinations = generateAxisCombinations(metadata.horizontalDimensions)
    const verticalCombinations = generateAxisCombinations(metadata.verticalDimensions)

    // 生成数据源
    const dataSource = verticalCombinations.map((vCombination, index) => {
      const vPath = generateDimensionPath(vCombination)
      const row: any = {
        key: vPath,
        rowPath: vPath,
        rowLabels: vCombination
      }

      // 为每个横轴组合添加数据
      horizontalCombinations.forEach((hCombination) => {
        const hPath = generateDimensionPath(hCombination)
        const cellKey = `${hPath}|${vPath}`
        const cellData = tableData[cellKey]
        
        if (cellData && selectedValueDimension) {
          row[hPath] = cellData[selectedValueDimension] || ''
        } else {
          row[hPath] = ''
        }
      })

      return row
    })

    // 生成表格列
    const columns: any[] = []

    // 添加行标题列（纵轴）
    metadata.verticalDimensions.forEach((dimension, dimIndex) => {
      columns.push({
        title: () => {
          // 检查所有行是否有数据
          const hasRowData = Object.keys(tableData).some(cellKey => cellKey.includes('|'))
          
          // 创建行菜单项
          const rowMenuItems: any[] = [
            {
              key: 'generate-all-rows',
              icon: React.createElement(
                isGeneratingRow ? LoadingOutlined : PlayCircleOutlined
              ),
              label: hasRowData ? '重新生成所有行' : '生成所有行',
              onClick: () => {
                verticalCombinations.forEach((vCombination) => {
                  const vPath = generateDimensionPath(vCombination)
                  if (onGenerateRow) {
                    onGenerateRow(vPath)
                  }
                })
              },
              disabled: isGeneratingRow !== null
            }
          ]

          if (hasRowData && onClearRow) {
            rowMenuItems.push({
              key: 'clear-all-rows',
              icon: React.createElement(DeleteOutlined),
              label: '清除所有行',
              onClick: () => {
                verticalCombinations.forEach((vCombination) => {
                  const vPath = generateDimensionPath(vCombination)
                  if (onClearRow) {
                    onClearRow(vPath)
                  }
                })
              }
            })
          }

          return (
            <div className="row-header">
              <div className="row-title">{dimension.name}</div>
              {(onGenerateRow || onClearRow) && (
                <Dropdown
                  menu={{ items: rowMenuItems }}
                  trigger={['hover']}
                  placement="bottomRight"
                >
                  <div className="cell-menu-trigger" />
                </Dropdown>
              )}
            </div>
          )
        },
        dataIndex: ['rowLabels', dimIndex],
        key: `row-${dimension.id}`,
        width: 120,
        fixed: 'left',
        render: (text: string, record: any, index: number) => {
          // 检查该行是否已有数据
          const hasData = horizontalCombinations.some((hCombination) => {
            const hPath = generateDimensionPath(hCombination)
            const cellKey = `${hPath}|${record.rowPath}`
            return tableData[cellKey] && Object.keys(tableData[cellKey]).length > 0
          })

          // 创建菜单项
          const menuItems: any[] = [
            {
              key: 'generate',
              icon: React.createElement(
                isGeneratingRow === record.rowPath ? LoadingOutlined : PlayCircleOutlined
              ),
              label: hasData ? '重新生成此行' : '生成此行',
              onClick: () => onGenerateRow && onGenerateRow(record.rowPath),
              disabled: isGeneratingRow !== null
            }
          ]

          if (hasData && onClearRow) {
            menuItems.push({
              key: 'clear',
              icon: React.createElement(DeleteOutlined),
              label: '清除此行',
              onClick: () => onClearRow(record.rowPath)
            })
          }

          return (
            <div className="row-header">
              <div className="row-title">{text}</div>
              {(onGenerateRow || onClearRow) && (
                <Dropdown
                  menu={{ items: menuItems }}
                  trigger={['hover']}
                  placement="bottomRight"
                >
                  <div className="cell-menu-trigger" />
                </Dropdown>
              )}
            </div>
          )
        }
      })
    })

    // 添加横轴数据列
    horizontalCombinations.forEach((hCombination) => {
      const hPath = generateDimensionPath(hCombination)
      
      // 检查该列是否已有数据
      const hasColumnData = Object.keys(tableData).some(cellKey => 
        cellKey.startsWith(hPath + '|') && Object.keys(tableData[cellKey]).length > 0
      )
      
      columns.push({
        title: () => {
          // 创建菜单项
          const menuItems: any[] = [
            {
              key: 'generate',
              icon: React.createElement(
                isGeneratingColumn === hPath ? LoadingOutlined : PlayCircleOutlined
              ),
              label: hasColumnData ? '重新生成此列' : '生成此列',
              onClick: () => onGenerateColumn && onGenerateColumn(hPath),
              disabled: isGeneratingColumn !== null
            }
          ]

          if (hasColumnData && onClearColumn) {
            menuItems.push({
              key: 'clear',
              icon: React.createElement(DeleteOutlined),
              label: '清除此列',
              onClick: () => onClearColumn(hPath)
            })
          }

          return (
            <div className="column-header">
              <div className="column-title" style={{ textAlign: 'center' }}>
                {hCombination.map((value, index) => (
                  <div key={index} style={{ fontSize: index === 0 ? '12px' : '11px', fontWeight: index === 0 ? 'bold' : 'normal' }}>
                    {value}
                  </div>
                ))}
              </div>
              {(onGenerateColumn || onClearColumn) && (
                <Dropdown
                  menu={{ items: menuItems }}
                  trigger={['hover']}
                  placement="bottomRight"
                >
                  <div className="cell-menu-trigger" />
                </Dropdown>
              )}
            </div>
          )
        },
        dataIndex: hPath,
        key: hPath,
        width: 200,
        render: (text: string, record: any) => {
          const cellKey = `${hPath}|${record.rowPath}`
          const isGenerating = isGeneratingCell === cellKey

          // 创建菜单项
          const menuItems: any[] = [
            {
              key: 'generate',
              icon: React.createElement(isGenerating ? LoadingOutlined : PlayCircleOutlined),
              label: text ? '重新生成' : '生成内容',
              onClick: () => onGenerateCell && onGenerateCell(hPath, record.rowPath),
              disabled: isGeneratingCell !== null
            }
          ]

          if (text && onClearCell) {
            menuItems.push({
              key: 'clear',
              icon: React.createElement(DeleteOutlined),
              label: '清除内容',
              onClick: () => onClearCell(hPath, record.rowPath)
            })
          }

          if (text && onCreateChatFromCell) {
            menuItems.push({
              key: 'chat',
              icon: React.createElement(CommentOutlined),
              label: '创建对话',
              onClick: () => onCreateChatFromCell(hPath, record.rowPath, text, metadata)
            })
          }

          return (
            <div className="cell-content">
              <div 
                className={`cell-text ${isGenerating ? 'generating' : ''} ${!text ? 'empty' : ''}`}
                style={{ 
                  minHeight: '24px', 
                  padding: '4px',
                  backgroundColor: isGenerating ? '#f0f0f0' : 'transparent',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
                onClick={() => {
                  if (!isGenerating && onGenerateCell) {
                    onGenerateCell(hPath, record.rowPath)
                  }
                }}
              >
                {isGenerating ? (
                  <Text type="secondary">生成中...</Text>
                ) : text ? (
                  <Text style={{ fontSize: '12px' }}>{text}</Text>
                ) : (
                  <Text type="secondary" style={{ fontSize: '12px' }}>点击生成</Text>
                )}
              </div>
              <Dropdown
                menu={{ items: menuItems }}
                trigger={['hover']}
                placement="bottomRight"
              >
                <div className="cell-menu-trigger" />
              </Dropdown>
            </div>
          )
        }
      })
    })

    return { dataSource, columns }
  }, [metadata, tableData, selectedValueDimension, isGeneratingCell, isGeneratingColumn, isGeneratingRow, onGenerateCell, onGenerateColumn, onGenerateRow, onClearColumn, onClearRow, onClearCell, onCreateChatFromCell])

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

  if (!metadata || dataSource.length === 0) {
    return (
      <Card className="tab-card">
        <div className="empty-state">
          <TableOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <div>
            <Text type="secondary">尚未生成多维度交叉分析表</Text>
            <br />
            <Text type="secondary">请先完成前面的步骤，然后生成表格数据</Text>
          </div>
        </div>
      </Card>
    )
  }

  // 创建extra内容（值维度选择器和全屏按钮）
  const extraContent = (
    <Space>
      {/* 值维度选择器 */}
      {metadata.valueDimensions.length > 1 && (
        <div>
          <Text style={{ marginRight: 8 }}>值维度:</Text>
          <Space wrap>
            {metadata.valueDimensions.map((dim) => (
              <Tag
                key={dim.id}
                color={selectedValueDimension === dim.id ? 'blue' : 'default'}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedValueDimension(dim.id)}
              >
                {dim.name}
              </Tag>
            ))}
          </Space>
        </div>
      )}
      
      {/* 全屏按钮 */}
      <Tooltip title={isFullscreen ? '退出全屏' : '全屏显示'}>
        <Button
          type="text"
          size="small"
          icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          onClick={toggleFullscreen}
        />
      </Tooltip>
    </Space>
  )

  return (
    <Card
      title="多维度交叉分析表"
      extra={extraContent}
      className={`tab-card table-card ${isFullscreen ? 'fullscreen-card' : ''}`}
    >
      <Table 
        columns={columns} 
        dataSource={dataSource} 
        pagination={false} 
        bordered 
        size="small"
        scroll={{ x: 'max-content' }}
      />
    </Card>
  )
}
