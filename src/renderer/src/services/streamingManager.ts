import type { AIService } from './aiService'

type StreamingData = {
  pageId: string
  messageId: string
  content: string
  reasoning?: string
  aiService?: AIService
}

type Listener = () => void

class StreamingManager {
  // 支持多个并行 streaming，key 是 messageId
  private dataMap = new Map<string, StreamingData>()
  private listeners = new Set<Listener>()
  private rafId: number | null = null

  start(pageId: string, messageId: string, aiService?: AIService): void {
    this.dataMap.set(messageId, { pageId, messageId, content: '', aiService })
    this.notify()
  }

  setAIService(messageId: string, aiService: AIService): void {
    const data = this.dataMap.get(messageId)
    if (data) {
      data.aiService = aiService
    }
  }

  update(messageId: string, content: string, reasoning?: string): void {
    const data = this.dataMap.get(messageId)
    if (!data) return
    data.content = content
    data.reasoning = reasoning
    this.scheduleNotify()
  }

  finish(messageId: string): StreamingData | null {
    const result = this.dataMap.get(messageId) ?? null
    this.dataMap.delete(messageId)
    this.notify()
    return result
  }

  abort(messageId: string): void {
    this.dataMap.delete(messageId)
    this.notify()
  }

  async stop(messageId: string): Promise<StreamingData | null> {
    const data = this.dataMap.get(messageId)
    if (data?.aiService) {
      await data.aiService.stopStreaming()
    }
    return this.finish(messageId)
  }

  async stopAll(): Promise<StreamingData[]> {
    const messageIds = Array.from(this.dataMap.keys())
    const results = await Promise.all(messageIds.map((messageId) => this.stop(messageId)))
    return results.filter((item): item is StreamingData => item !== null)
  }

  reset(): void {
    this.dataMap.clear()
    this.notify()
  }

  get(messageId: string): StreamingData | null {
    return this.dataMap.get(messageId) ?? null
  }

  isStreaming(messageId?: string): boolean {
    if (messageId) {
      return this.dataMap.has(messageId)
    }
    return this.dataMap.size > 0
  }

  subscribe(callback: Listener): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private scheduleNotify(): void {
    if (this.rafId !== null) return
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null
      this.listeners.forEach((l) => l())
    })
  }

  private notify(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.listeners.forEach((l) => l())
  }
}

export const streamingManager = new StreamingManager()
