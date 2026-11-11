import type { ChatMessage, PageFileDocument } from '../../src/shared/domain'

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export function treeDocument(
  size: number,
  seed: number,
  shape: 'deep' | 'wide' | 'random' = 'random'
): PageFileDocument {
  const random = seededRandom(seed)
  const messages: ChatMessage[] = []
  const branches = new Map<string | undefined, number>()
  for (let index = 0; index < size; index++) {
    const parentIndex =
      shape === 'deep' ? index - 1 : shape === 'wide' ? -1 : Math.floor(random() * (index + 1)) - 1
    const parentMessageId = parentIndex >= 0 ? `m-${parentIndex}` : undefined
    const branchIndex = branches.get(parentMessageId) ?? 0
    branches.set(parentMessageId, branchIndex + 1)
    messages.push({
      id: `m-${index}`,
      parentMessageId,
      branchIndex,
      createdAt: index + 1,
      role: index % 2 ? 'assistant' : 'user',
      content: `消息 ${seed}:${index} 中文😀 $1\n\n\`\`\`js\nconst text = '**literal**'\n\`\`\``,
      ...(index % 3 === 0 ? { reasoning: '思考 </details> & <tag>' } : {}),
      ...(index % 7 === 0 ? { starred: true, title: `标题 ${index}` } : {})
    })
  }
  return {
    version: 2,
    page: { id: `page-${seed}`, kind: 'page', name: '随机树', order: 0, createdAt: 1 },
    messages,
    topics: size ? [{ id: 'topic', name: '话题', startMessageId: 'm-0', collapsed: false }] : [],
    leafMessageId: messages.at(-1)?.id,
    selectedMessageId: messages[0]?.id
  }
}
