/**
 * 受控文本输入的本地草稿
 *
 * 设置面板的输入框直接绑定 store 里的设置文档，而文档更新要经过
 * "命令 → 内核写盘 → 事件回推"的异步往返。中文输入法组词期间，
 * 这个回推会把输入框的值改回旧内容，于是出现"又卡又串字"。
 *
 * 这里让输入框在聚焦/组词期间只用自己的本地值，外部值变化只在未编辑时同步。
 */

import { useCallback, useEffect, useRef, useState } from 'react'

interface DraftFieldHandlers {
  onFocus: () => void
  onBlur: () => void
  onCompositionStart: () => void
  onCompositionEnd: (event?: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => void
}

interface DraftField {
  value: string
  setValue: (next: string) => void
  handlers: DraftFieldHandlers
}

export function useDraftField(externalValue: string, commit: (next: string) => void): DraftField {
  const [value, setValue] = useState(externalValue)
  const editing = useRef(false)
  const composing = useRef(false)
  const commitRef = useRef(commit)
  commitRef.current = commit
  const valueRef = useRef(value)
  valueRef.current = value

  // 只有不在编辑中时才跟随外部值（内核回推、切换到另一个配置等）
  useEffect(() => {
    if (!editing.current && !composing.current) {
      setValue(externalValue)
    }
  }, [externalValue])

  const change = useCallback((next: string) => {
    setValue(next)
    // 组词过程不提交，等 compositionend 再提交完整文本
    if (!composing.current) commitRef.current(next)
  }, [])

  const handlers: DraftFieldHandlers = {
    onFocus: () => {
      editing.current = true
    },
    onBlur: () => {
      editing.current = false
      composing.current = false
    },
    onCompositionStart: () => {
      composing.current = true
    },
    onCompositionEnd: (event) => {
      composing.current = false
      // 部分浏览器组词结束后不再触发 change，这里补一次提交，避免拼音结果丢失
      const next = event?.currentTarget?.value
      if (typeof next === 'string' && next !== valueRef.current) {
        setValue(next)
        commitRef.current(next)
      }
    }
  }

  return { value, setValue: change, handlers }
}
