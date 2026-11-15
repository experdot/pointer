import { zh, type TranslationKey } from './resources'
import type { Translate, TranslationValues } from './index'

/** 错误和诊断携带语义键；领域层只构造数据，不读取当前界面语言。 */
export interface LocalizedMessage {
  key: TranslationKey
  values?: TranslationValues
}

export function msg(key: TranslationKey, values?: TranslationValues): LocalizedMessage {
  return { key, ...(values ? { values } : {}) }
}

export function sourceMessage(message: LocalizedMessage): string {
  return zh[message.key].replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    message.values?.[name] === undefined ? match : String(message.values[name])
  )
}

export function describe(
  key: TranslationKey,
  values?: TranslationValues
): {
  message: string
  localized: LocalizedMessage
} {
  const localized = msg(key, values)
  return { message: sourceMessage(localized), localized }
}

export class LocalizedError extends Error {
  readonly localized?: LocalizedMessage

  constructor(message: string | LocalizedMessage) {
    super(typeof message === 'string' ? message : sourceMessage(message))
    if (typeof message !== 'string') this.localized = message
  }
}

export const sourceTranslate: Translate = (key, values) => sourceMessage(msg(key, values))

export class LocalizedAggregateError extends AggregateError {
  readonly localized: LocalizedMessage

  constructor(errors: Iterable<unknown>, message: LocalizedMessage, options?: ErrorOptions) {
    super(errors, sourceMessage(message), options)
    this.localized = message
  }
}

export function formatError(error: unknown, translate: Translate): string {
  if (error && typeof error === 'object') {
    if ('localized' in error && error.localized && typeof error.localized === 'object') {
      const localized = error.localized as LocalizedMessage
      if (Object.hasOwn(zh, localized.key)) return translate(localized.key, localized.values)
    }
    if ('message' in error && typeof error.message === 'string') return error.message
  }
  return String(error)
}
