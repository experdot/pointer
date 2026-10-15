/**
 * 极简 CSV 解析（支持双引号包裹与 "" 转义）
 *
 * 导出编辑器与表格预览共用；空内容返回一个只有默认列名的空表。
 */

interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

export function parseCsv(csv: string): ParsedCsv {
  const lines = csv.trim().split('\n')
  if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
    return { headers: ['Column 1'], rows: [] }
  }

  const parseRow = (line: string): string[] => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(current)
        current = ''
      } else {
        current += char
      }
    }
    cells.push(current)
    return cells
  }

  return { headers: parseRow(lines[0]), rows: lines.slice(1).map(parseRow) }
}
