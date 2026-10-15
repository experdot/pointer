// 将 HTML 表格转换为 Markdown 格式
export function tableToMarkdown(table: HTMLTableElement): string {
  const rows: string[][] = []
  const tableRows = table.querySelectorAll('tr')

  tableRows.forEach((tr) => {
    const cells: string[] = []
    tr.querySelectorAll('th, td').forEach((cell) => {
      // 获取单元格文本内容，去除多余空白
      const text = (cell.textContent || '').trim().replace(/\|/g, '\\|')
      cells.push(text)
    })
    if (cells.length > 0) {
      rows.push(cells)
    }
  })

  if (rows.length === 0) return ''

  // 构建 Markdown 表格
  const lines: string[] = []
  const colCount = Math.max(...rows.map((r) => r.length))

  rows.forEach((row, idx) => {
    // 补齐列数
    while (row.length < colCount) row.push('')
    lines.push('| ' + row.join(' | ') + ' |')

    // 在第一行后添加分隔行
    if (idx === 0) {
      lines.push('| ' + row.map(() => '---').join(' | ') + ' |')
    }
  })

  return lines.join('\n')
}

// 获取选中文本
export function getSelectedText(): string {
  return window.getSelection()?.toString() || ''
}

// 过滤图片文件
export function filterImageFiles(files: FileList | File[]): File[] {
  return Array.from(files).filter((f) =>
    ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(f.type)
  )
}
