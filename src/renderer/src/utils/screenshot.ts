import html2canvas from 'html2canvas'

export interface ScreenshotOptions {
  scale?: number
  backgroundColor?: string
}

/**
 * Sanitize CSS color values that html2canvas doesn't support
 */
function sanitizeColors(element: HTMLElement): void {
  const unsupportedColorFunctions = ['oklab', 'oklch', 'lab', 'lch', 'color-mix']

  const walkDOM = (node: Element): void => {
    if (node instanceof HTMLElement) {
      const style = node.style
      const computed = window.getComputedStyle(node)

      // Check common color properties
      const colorProps = ['color', 'backgroundColor', 'borderColor', 'outlineColor']
      for (const prop of colorProps) {
        const value = computed.getPropertyValue(prop.replace(/([A-Z])/g, '-$1').toLowerCase())
        if (value && unsupportedColorFunctions.some((fn) => value.includes(fn))) {
          // Replace with a fallback color
          if (prop === 'backgroundColor') {
            style.backgroundColor = '#ffffff'
          } else if (prop === 'color') {
            style.color = '#000000'
          } else {
            ;(style as unknown as Record<string, string>)[prop] = 'transparent'
          }
        }
      }
    }

    for (const child of node.children) {
      walkDOM(child)
    }
  }

  walkDOM(element)
}

/**
 * Take a screenshot of a DOM element
 */
export async function screenshotElement(
  element: HTMLElement,
  options: ScreenshotOptions = {}
): Promise<Blob> {
  const { scale = 2, backgroundColor = '#ffffff' } = options

  const canvas = await html2canvas(element, {
    scale,
    backgroundColor,
    useCORS: true,
    logging: false,
    onclone: (_doc, clonedElement) => {
      // Sanitize colors in the cloned element before rendering
      sanitizeColors(clonedElement)
    }
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))),
      'image/png'
    )
  })
}

/**
 * Download a Blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Copy image to clipboard
 */
export async function copyImageToClipboard(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}
