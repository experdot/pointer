import { msg, type LocalizedMessage } from '@shared/i18n/message'
import type { SearchMatchOptions } from '@shared/domain'
import { RuntimeError } from '@shared/contracts'
import createSearchWorker from './search.worker?nodeWorker'
import type { SearchWork, TextRanges } from './search.worker'

interface Job {
  cancel: () => Promise<void>
  finished: Promise<void>
}

/** 不在 Electron 主线程执行用户正则；有界并发、输入/结果预算和可终止的时间预算。 */
export class SearchExecutor {
  private readonly jobs = new Set<Job>()
  private disposed = false

  constructor(
    private readonly limits = { timeoutMs: 1000, maxBytes: 32 * 1024 * 1024, maxResults: 50000 }
  ) {}

  async run(texts: string[], query: string, options: SearchMatchOptions): Promise<TextRanges[]> {
    if (this.disposed) throw new RuntimeError('search.closed', msg('errors.search.closed'))
    const bytes = texts.reduce((sum, text) => sum + text.length * 2, query.length * 2)
    if (bytes > this.limits.maxBytes)
      throw new RuntimeError('search.input-limit', msg('errors.search.inputTooLarge'))
    while (this.jobs.size >= 2) await this.jobs.values().next().value!.cancel()
    if (this.disposed) throw new RuntimeError('search.closed', msg('errors.search.closed'))
    const worker = createSearchWorker({
      workerData: { texts, query, options, maxResults: this.limits.maxResults } satisfies SearchWork
    })
    let done!: () => void
    const finished = new Promise<void>((resolve) => {
      done = resolve
    })
    let settle!: (value?: TextRanges[], error?: Error) => Promise<void>
    const job: Job = {
      finished,
      cancel: async () => {
        await settle(
          undefined,
          new RuntimeError('search.superseded', msg('errors.search.canceled'))
        )
        await finished
      }
    }
    const result = new Promise<TextRanges[]>((resolve, reject) => {
      let settled = false
      let timer: ReturnType<typeof setTimeout>
      settle = async (value, error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        worker.removeAllListeners()
        worker.on('error', () => undefined)
        try {
          await worker.terminate()
          if (error) reject(error)
          else resolve(value ?? [])
        } catch (terminationError) {
          reject(terminationError)
        } finally {
          this.jobs.delete(job)
          done()
        }
      }
      const timeout = (): void => {
        void settle(undefined, new RuntimeError('search.timeout', msg('errors.search.timeout')))
      }
      timer = setTimeout(timeout, 5000)
      worker.on(
        'message',
        (message: {
          ready?: boolean
          result?: TextRanges[]
          error?: string
          localized?: LocalizedMessage
        }) => {
          if (message.ready) {
            clearTimeout(timer)
            timer = setTimeout(timeout, this.limits.timeoutMs)
          } else if (message.error)
            void settle(
              undefined,
              new RuntimeError('search.result-limit', message.localized ?? message.error)
            )
          else void settle(message.result)
        }
      )
      worker.on('error', (error) => {
        void settle(undefined, error)
      })
      worker.on('exit', () => {
        void settle(
          undefined,
          new RuntimeError('search.worker-exited', msg('errors.search.workerExited'))
        )
      })
    })
    this.jobs.add(job)
    return result
  }

  async dispose(): Promise<void> {
    this.disposed = true
    await Promise.all([...this.jobs].map((job) => job.cancel()))
  }
}
