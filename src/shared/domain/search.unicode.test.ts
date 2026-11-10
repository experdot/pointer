import { Worker } from 'node:worker_threads'
import { expect, it } from 'vitest'
import { compileMatcher } from './search'

it('[R17] Unicode 空匹配在独立可终止线程中结束', async () => {
  const worker = new Worker(
    `
    const { parentPort } = require('node:worker_threads')
    const MAX_MATCHES_PER_MESSAGE = 100
    const compileMatcher = ${compileMatcher.toString()}
    const options = { useRegex: true, matchCase: true, matchWholeWord: false }
    parentPort.postMessage(['(?=.)', '$', '(?:)', '(?=😀)|x'].map(query => compileMatcher(query, options)('😀😀x')))
  `,
    { eval: true }
  )
  try {
    const output = await new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        void worker.terminate()
        reject(new Error('Unicode 空匹配未结束'))
      }, 2000)
      worker.once('message', (value) => {
        clearTimeout(timer)
        resolve(value)
      })
      worker.once('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
    })
    expect(output).toEqual([[], [], [], [{ start: 4, end: 5 }]])
  } finally {
    await worker.terminate()
  }
})
