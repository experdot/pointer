/** CSV 状态机遍历完整输入，保留引号内换行、空格和尾部空列。 */
interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

export function parseCsv(csv: string): ParsedCsv {
  const text = csv.replace(/^\uFEFF/, '')
  if (!text) return { headers: ['Column 1'], rows: [] }
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (quoted || cell.length === 0) quoted = !quoted
      else cell += char
    } else if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\r' || char === '\n') && !quoted) {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      if (char === '\r' && text[i + 1] === '\n') i++
    } else cell += char
  }
  if (cell.length || row.length || !/[\r\n]$/.test(text)) {
    row.push(cell)
    rows.push(row)
  }
  return { headers: rows[0] ?? ['Column 1'], rows: rows.slice(1) }
}
