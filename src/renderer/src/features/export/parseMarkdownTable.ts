import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'

interface TextNode {
  type: string
  value?: string
  alt?: string | null
  children?: TextNode[]
}
const textOf = (node: TextNode): string =>
  node.value ?? node.alt ?? node.children?.map(textOf).join('') ?? ''

/** 共用 GFM AST，保留空列并正确处理转义的竖线。 */
export function parseMarkdownTable(markdown: string): string[][] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown)
  const table = tree.children.find((node) => node.type === 'table')
  if (!table || table.type !== 'table') return []
  const width = table.children[0]?.children.length ?? 0
  return table.children.map((row) =>
    Array.from({ length: width }, (_, index) =>
      row.children[index] ? textOf(row.children[index]) : ''
    )
  )
}
