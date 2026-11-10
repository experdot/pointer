/** 将读改写作为一个任务串行执行；失败不会阻塞后续任务。 */
export class SerialExecutor {
  private tail: Promise<unknown> = Promise.resolve()

  run<T>(operation: () => Promise<T> | T): Promise<T> {
    const result = this.tail.then(operation)
    this.tail = result.catch(() => undefined)
    return result
  }

  async idle(): Promise<void> {
    await this.tail
  }
}
