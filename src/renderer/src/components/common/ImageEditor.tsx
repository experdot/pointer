import React, { useRef, useEffect, useState } from 'react'
import { Button, Space, Slider, Radio, ColorPicker, Tooltip, Input } from 'antd'
import {
  BorderOutlined,
  EditOutlined,
  HighlightOutlined,
  UndoOutlined,
  RedoOutlined,
  CheckOutlined,
  CloseOutlined,
  FontSizeOutlined,
  DeleteOutlined,
  BorderInnerOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  FullscreenExitOutlined,
  ArrowRightOutlined
} from '@ant-design/icons'
import type { Color } from 'antd/es/color-picker'

interface ImageEditorProps {
  imageUrl: string
  onSave: (editedImageUrl: string) => void
  onCancel: () => void
}

type DrawMode = 'none' | 'mosaic' | 'draw' | 'rect' | 'text' | 'eraser' | 'highlight' | 'arrow'

interface DrawHistory {
  imageData: ImageData
}

interface TextItem {
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  color: string
  size: number
  isEditing: boolean
}

export default function ImageEditor({ imageUrl, onSave, onCancel }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawMode, setDrawMode] = useState<DrawMode>('none')
  const [brushSize, setBrushSize] = useState(5)
  const [drawColor, setDrawColor] = useState<string>('#ff0000')
  const [history, setHistory] = useState<DrawHistory[]>([])
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [fontSize, setFontSize] = useState(20)
  const [textItems, setTextItems] = useState<TextItem[]>([])
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [lastDrawPoint, setLastDrawPoint] = useState<{ x: number; y: number } | null>(null)
  const [isDraggingText, setIsDraggingText] = useState(false)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)

  // 高亮模式的临时画布
  const highlightCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // 不同工具的默认大小
  const toolDefaultSizes = {
    draw: 5,
    highlight: 24,
    mosaic: 24,
    rect: 4,
    arrow: 4,
    eraser: 20
  }

  // 当切换工具时，自动调整大小
  const handleModeChange = (newMode: DrawMode) => {
    setDrawMode(newMode)
    if (newMode !== 'none' && newMode !== 'text' && toolDefaultSizes[newMode]) {
      setBrushSize(toolDefaultSizes[newMode])
    }
  }

  // 缩放和拖拽状态
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null)

  // 初始化canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // 保持原始分辨率
      canvas.width = img.width
      canvas.height = img.height

      // 绘制原始尺寸图片
      ctx.drawImage(img, 0, 0)

      // 计算初始缩放以适应容器
      const containerWidth = container.clientWidth - 40 // 留些边距
      const containerHeight = container.clientHeight - 40
      const scaleX = containerWidth / img.width
      const scaleY = containerHeight / img.height
      const initialScale = Math.min(scaleX, scaleY, 1) // 不超过1倍（原始大小）
      setScale(initialScale)

      // 保存初始状态
      saveToHistory()
    }
    img.src = imageUrl
  }, [imageUrl])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentHistoryIndex, history])

  const saveToHistory = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // 删除当前索引后的历史记录
    const newHistory = history.slice(0, currentHistoryIndex + 1)
    newHistory.push({ imageData })

    // 限制历史记录数量
    if (newHistory.length > 20) {
      newHistory.shift()
    } else {
      setCurrentHistoryIndex(currentHistoryIndex + 1)
    }

    setHistory(newHistory)
  }

  const undo = () => {
    if (currentHistoryIndex <= 0) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const newIndex = currentHistoryIndex - 1
    ctx.putImageData(history[newIndex].imageData, 0, 0)
    setCurrentHistoryIndex(newIndex)
  }

  const redo = () => {
    if (currentHistoryIndex >= history.length - 1) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const newIndex = currentHistoryIndex + 1
    ctx.putImageData(history[newIndex].imageData, 0, 0)
    setCurrentHistoryIndex(newIndex)
  }

  // 处理鼠标滚轮缩放
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((prevScale) => Math.max(0.1, Math.min(5, prevScale * delta)))
  }

  // 处理拖拽
  const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
      // 中键、右键或 Shift+左键开始拖拽
      setIsPanning(true)
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
      e.preventDefault()
    }
  }

  const handlePanMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning && panStart) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
    }

    // 处理文本拖拽
    if (
      isDraggingText &&
      selectedTextId &&
      dragOffset &&
      containerRef.current &&
      canvasRef.current
    ) {
      const containerRect = containerRef.current.getBoundingClientRect()
      const canvas = canvasRef.current

      const canvasCenterX = containerRect.width / 2
      const canvasCenterY = containerRect.height / 2

      // 计算鼠标在canvas上的位置
      const screenX = e.clientX - dragOffset.x
      const screenY = e.clientY - dragOffset.y

      const canvasX = (screenX - canvasCenterX - offset.x) / scale + canvas.width / 2
      const canvasY = (screenY - canvasCenterY - offset.y) / scale + canvas.height / 2

      const newItems = textItems.map((t) =>
        t.id === selectedTextId ? { ...t, x: canvasX, y: canvasY } : t
      )
      setTextItems(newItems)
    }
  }

  const handlePanEnd = () => {
    setIsPanning(false)
    setPanStart(null)
    setIsDraggingText(false)
    setDragOffset(null)
  }

  // 重置视图到初始适应大小
  const handleResetView = () => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const containerWidth = container.clientWidth - 40
    const containerHeight = container.clientHeight - 40
    const scaleX = containerWidth / canvas.width
    const scaleY = containerHeight / canvas.height
    const initialScale = Math.min(scaleX, scaleY, 1)

    setScale(initialScale)
    setOffset({ x: 0, y: 0 })
  }

  // 绘制箭头的辅助函数
  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string,
    lineWidth: number
  ) => {
    const headLength = 15 // 箭头头部长度
    const angle = Math.atan2(toY - fromY, toX - fromX)

    // 绘制箭头线
    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    ctx.lineTo(toX, toY)
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.stroke()

    // 绘制箭头头部
    ctx.beginPath()
    ctx.moveTo(toX, toY)
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    )
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    )
    ctx.lineTo(toX, toY)
    ctx.fillStyle = color
    ctx.fill()
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) return

    const canvas = canvasRef.current
    if (!canvas || !containerRef.current) return

    const rect = canvas.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()

    // 计算 canvas 中心在容器中的位置
    const canvasCenterX = containerRect.width / 2
    const canvasCenterY = containerRect.height / 2

    // 将鼠标点击的屏幕坐标转换为 canvas 坐标
    const screenX = e.clientX - containerRect.left
    const screenY = e.clientY - containerRect.top
    const x = (screenX - canvasCenterX - offset.x) / scale + canvas.width / 2
    const y = (screenY - canvasCenterY - offset.y) / scale + canvas.height / 2

    if (drawMode === 'text') {
      // 检查是否有正在编辑的文本框
      const hasEditingText = textItems.some((item) => item.isEditing)

      if (hasEditingText) {
        // 如果有正在编辑的文本框，检查是否为空并移除
        const editingItem = textItems.find((item) => item.isEditing)
        if (editingItem && !editingItem.text.trim()) {
          // 移除空文本框
          setTextItems(textItems.filter((t) => t.id !== editingItem.id))
        } else {
          // 退出编辑状态
          setTextItems(textItems.map((t) => ({ ...t, isEditing: false })))
        }
        setSelectedTextId(null)

        // 不创建新文本框，直接返回
        return
      }

      // 文字模式：创建新文本框，让文本框的垂直中心对准鼠标点击位置
      const textWidth = 200
      const textHeight = 30
      const newTextItem: TextItem = {
        id: `text-${Date.now()}`,
        x: x - textWidth / 2, // 水平居中
        y: y - textHeight / 2, // 垂直居中
        width: textWidth,
        height: textHeight,
        text: '',
        color: drawColor,
        size: fontSize,
        isEditing: true
      }
      setTextItems([...textItems, newTextItem])
      setSelectedTextId(newTextItem.id)

      // 阻止事件传播，避免立即失焦
      e.preventDefault()
      e.stopPropagation()
      return
    }

    if (drawMode === 'none') return

    if (drawMode === 'rect' || drawMode === 'arrow') {
      // 矩形和箭头模式：记录起点
      setStartPoint({ x, y })
      setIsDrawing(true)
      return
    }

    // 高亮模式：创建临时canvas
    if (drawMode === 'highlight') {
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = canvas.width
      tempCanvas.height = canvas.height
      highlightCanvasRef.current = tempCanvas
    }

    setIsDrawing(true)
    setLastDrawPoint({ x, y })
    draw(x, y, true)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || drawMode === 'none' || isPanning) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    if ((drawMode === 'rect' || drawMode === 'arrow') && startPoint) {
      // 矩形和箭头模式：实时预览
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // 恢复历史状态
      if (currentHistoryIndex >= 0) {
        ctx.putImageData(history[currentHistoryIndex].imageData, 0, 0)
      }

      if (drawMode === 'rect') {
        // 绘制预览矩形
        ctx.strokeStyle = drawColor
        ctx.lineWidth = 3
        const width = x - startPoint.x
        const height = y - startPoint.y
        ctx.strokeRect(startPoint.x, startPoint.y, width, height)
      } else if (drawMode === 'arrow') {
        // 绘制预览箭头
        drawArrow(ctx, startPoint.x, startPoint.y, x, y, drawColor, 3)
      }
      return
    }

    draw(x, y, false)
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    if ((drawMode === 'rect' || drawMode === 'arrow') && startPoint) {
      // 完成矩形或箭头绘制
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) / scale
      const y = (e.clientY - rect.top) / scale

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // 恢复历史状态
      if (currentHistoryIndex >= 0) {
        ctx.putImageData(history[currentHistoryIndex].imageData, 0, 0)
      }

      if (drawMode === 'rect') {
        // 绘制最终矩形
        ctx.strokeStyle = drawColor
        ctx.lineWidth = 3
        const width = x - startPoint.x
        const height = y - startPoint.y
        ctx.strokeRect(startPoint.x, startPoint.y, width, height)
      } else if (drawMode === 'arrow') {
        // 绘制最终箭头
        drawArrow(ctx, startPoint.x, startPoint.y, x, y, drawColor, 3)
      }

      setStartPoint(null)
      saveToHistory()
    } else if (drawMode === 'highlight' && highlightCanvasRef.current) {
      // 高亮模式：合成临时canvas到主canvas
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.globalAlpha = 0.3
      ctx.drawImage(highlightCanvasRef.current, 0, 0)
      ctx.globalAlpha = 1

      highlightCanvasRef.current = null
      saveToHistory()
    } else if (isDrawing) {
      saveToHistory()
    }

    setIsDrawing(false)
    setLastDrawPoint(null)
  }

  const draw = (x: number, y: number, isStart: boolean) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (drawMode === 'mosaic') {
      // 马赛克效果
      const mosaicSize = brushSize
      const halfSize = mosaicSize / 2

      const startX = Math.max(0, Math.floor(x - halfSize))
      const startY = Math.max(0, Math.floor(y - halfSize))
      const width = Math.min(mosaicSize, canvas.width - startX)
      const height = Math.min(mosaicSize, canvas.height - startY)

      if (width > 0 && height > 0) {
        const imageData = ctx.getImageData(startX, startY, width, height)
        const data = imageData.data

        let r = 0,
          g = 0,
          b = 0
        const pixelCount = width * height

        for (let i = 0; i < data.length; i += 4) {
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
        }

        r = Math.floor(r / pixelCount)
        g = Math.floor(g / pixelCount)
        b = Math.floor(b / pixelCount)

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
        ctx.fillRect(startX, startY, width, height)
      }
    } else if (drawMode === 'draw') {
      // 绘图模式
      ctx.strokeStyle = drawColor
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = 1

      if (isStart || !lastDrawPoint) {
        ctx.beginPath()
        ctx.moveTo(x, y)
      } else {
        ctx.beginPath()
        ctx.moveTo(lastDrawPoint.x, lastDrawPoint.y)
        ctx.lineTo(x, y)
        ctx.stroke()
      }
      setLastDrawPoint({ x, y })
    } else if (drawMode === 'eraser') {
      // 橡皮擦模式 - 恢复原图
      const halfSize = brushSize / 2
      const startX = Math.max(0, Math.floor(x - halfSize))
      const startY = Math.max(0, Math.floor(y - halfSize))
      const width = Math.min(brushSize, canvas.width - startX)
      const height = Math.min(brushSize, canvas.height - startY)

      // 从初始状态恢复
      if (history.length > 0) {
        const originalImage = history[0].imageData
        const eraserData = ctx.createImageData(width, height)

        for (let dy = 0; dy < height; dy++) {
          for (let dx = 0; dx < width; dx++) {
            const srcIndex = ((startY + dy) * canvas.width + (startX + dx)) * 4
            const dstIndex = (dy * width + dx) * 4

            eraserData.data[dstIndex] = originalImage.data[srcIndex]
            eraserData.data[dstIndex + 1] = originalImage.data[srcIndex + 1]
            eraserData.data[dstIndex + 2] = originalImage.data[srcIndex + 2]
            eraserData.data[dstIndex + 3] = originalImage.data[srcIndex + 3]
          }
        }

        ctx.putImageData(eraserData, startX, startY)
      }
    } else if (drawMode === 'highlight') {
      // 高亮模式 - 在临时canvas上绘制
      const tempCanvas = highlightCanvasRef.current
      if (!tempCanvas) return

      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) return

      tempCtx.strokeStyle = drawColor
      tempCtx.lineWidth = brushSize
      tempCtx.lineCap = 'round'
      tempCtx.lineJoin = 'round'
      tempCtx.globalAlpha = 1 // 临时canvas上不透明

      if (isStart || !lastDrawPoint) {
        tempCtx.beginPath()
        tempCtx.moveTo(x, y)
      } else {
        tempCtx.beginPath()
        tempCtx.moveTo(lastDrawPoint.x, lastDrawPoint.y)
        tempCtx.lineTo(x, y)
        tempCtx.stroke()
      }
      setLastDrawPoint({ x, y })

      // 在主canvas上预览（半透明）
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (currentHistoryIndex >= 0) {
        ctx.putImageData(history[currentHistoryIndex].imageData, 0, 0)
      }
      ctx.globalAlpha = 0.3
      ctx.drawImage(tempCanvas, 0, 0)
      ctx.globalAlpha = 1
    }
  }

  // 应用所有文本到canvas
  const applyTextsToCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    textItems.forEach((item) => {
      if (item.text) {
        ctx.font = `${item.size}px Arial`
        ctx.fillStyle = item.color
        ctx.textBaseline = 'top'

        const lines = item.text.split('\n')
        const padding = 4

        lines.forEach((line, index) => {
          // 编辑器中文本显示位置：left: item.x, top: item.y, padding: 4
          // 所以 canvas 中也应该从 (item.x + padding, item.y + padding) 开始绘制
          ctx.fillText(line, item.x + padding, item.y + padding + index * item.size * 1.2)
        })
      }
    })

    // 清空文本项并保存
    setTextItems([])
    setSelectedTextId(null)
    saveToHistory()
  }

  const handleSave = () => {
    // 先应用所有文本
    if (textItems.length > 0) {
      applyTextsToCanvas()
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const editedImageUrl = canvas.toDataURL('image/png')
    onSave(editedImageUrl)
  }

  const canUndo = currentHistoryIndex > 0
  const canRedo = currentHistoryIndex < history.length - 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* 工具栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 8
        }}
      >
        <Space wrap>
          <span>工具：</span>
          <Radio.Group
            value={drawMode}
            onChange={(e) => handleModeChange(e.target.value)}
            buttonStyle="solid"
            size="small"
          >
            <Radio.Button value="none">
              <Tooltip title="选择">选择</Tooltip>
            </Radio.Button>
            <Radio.Button value="rect">
              <Tooltip title="矩形">
                <BorderInnerOutlined />
              </Tooltip>
            </Radio.Button>
            <Radio.Button value="arrow">
              <Tooltip title="箭头">
                <ArrowRightOutlined />
              </Tooltip>
            </Radio.Button>
            <Radio.Button value="draw">
              <Tooltip title="画笔">
                <EditOutlined />
              </Tooltip>
            </Radio.Button>
            <Radio.Button value="highlight">
              <Tooltip title="高亮">
                <HighlightOutlined />
              </Tooltip>
            </Radio.Button>
            <Radio.Button value="mosaic">
              <Tooltip title="马赛克">
                <BorderOutlined />
              </Tooltip>
            </Radio.Button>
            <Radio.Button value="text">
              <Tooltip title="文字">
                <FontSizeOutlined />
              </Tooltip>
            </Radio.Button>
            <Radio.Button value="eraser">
              <Tooltip title="橡皮擦">
                <DeleteOutlined />
              </Tooltip>
            </Radio.Button>
          </Radio.Group>

          {drawMode !== 'none' && drawMode !== 'text' && (
            <>
              <span style={{ marginLeft: 8 }}>大小：</span>
              <Slider
                style={{ width: 100 }}
                min={5}
                max={50}
                value={brushSize}
                onChange={setBrushSize}
              />
              <span>{brushSize}px</span>
            </>
          )}

          {(drawMode === 'draw' ||
            drawMode === 'rect' ||
            drawMode === 'arrow' ||
            drawMode === 'highlight' ||
            drawMode === 'text') && (
            <>
              <span style={{ marginLeft: 8 }}>颜色：</span>
              <ColorPicker
                value={drawColor}
                onChange={(color: Color) => setDrawColor(color.toHexString())}
                size="small"
              />
            </>
          )}

          {drawMode === 'text' && (
            <>
              <span style={{ marginLeft: 8 }}>字号：</span>
              <Slider
                style={{ width: 100 }}
                min={12}
                max={48}
                value={fontSize}
                onChange={setFontSize}
              />
              <span>{fontSize}px</span>
            </>
          )}

          <Button icon={<UndoOutlined />} onClick={undo} disabled={!canUndo} size="small">
            撤销
          </Button>
          <Button icon={<RedoOutlined />} onClick={redo} disabled={!canRedo} size="small">
            重做
          </Button>

          <span style={{ marginLeft: 16 }}>缩放：</span>
          <Button
            icon={<ZoomOutOutlined />}
            onClick={() => setScale((s) => Math.max(0.1, s * 0.9))}
            size="small"
          />
          <span style={{ margin: '0 8px' }}>{Math.round(scale * 100)}%</span>
          <Button
            icon={<ZoomInOutlined />}
            onClick={() => setScale((s) => Math.min(5, s * 1.1))}
            size="small"
          />
          <Tooltip title="重置视图（适应大小）">
            <Button icon={<FullscreenExitOutlined />} onClick={handleResetView} size="small" />
          </Tooltip>
        </Space>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#f5f5f5',
            cursor: isPanning ? 'grabbing' : drawMode === 'none' ? 'default' : 'crosshair',
            flex: 1,
            position: 'relative'
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
              transformOrigin: 'center center',
              transition: isPanning ? 'none' : 'transform 0.1s ease-out',
              maxWidth: 'none',
              maxHeight: 'none'
            }}
          />

          {/* 文本框覆盖层 */}
          {textItems.map((item) => {
            const canvas = canvasRef.current
            if (!canvas || !containerRef.current) return null

            const containerRect = containerRef.current.getBoundingClientRect()
            const canvasWidth = canvas.width * scale
            const canvasHeight = canvas.height * scale

            // 计算canvas在容器中的中心位置
            const canvasCenterX = containerRect.width / 2
            const canvasCenterY = containerRect.height / 2

            // 计算文本框的屏幕位置
            const screenX = canvasCenterX + (item.x - canvas.width / 2) * scale + offset.x
            const screenY = canvasCenterY + (item.y - canvas.height / 2) * scale + offset.y

            return (
              <div
                key={item.id}
                style={{
                  position: 'absolute',
                  left: screenX,
                  top: screenY,
                  width: item.width * scale,
                  minHeight: item.height * scale,
                  transform: 'translate(0, 0)',
                  pointerEvents: 'auto',
                  cursor: item.isEditing ? 'text' : 'move'
                }}
                onMouseDown={(e) => {
                  if (!item.isEditing) {
                    e.stopPropagation()
                    setSelectedTextId(item.id)
                    setIsDraggingText(true)
                    setDragOffset({
                      x: e.clientX - screenX,
                      y: e.clientY - screenY
                    })
                  }
                }}
                onDoubleClick={(e) => {
                  if (!item.isEditing) {
                    e.stopPropagation()
                    const newItems = textItems.map((t) =>
                      t.id === item.id ? { ...t, isEditing: true } : t
                    )
                    setTextItems(newItems)
                  }
                }}
              >
                {item.isEditing ? (
                  <Input.TextArea
                    autoFocus
                    value={item.text}
                    onChange={(e) => {
                      const newItems = textItems.map((t) =>
                        t.id === item.id ? { ...t, text: e.target.value } : t
                      )
                      setTextItems(newItems)
                    }}
                    onFocus={(e) => {
                      // 当输入框获得焦点时，阻止事件冒泡
                      e.stopPropagation()
                    }}
                    onBlur={(e) => {
                      // 失去焦点时不做任何操作
                      // 空文本框的移除由点击画布时处理
                    }}
                    onClick={(e) => {
                      // 阻止点击事件冒泡
                      e.stopPropagation()
                    }}
                    onMouseDown={(e) => {
                      // 阻止鼠标按下事件冒泡
                      e.stopPropagation()
                    }}
                    style={{
                      fontSize: item.size * scale,
                      color: item.color,
                      backgroundColor: 'transparent',
                      border: '2px solid #1890ff',
                      borderRadius: 4,
                      padding: 4,
                      resize: 'none',
                      fontFamily: 'Arial'
                    }}
                    autoSize={{ minRows: 1 }}
                  />
                ) : (
                  <div
                    style={{
                      fontSize: item.size * scale,
                      color: item.color,
                      backgroundColor:
                        selectedTextId === item.id ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
                      border:
                        selectedTextId === item.id ? '2px dashed #1890ff' : '2px solid transparent',
                      borderRadius: 4,
                      padding: 4,
                      fontFamily: 'Arial',
                      whiteSpace: 'pre-wrap',
                      minHeight: item.size * scale
                    }}
                  >
                    {item.text || '双击编辑'}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 底部按钮和提示 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 16
          }}
        >
          <div style={{ fontSize: '12px', color: '#666' }}>
            💡 滚轮缩放 · 右键/Shift+左键拖动视图
          </div>
          <Space>
            <Button icon={<CloseOutlined />} onClick={onCancel} size="small">
              取消
            </Button>
            <Button icon={<CheckOutlined />} type="primary" onClick={handleSave} size="small">
              完成
            </Button>
          </Space>
        </div>
      </div>
    </div>
  )
}
