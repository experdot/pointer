import type { SourceData } from './types'

/** 预览和导出入口共用准备条件，空选区不能沿用旧预览。 */
export function isSourceDataReady(data: SourceData | null): boolean {
  if (!data) return false

  switch (data.type) {
    case 'messages':
      return data.selectedMessageIds.length > 0
    case 'text-snippet':
      return Boolean(data.text)
    case 'code-block':
      return Boolean(data.code)
    case 'table-block':
      return Boolean(data.markdown)
  }
}
