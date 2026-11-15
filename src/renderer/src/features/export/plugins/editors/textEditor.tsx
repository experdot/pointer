import type { FC } from 'react'
import { useState, useEffect, useCallback } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import { Alert, Spin } from 'antd'
import { rendererI18n, useI18n } from '@renderer/i18n'
import { errorMessage } from '@renderer/runtime/client'
import type { EditorPlugin, EditorProps, FormatType } from '../../types'

let monacoLoading: Promise<void> | undefined

/** NLS 必须先于 Monaco 模块执行。编辑器只从本地产物加载。 */
function initializeMonaco(): Promise<void> {
  monacoLoading ??= (async () => {
    if (rendererI18n.language === 'zh-CN') {
      await import('monaco-editor/esm/nls.messages.zh-cn.js')
    }
    const monaco = await import('monaco-editor')
    loader.config({ monaco })
    await loader.init()
  })()
  return monacoLoading
}

/**
 * Get Monaco language identifier for format
 */
function getLanguageForFormat(format: FormatType): string {
  const languageMap: Record<string, string> = {
    markdown: 'markdown',
    txt: 'plaintext',
    html: 'html'
  }
  return languageMap[format] || 'plaintext'
}

/**
 * Monaco Text Editor Component
 *
 * Provides advanced text editing with:
 * - Syntax highlighting
 * - Line numbers
 * - Auto-completion (for Markdown/HTML)
 * - Search and replace
 * - Theme follows system preference
 */
// eslint-disable-next-line react-refresh/only-export-components
const MonacoTextEditorComponent: FC<EditorProps> = ({ content, format, options, onChange }) => {
  const { t } = useI18n()
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const textContent = typeof content === 'string' ? content : ''
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('light')

  useEffect(() => {
    let active = true
    void initializeMonaco().then(
      () => {
        if (active) setReady(true)
      },
      (error) => {
        if (active) setLoadError(errorMessage(error))
      }
    )
    return () => {
      active = false
    }
  }, [])

  // Detect system theme
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setEditorTheme(mediaQuery.matches ? 'vs-dark' : 'light')

    const handler = (e: MediaQueryListEvent): void => {
      setEditorTheme(e.matches ? 'vs-dark' : 'light')
    }
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  const handleChange = useCallback(
    (value: string | undefined) => {
      onChange(value || '')
    },
    [onChange]
  )

  if (loadError) return <Alert type="error" message={t('app.errorTitle')} description={loadError} />
  if (!ready) return <Spin aria-label={t('common.loading')} />

  return (
    <div
      style={{
        height: '100%',
        background: 'var(--ant-color-bg-container)'
      }}
    >
      <Editor
        height="100%"
        loading={<Spin aria-label={t('common.loading')} />}
        language={getLanguageForFormat(format)}
        value={textContent}
        theme={editorTheme}
        onChange={handleChange}
        options={{
          fontSize: options.fontSize || 14,
          wordWrap: options.wordWrap ? 'on' : 'off',
          minimap: { enabled: false },
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          formatOnPaste: true,
          formatOnType: true,
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          guides: {
            indentation: true,
            bracketPairs: true
          },
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8
          }
        }}
      />
    </div>
  )
}

/**
 * Text Editor Plugin
 *
 * Supports editing markdown, txt, and html formats with Monaco Editor.
 */
export const textEditorPlugin: EditorPlugin = {
  id: 'text-editor',
  formats: ['markdown', 'txt', 'html'],
  Component: MonacoTextEditorComponent
}
