import React, { useMemo, useState, useEffect } from 'react'
import { Card, Typography, Button, Tooltip, Space, Tag, Dropdown } from 'antd'
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
import './crosstab-table.css'

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
    if (metadata && metadata.valueDimensions.length > 0) {
      if (!selectedValueDimension || !metadata.valueDimensions.find(d => d.id === selectedValueDimension)) {
        setSelectedValueDimension(metadata.valueDimensions[0].id)
      }
    }
  }, [metadata, selectedValueDimension])

  // 生成多维度网格数据
  const { horizontalCombinations, verticalCombinations, gridData } = useMemo(() => {
    if (!metadata || !metadata.horizontalDimensions.length || !metadata.verticalDimensions.length) {
      return { horizontalCombinations: [], verticalCombinations: [], gridData: {} }
    }

    const horizontalCombinations = generateAxisCombinations(metadata.horizontalDimensions)
    const verticalCombinations = generateAxisCombinations(metadata.verticalDimensions)

    // 生成网格数据
    const gridData: { [key: string]: string } = {}
    
    verticalCombinations.forEach((vCombination) => {
      const vPath = generateDimensionPath(vCombination)
      horizontalCombinations.forEach((hCombination) => {
        const hPath = generateDimensionPath(hCombination)
        const cellKey = `${hPath}|${vPath}`
        const cellData = tableData[cellKey]
        
        if (cellData && selectedValueDimension) {
          gridData[cellKey] = cellData[selectedValueDimension] || ''
        } else if (cellData && !selectedValueDimension && metadata.valueDimensions.length > 0) {
          const firstValueDimension = metadata.valueDimensions[0].id
          gridData[cellKey] = cellData[firstValueDimension] || ''
        } else if (!gridData[cellKey] && cellData && Object.keys(cellData).length > 0) {
          const firstAvailableKey = Object.keys(cellData)[0]
          gridData[cellKey] = cellData[firstAvailableKey] || ''
        } else {
          gridData[cellKey] = ''
        }
      })
    })

    return { horizontalCombinations, verticalCombinations, gridData }
  }, [metadata, tableData, selectedValueDimension])

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

  if (!metadata || horizontalCombinations.length === 0 || verticalCombinations.length === 0) {
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

  // 创建列头菜单
  const createColumnMenu = (hPath: string, hasColumnData: boolean) => {
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

    return menuItems
  }

  // 创建行头菜单
  const createRowMenu = (vPath: string, hasRowData: boolean) => {
    const menuItems: any[] = [
      {
        key: 'generate',
        icon: React.createElement(
          isGeneratingRow === vPath ? LoadingOutlined : PlayCircleOutlined
        ),
        label: hasRowData ? '重新生成此行' : '生成此行',
        onClick: () => onGenerateRow && onGenerateRow(vPath),
        disabled: isGeneratingRow !== null
      }
    ]

    if (hasRowData && onClearRow) {
      menuItems.push({
        key: 'clear',
        icon: React.createElement(DeleteOutlined),
        label: '清除此行',
        onClick: () => onClearRow(vPath)
      })
    }

    return menuItems
  }

  // 创建单元格菜单
  const createCellMenu = (hPath: string, vPath: string, cellContent: string) => {
    const cellKey = `${hPath}|${vPath}`
    const isGenerating = isGeneratingCell === cellKey

    const menuItems: any[] = [
      {
        key: 'generate',
        icon: React.createElement(isGenerating ? LoadingOutlined : PlayCircleOutlined),
        label: cellContent ? '重新生成' : '生成内容',
        onClick: () => onGenerateCell && onGenerateCell(hPath, vPath),
        disabled: isGeneratingCell !== null
      }
    ]

    if (cellContent && onClearCell) {
      menuItems.push({
        key: 'clear',
        icon: React.createElement(DeleteOutlined),
        label: '清除内容',
        onClick: () => onClearCell(hPath, vPath)
      })
    }

    if (cellContent && onCreateChatFromCell) {
      menuItems.push({
        key: 'chat',
        icon: React.createElement(CommentOutlined),
        label: '创建对话',
        onClick: () => onCreateChatFromCell(hPath, vPath, cellContent, metadata)
      })
    }

    return menuItems
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

  // 计算网格布局参数
  const rowDimensions = metadata.verticalDimensions.length
  const colDimensions = metadata.horizontalDimensions.length
  const gridCols = colDimensions + horizontalCombinations.length
  const gridRows = rowDimensions + verticalCombinations.length
  
  // 调试信息
  console.log('Grid layout params:', {
    rowDimensions,
    colDimensions,
    gridCols,
    gridRows,
    horizontalCombinations: horizontalCombinations.length,
    verticalCombinations: verticalCombinations.length
  })

  return (
    <Card
      title="多维度交叉分析表"
      extra={extraContent}
      className={`tab-card table-card ${isFullscreen ? 'fullscreen-card' : ''}`}
    >
      <div 
        className="crosstab-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${colDimensions}, 120px) repeat(${horizontalCombinations.length}, 200px)`,
          gridTemplateRows: `repeat(${rowDimensions}, auto) repeat(${verticalCombinations.length}, auto)`,
          gap: '1px',
          backgroundColor: '#f0f0f0',
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          overflow: 'auto'
        }}
      >
        {/* 左上角空白区域 - 行头和列头的分隔区域 */}
        <div
          className="grid-corner"
          style={{
            gridColumn: `1 / ${colDimensions + 1}`,
            gridRow: `1 / ${rowDimensions + 1}`,
            backgroundColor: '#fafafa',
            border: '1px solid #d9d9d9',
            borderRadius: '4px 0 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span style={{ fontSize: '10px', color: '#999', transform: 'rotate(-45deg)' }}>
            维度
          </span>
        </div>

                {/* 列头区域 */}
        {(() => {
          const renderedHeaders = new Set<string>()
          const headerElements: React.ReactNode[] = []
          
          // 为每个维度层级生成表头
          for (let dimIndex = 0; dimIndex < metadata.horizontalDimensions.length; dimIndex++) {
            const dimension = metadata.horizontalDimensions[dimIndex]
            const remainingDimensions = metadata.horizontalDimensions.slice(dimIndex + 1)
            const isLastDimension = dimIndex === metadata.horizontalDimensions.length - 1
            
            if (isLastDimension) {
              // 叶子节点：为每个具体的组合生成表头
              horizontalCombinations.forEach((hCombination, colIndex) => {
                const value = hCombination[dimIndex]
                const headerKey = `${dimIndex}-${colIndex}-${value}`
                
                headerElements.push(
                                  <div
                  key={headerKey}
                  className="grid-column-header"
                  style={{
                    gridColumn: colDimensions + colIndex + 1,
                    gridRow: dimIndex + 1,
                    backgroundColor: 'white',
                    border: '1px solid #d9d9d9',
                    fontSize: dimIndex === 0 ? '12px' : '11px',
                    fontWeight: dimIndex === 0 ? 'bold' : 'normal'
                  }}
                >
                    {value}
                  </div>
                )
              })
            } else {
              // 非叶子节点：为每个维度值生成合并的表头
              const spanCount = remainingDimensions.reduce((acc, dim) => acc * dim.values.length, 1)
              
              dimension.values.forEach((value, valueIndex) => {
                const headerKey = `${dimIndex}-${value}`
                
                if (!renderedHeaders.has(headerKey)) {
                  renderedHeaders.add(headerKey)
                  
                  // 计算起始列位置
                  const startCol = colDimensions + 1 + valueIndex * spanCount
                  
                  headerElements.push(
                    <div
                      key={headerKey}
                      className="grid-column-header"
                      style={{
                        gridColumn: `${startCol} / ${startCol + spanCount}`,
                        gridRow: dimIndex + 1,
                        backgroundColor: 'white',
                        border: '1px solid #d9d9d9',
                        fontSize: dimIndex === 0 ? '12px' : '11px',
                        fontWeight: dimIndex === 0 ? 'bold' : 'normal'
                      }}
                    >
                      {value}
                    </div>
                  )
                }
              })
            }
          }
          
          // 为最后一个维度的每个组合添加菜单
          if (onGenerateColumn || onClearColumn) {
            horizontalCombinations.forEach((hCombination, colIndex) => {
              const hPath = generateDimensionPath(hCombination)
              const hasColumnData = Object.keys(tableData).some(cellKey => 
                cellKey.startsWith(hPath + '|') && Object.keys(tableData[cellKey]).length > 0
              )
              
              headerElements.push(
                <div
                  key={`menu-${colIndex}`}
                  className="grid-column-menu"
                  style={{
                    gridColumn: colDimensions + colIndex + 1,
                    gridRow: metadata.horizontalDimensions.length,
                    backgroundColor: 'transparent',
                    border: 'none',
                    padding: '0',
                    position: 'relative',
                    height: '100%',
                    width: '100%',
                    pointerEvents: 'none'
                  }}
                >
                  <Dropdown
                    menu={{ items: createColumnMenu(hPath, hasColumnData) }}
                    trigger={['hover']}
                    placement="bottomRight"
                  >
                    <div 
                      className="cell-menu-trigger" 
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        pointerEvents: 'auto'
                      }}
                    />
                  </Dropdown>
                </div>
              )
            })
          }
          
          return headerElements
        })()}

        {/* 行头区域 */}
        {(() => {
          const renderedHeaders = new Set<string>()
          const headerElements: React.ReactNode[] = []
          
          // 为每个维度层级生成表头
          for (let dimIndex = 0; dimIndex < metadata.verticalDimensions.length; dimIndex++) {
            const dimension = metadata.verticalDimensions[dimIndex]
            const remainingDimensions = metadata.verticalDimensions.slice(dimIndex + 1)
            const isLastDimension = dimIndex === metadata.verticalDimensions.length - 1
            
            if (isLastDimension) {
              // 叶子节点：为每个具体的组合生成表头
              verticalCombinations.forEach((vCombination, rowIndex) => {
                const value = vCombination[dimIndex]
                const headerKey = `${dimIndex}-${rowIndex}-${value}`
                
                headerElements.push(
                                  <div
                  key={headerKey}
                  className="grid-row-header"
                  style={{
                    gridColumn: dimIndex + 1,
                    gridRow: rowDimensions + rowIndex + 1,
                    backgroundColor: 'white',
                    border: '1px solid #d9d9d9',
                    fontSize: '12px',
                    fontWeight: dimIndex === 0 ? 'bold' : 'normal'
                  }}
                >
                    {value}
                  </div>
                )
              })
            } else {
              // 非叶子节点：为每个维度值生成合并的表头
              const spanCount = remainingDimensions.reduce((acc, dim) => acc * dim.values.length, 1)
              
              dimension.values.forEach((value, valueIndex) => {
                const headerKey = `${dimIndex}-${value}`
                
                if (!renderedHeaders.has(headerKey)) {
                  renderedHeaders.add(headerKey)
                  
                  // 计算起始行位置
                  const startRow = rowDimensions + 1 + valueIndex * spanCount
                  
                  headerElements.push(
                    <div
                      key={headerKey}
                      className="grid-row-header"
                      style={{
                        gridColumn: dimIndex + 1,
                        gridRow: `${startRow} / ${startRow + spanCount}`,
                        backgroundColor: 'white',
                        border: '1px solid #d9d9d9',
                        fontSize: '12px',
                        fontWeight: dimIndex === 0 ? 'bold' : 'normal'
                      }}
                    >
                      {value}
                    </div>
                  )
                }
              })
            }
          }
          
          // 为最后一个维度的每个组合添加菜单
          if (onGenerateRow || onClearRow) {
            verticalCombinations.forEach((vCombination, rowIndex) => {
              const vPath = generateDimensionPath(vCombination)
              const hasRowData = horizontalCombinations.some((hCombination) => {
                const hPath = generateDimensionPath(hCombination)
                const cellKey = `${hPath}|${vPath}`
                return tableData[cellKey] && Object.keys(tableData[cellKey]).length > 0
              })
              
              headerElements.push(
                <div
                  key={`menu-${rowIndex}`}
                  className="grid-row-menu"
                  style={{
                    gridColumn: metadata.verticalDimensions.length,
                    gridRow: rowDimensions + rowIndex + 1,
                    backgroundColor: 'transparent',
                    border: 'none',
                    padding: '0',
                    position: 'relative',
                    height: '100%',
                    width: '100%',
                    pointerEvents: 'none'
                  }}
                >
                  <Dropdown
                    menu={{ items: createRowMenu(vPath, hasRowData) }}
                    trigger={['hover']}
                    placement="bottomRight"
                  >
                    <div 
                      className="cell-menu-trigger" 
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        pointerEvents: 'auto'
                      }}
                    />
                  </Dropdown>
                </div>
              )
            })
          }
          
          return headerElements
        })()}

        {/* 数据单元格区域 */}
        {verticalCombinations.map((vCombination, rowIndex) => {
          const vPath = generateDimensionPath(vCombination)
          
          return horizontalCombinations.map((hCombination, colIndex) => {
            const hPath = generateDimensionPath(hCombination)
            const cellKey = `${hPath}|${vPath}`
            const cellContent = gridData[cellKey] || ''
            const isGenerating = isGeneratingCell === cellKey

            return (
              <div
                key={cellKey}
                className="grid-data-cell"
                style={{
                  gridColumn: colDimensions + colIndex + 1,
                  gridRow: rowDimensions + rowIndex + 1,
                  backgroundColor: isGenerating ? '#f0f0f0' : 'white',
                  border: '1px solid #d9d9d9',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (!isGenerating && onGenerateCell) {
                    onGenerateCell(hPath, vPath)
                  }
                }}
              >
                <div className="cell-content">
                  <div className="cell-text" style={{ fontSize: '12px' }}>
                    {isGenerating ? (
                      <Text type="secondary">生成中...</Text>
                    ) : cellContent ? (
                      <Text>{cellContent}</Text>
                    ) : (
                      <Text type="secondary">点击生成</Text>
                    )}
                  </div>
                </div>
                <Dropdown
                  menu={{ items: createCellMenu(hPath, vPath, cellContent) }}
                  trigger={['hover']}
                  placement="bottomRight"
                >
                  <div className="cell-menu-trigger" />
                </Dropdown>
              </div>
            )
          })
        })}
      </div>
    </Card>
  )
}
