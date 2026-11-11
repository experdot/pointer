import { parentPort, workerData } from 'node:worker_threads'
import { compileMatcher, type SearchMatchOptions } from '@shared/domain/search'

export interface SearchWork {
  texts: string[]
  query: string
  options: SearchMatchOptions
  maxResults: number
}
export interface TextRanges {
  index: number
  ranges: Array<{ start: number; end: number }>
}

const input = workerData as SearchWork
parentPort!.postMessage({ ready: true })
try {
  const matcher = compileMatcher(input.query, input.options)
  const result: TextRanges[] = []
  let count = 0
  for (let index = 0; index < input.texts.length; index++) {
    const ranges = matcher(input.texts[index])
    count += ranges.length
    if (count > input.maxResults) throw new Error('匹配结果过多，请缩小搜索范围')
    if (ranges.length) result.push({ index, ranges })
  }
  parentPort!.postMessage({ result })
} catch (error) {
  parentPort!.postMessage({ error: error instanceof Error ? error.message : String(error) })
}
