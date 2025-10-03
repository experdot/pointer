import { useState, useCallback } from 'react'

export function useCanvasZoom() {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null)

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((prev) => Math.max(0.1, Math.min(5, prev * delta)))
  }, [])

  const handlePanStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    }
  }, [offset])

  const handlePanMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPanning && panStart) {
        setOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y
        })
      }
    },
    [isPanning, panStart]
  )

  const handlePanEnd = useCallback(() => {
    setIsPanning(false)
    setPanStart(null)
  }, [])

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(5, prev * 1.2))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(0.1, prev * 0.8))
  }, [])

  const resetZoom = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  return {
    scale,
    offset,
    isPanning,
    handleWheel,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    zoomIn,
    zoomOut,
    resetZoom,
    setScale,
    setOffset
  }
}
