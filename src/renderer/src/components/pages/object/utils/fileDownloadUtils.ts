export const downloadJSON = (data: any, filename: string): void => {
  const jsonString = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const createBlobURL = (content: string, type: string): string => {
  const blob = new Blob([content], { type })
  return URL.createObjectURL(blob)
}

export const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^a-z0-9_\-\.]/gi, '_')
}
