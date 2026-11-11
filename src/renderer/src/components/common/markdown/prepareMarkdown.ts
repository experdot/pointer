import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMath from 'remark-math'

const parser = unified().use(remarkParse).use(remarkMath)

/** 兼容金额和 LaTeX 括号时保护所有 Markdown 代码范围，包括未闭合的流式围栏。 */
export function prepareMarkdown(text: string): string {
  const tree = parser.parse(text)
  const stack = [...tree.children]
  const protectedRanges: Array<[number, number]> = []
  while (stack.length) {
    const node = stack.pop()!
    if (
      ['code', 'inlineCode', 'math', 'inlineMath', 'link', 'image', 'definition', 'html'].includes(
        node.type
      )
    ) {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      // “$5 和 $10” 中后一个金额符号不是前一个公式的结束；其余合法公式保持原文。
      const currencyPair =
        node.type === 'inlineMath' &&
        /^\d/.test(node.value) &&
        /[\s\\]$/.test(node.value) &&
        end !== undefined &&
        /\d/.test(text[end] ?? '')
      if (start !== undefined && end !== undefined && !currencyPair)
        protectedRanges.push([start, end])
    } else if ('children' in node) stack.push(...node.children)
  }
  protectedRanges.sort((a, b) => a[0] - b[0])
  let offset = 0
  const chunks: string[] = []
  for (const [start, end] of protectedRanges) {
    chunks.push(prepareText(text.slice(offset, start)), text.slice(start, end))
    offset = end
  }
  chunks.push(prepareText(text.slice(offset)))
  return chunks.join('')
}

function prepareText(text: string): string {
  return text
    .replace(/(?<!\\)\$(?=\d)/g, '\\$')
    .replace(/\\\[([\s\S]*?[^\\])\\\]|\\\((.*?)\\\)/g, (match, block, inline) =>
      block ? `$$${block}$$` : inline ? `$${inline}$` : match
    )
}
