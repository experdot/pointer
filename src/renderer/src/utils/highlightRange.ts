/**
 * DOM 高亮工具
 *
 * 会话内查找与全局搜索跳转都要「把消息内容里的字符偏移映射到渲染后的 DOM 文本节点」，
 * 两者的文本收集、偏移索引与 Range 构造完全一致，因此集中在这里。
 */

export interface TextOffset {
  node: Text
  /** 该节点在拼接文本中的起始偏移（含） */
  start: number
  /** 该节点在拼接文本中的结束偏移（不含） */
  end: number
}

export interface TextIndex {
  /** 所有非空文本节点按 DOM 顺序拼接的结果 */
  fullText: string
  offsets: TextOffset[]
}

/** 收集元素下所有非空文本节点 */
export function collectTextNodes(root: Element): Text[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)

  let node: Node | null
  while ((node = walker.nextNode()) !== null) {
    const textNode = node as Text
    if (textNode.textContent) nodes.push(textNode)
  }

  return nodes
}

/** 拼接文本节点，并记录每个节点在拼接文本中的区间 */
export function buildTextIndex(root: Element): TextIndex {
  const offsets: TextOffset[] = []
  let fullText = ''

  for (const node of collectTextNodes(root)) {
    const text = node.textContent ?? ''
    offsets.push({ node, start: fullText.length, end: fullText.length + text.length })
    fullText += text
  }

  return { fullText, offsets }
}

/**
 * 在拼接文本中定位第 occurrenceIndex 个 matchText 的起始偏移
 *
 * Markdown 渲染会改变字符位置，因此只能按「该消息中的第 N 个命中」定位；找不到返回 -1。
 */
export function findOccurrenceOffset(
  fullText: string,
  matchText: string,
  occurrenceIndex: number
): number {
  if (!matchText) return -1

  let currentIndex = 0
  let searchStartIndex = 0

  for (;;) {
    const index = fullText.indexOf(matchText, searchStartIndex)
    if (index === -1) return -1
    if (currentIndex === occurrenceIndex) return index

    currentIndex += 1
    searchStartIndex = index + 1
  }
}

/** 根据拼接文本的偏移量创建 Range */
export function createRangeFromFullTextOffset(
  offsets: readonly TextOffset[],
  startOffset: number,
  endOffset: number
): Range | null {
  let startNode: Text | null = null
  let startLocalOffset = 0
  let endNode: Text | null = null
  let endLocalOffset = 0

  for (const { node, start, end } of offsets) {
    if (!startNode && startOffset >= start && startOffset < end) {
      startNode = node
      startLocalOffset = startOffset - start
    }

    if (endOffset > start && endOffset <= end) {
      endNode = node
      endLocalOffset = endOffset - start
    }

    if (startNode && endNode) break
  }

  if (!startNode || !endNode) return null

  try {
    const range = document.createRange()
    range.setStart(startNode, startLocalOffset)
    range.setEnd(endNode, endLocalOffset)
    return range
  } catch {
    return null
  }
}
