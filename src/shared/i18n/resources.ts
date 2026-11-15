import english from './en-US.json'
import chinese from './zh-CN.json'

export const en = english
export type TranslationKey = keyof typeof en
export const zh: Record<TranslationKey, string> = chinese
