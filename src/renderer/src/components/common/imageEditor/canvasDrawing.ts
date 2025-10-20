import { DrawMode, Point } from './types'

export class CanvasDrawing {
  static applyMosaic(ctx: CanvasRenderingContext2D, x: number, y: number, brushSize: number): void {
    const pixelSize = Math.max(8, brushSize)
    const imageData = ctx.getImageData(x - pixelSize, y - pixelSize, pixelSize * 2, pixelSize * 2)

    for (let py = 0; py < pixelSize * 2; py += pixelSize) {
      for (let px = 0; px < pixelSize * 2; px += pixelSize) {
        const i = (py * pixelSize * 2 + px) * 4
        const r = imageData.data[i]
        const g = imageData.data[i + 1]
        const b = imageData.data[i + 2]

        for (let dy = 0; dy < pixelSize; dy++) {
          for (let dx = 0; dx < pixelSize; dx++) {
            const pi = ((py + dy) * pixelSize * 2 + (px + dx)) * 4
            imageData.data[pi] = r
            imageData.data[pi + 1] = g
            imageData.data[pi + 2] = b
          }
        }
      }
    }

    ctx.putImageData(imageData, x - pixelSize, y - pixelSize)
  }

  static drawLine(
    ctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    color: string,
    brushSize: number,
    mode: DrawMode
  ): void {
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (mode === 'highlight') {
      ctx.globalAlpha = 0.3
      ctx.globalCompositeOperation = 'source-over'
    } else if (mode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }

    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  static drawRectangle(
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    color: string,
    brushSize: number
  ): void {
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y)
  }

  static drawArrow(
    ctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    color: string,
    brushSize: number
  ): void {
    const headLength = brushSize * 4
    const angle = Math.atan2(to.y - from.y, to.x - from.x)

    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'

    // 画线
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()

    // 画箭头
    ctx.beginPath()
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(
      to.x - headLength * Math.cos(angle - Math.PI / 6),
      to.y - headLength * Math.sin(angle - Math.PI / 6)
    )
    ctx.lineTo(
      to.x - headLength * Math.cos(angle + Math.PI / 6),
      to.y - headLength * Math.sin(angle + Math.PI / 6)
    )
    ctx.closePath()
    ctx.fill()
  }

  static clearCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  static drawImage(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    canvas: HTMLCanvasElement
  ): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
  }
}
