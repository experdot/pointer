/** 表格软件导入时保护公式前缀，并保留逗号、引号和换行。 */
export function encodeCsvRows(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = /^[\s\uFEFF]*[=+\-@]/.test(cell) ? `'${cell}` : cell
          return /[,"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
        })
        .join(',')
    )
    .join('\n')
}
