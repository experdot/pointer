import html2canvas from 'html2canvas'

/**
 * 将 DOM 元素转换为 canvas
 */
export async function captureElementToCanvas(
  element: HTMLElement,
  paddingV: number = 0,
  paddingH: number = 0
): Promise<HTMLCanvasElement> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    logging: false,
    useCORS: true
  })

  if (paddingV === 0 && paddingH === 0) {
    return canvas
  }

  // Create a new canvas with padding
  const paddedCanvas = document.createElement('canvas')
  paddedCanvas.width = canvas.width + 2 * paddingH
  paddedCanvas.height = canvas.height + 2 * paddingV
  const ctx = paddedCanvas.getContext('2d')

  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  // Fill the background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height)

  // Draw the original canvas with padding
  ctx.drawImage(canvas, paddingH, paddingV)

  return paddedCanvas
}

/**
 * 将 canvas 转换为 blob
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = 'image/png'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Failed to convert canvas to blob'))
      }
    }, type)
  })
}

/**
 * 将 blob 写入剪贴板
 */
export async function copyBlobToClipboard(blob: Blob): Promise<void> {
  await navigator.clipboard.write([
    new ClipboardItem({
      [blob.type]: blob
    })
  ])
}

/**
 * 将 canvas 转换为 data URL
 */
export function canvasToDataURL(canvas: HTMLCanvasElement, type: string = 'image/png'): string {
  return canvas.toDataURL(type)
}

/**
 * 将 data URL 转换为 blob（避免 CSP 问题）
 */
export function dataURLtoBlob(dataURL: string): Blob {
  const arr = dataURL.split(',')
  const mimeMatch = arr[0].match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

export async function captureDivToClipboard(
  div: HTMLDivElement,
  paddingV: number = 0,
  paddingH: number = 0
): Promise<boolean> {
  try {
    // Check if the input is a valid div element
    if (!(div instanceof HTMLDivElement)) {
      throw new Error('Invalid input: The provided element is not a valid HTMLDivElement.')
    }

    // Get the original size and position of the div
    const rect = div.getBoundingClientRect()
    const width = rect.width + paddingH * 2 // Add horizontal padding
    const height = rect.height + paddingV * 2 // Add vertical padding

    // Create a temporary container to render the content with padding
    const tempDiv = document.createElement('div')
    tempDiv.style.position = 'absolute'
    tempDiv.style.top = '-9999px' // Move out of the visible area
    tempDiv.style.width = `${width}px`
    tempDiv.style.height = `${height}px`
    tempDiv.style.boxSizing = 'border-box'
    tempDiv.style.background = 'white' // Set background color to avoid transparency

    const node = div.cloneNode(true) as HTMLDivElement
    node.style.padding = `${paddingV}px ${paddingH}px`
    tempDiv.appendChild(node)
    document.body.appendChild(tempDiv)

    // Use html2canvas to convert the temporary container to a canvas
    const canvas = await html2canvas(tempDiv, {
      scale: window.devicePixelRatio, // Ensure clarity on high-resolution devices
      useCORS: true // Enable this option if the div contains cross-origin images
    })

    // Remove the temporary container
    document.body.removeChild(tempDiv)

    // Convert the canvas to a Blob object
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to convert canvas to Blob.'))
        }
      }, 'image/png')
    })

    // Use the Clipboard API to write the Blob to the clipboard
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob
      })
    ])

    console.log('Image with padding successfully copied to clipboard!')

    return true
  } catch (error) {
    console.error('Failed to export div to image and copy to clipboard:', error)
    throw error // Throw the error for the caller to handle
  }
}
