import './markdown.scss'
import './highlight.scss'

import ReactMarkdown from 'react-markdown'
import 'katex/dist/katex.min.css'
import RemarkMath from 'remark-math'
import RemarkBreaks from 'remark-breaks'
import RehypeKatex from 'rehype-katex'
import RemarkGfm from 'remark-gfm'
import RehypeHighlight from 'rehype-highlight'
import mermaid from 'mermaid'

import React from 'react'
import { useRef, useState, RefObject, useEffect, useMemo, ReactElement } from 'react'

import LoadingIcon from './three-dots.svg'
import { useDebouncedCallback } from 'use-debounce'
import { copyToClipboard } from './utils'

export function Mermaid(props: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (props.code && ref.current) {
      mermaid
        .run({
          nodes: [ref.current],
          suppressErrors: true
        })
        .catch((e) => {
          setHasError(true)
          console.error('[Mermaid] ', e.message)
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.code])

  function viewSvgInNewWindow() {
    const svg = ref.current?.querySelector('svg')
    if (!svg) return
    const text = new XMLSerializer().serializeToString(svg)
    alert('viewSvgInNewWindow' + text)
  }

  if (hasError) {
    return null
  }

  return (
    <div
      className="no-dark mermaid"
      style={{
        cursor: 'pointer',
        overflow: 'auto'
      }}
      ref={ref}
      onClick={() => viewSvgInNewWindow()}
    >
      {props.code}
    </div>
  )
}

export function TableWrapper(props: { children: ReactElement }) {
  const ref = useRef<HTMLDivElement>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [tableMarkdown, setTableMarkdown] = useState('')

  useEffect(() => {
    if (ref.current) {
      const table = ref.current.querySelector('table')
      if (table) {
        const markdown = convertTableToMarkdown(table)
        setTableMarkdown(markdown)
      }
    }
  }, [props.children])

  const convertTableToMarkdown = (table: HTMLTableElement): string => {
    const rows: string[][] = []
    const thead = table.querySelector('thead')
    const tbody = table.querySelector('tbody')

    if (thead) {
      const headerRow = thead.querySelector('tr')
      if (headerRow) {
        const headers = Array.from(headerRow.querySelectorAll('th')).map(
          (th) => th.textContent?.trim() || ''
        )
        rows.push(headers)
        rows.push(headers.map(() => '---'))
      }
    }

    if (tbody) {
      const bodyRows = tbody.querySelectorAll('tr')
      bodyRows.forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('td')).map(
          (td) => td.textContent?.trim() || ''
        )
        rows.push(cells)
      })
    }

    return rows.map((row) => '| ' + row.join(' | ') + ' |').join('\n')
  }

  const handleCopy = async () => {
    if (tableMarkdown) {
      const success = await copyToClipboard(tableMarkdown)
      if (success) {
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      }
    }
  }

  return (
    <div className="table-wrapper" ref={ref}>
      <span
        className={`copy-table-button ${isCopied ? 'copied' : ''}`}
        onClick={handleCopy}
        title={isCopied ? '已复制!' : '复制表格'}
      ></span>
      {props.children}
    </div>
  )
}

export function PreCode(props: { children: any }) {
  const ref = useRef<HTMLPreElement>(null)
  const refText = ref.current?.innerText
  const [mermaidCode, setMermaidCode] = useState('')
  const [isCopied, setIsCopied] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const renderMermaid = useDebouncedCallback(() => {
    if (!ref.current) return
    const mermaidDom = ref.current.querySelector('code.language-mermaid')
    if (mermaidDom) {
      setMermaidCode((mermaidDom as HTMLElement).innerText)
    }
  }, 600)

  useEffect(() => {
    setTimeout(renderMermaid, 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refText])

  const handleCopy = async () => {
    if (ref.current) {
      const code = ref.current.innerText
      const success = await copyToClipboard(code)
      if (success) {
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      }
    }
  }

  const handleDownload = async () => {
    if (ref.current) {
      const code = ref.current.innerText
      const codeElement = ref.current.querySelector('code')
      const language = codeElement?.className.match(/language-(\w+)/)?.[1] || 'txt'

      // 根据语言类型确定文件扩展名
      const extensionMap: Record<string, string> = {
        javascript: 'js',
        typescript: 'ts',
        python: 'py',
        java: 'java',
        cpp: 'cpp',
        csharp: 'cs',
        go: 'go',
        rust: 'rs',
        php: 'php',
        ruby: 'rb',
        swift: 'swift',
        kotlin: 'kt',
        shell: 'sh',
        bash: 'sh',
        powershell: 'ps1',
        json: 'json',
        xml: 'xml',
        yaml: 'yaml',
        yml: 'yml',
        markdown: 'md',
        html: 'html',
        css: 'css',
        scss: 'scss',
        sql: 'sql'
      }

      const extension = extensionMap[language] || language
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)

      setIsDownloading(true)
      try {
        await window.api.saveFile({
          content: code,
          defaultPath: `code-${timestamp}.${extension}`,
          filters: [
            { name: `${language.toUpperCase()} Files`, extensions: [extension] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })
      } catch (error) {
        console.error('Download failed:', error)
      } finally {
        setIsDownloading(false)
      }
    }
  }

  return (
    <>
      {mermaidCode.length > 0 && <Mermaid code={mermaidCode} key={mermaidCode} />}
      <pre ref={ref}>
        <span
          className={`download-code-button ${isDownloading ? 'downloading' : ''}`}
          onClick={handleDownload}
          title={isDownloading ? '下载中...' : '下载代码'}
        ></span>
        <span
          className={`copy-code-button ${isCopied ? 'copied' : ''}`}
          onClick={handleCopy}
          title={isCopied ? '已复制!' : '复制代码'}
        ></span>
        {props.children}
      </pre>
    </>
  )
}

function escapeDollarNumber(text: string) {
  let escapedText = ''

  for (let i = 0; i < text.length; i += 1) {
    let char = text[i]
    const nextChar = text[i + 1] || ' '

    if (char === '$' && nextChar >= '0' && nextChar <= '9') {
      char = '\\$'
    }

    escapedText += char
  }

  return escapedText
}

function escapeBrackets(text: string) {
  const pattern = /(```[\s\S]*?```|`.*?`)|\\\[([\s\S]*?[^\\])\\\]|\\\((.*?)\\\)/g
  return text.replace(pattern, (match, codeBlock, squareBracket, roundBracket) => {
    if (codeBlock) {
      return codeBlock
    } else if (squareBracket) {
      return `$$${squareBracket}$$`
    } else if (roundBracket) {
      return `$${roundBracket}$`
    }
    return match
  })
}

function _MarkDownContent(props: { content: string }) {
  const escapedContent = useMemo(() => {
    return escapeBrackets(escapeDollarNumber(props.content))
  }, [props.content])

  return (
    <ReactMarkdown
      remarkPlugins={[RemarkMath, RemarkGfm, RemarkBreaks]}
      rehypePlugins={[
        RehypeKatex,
        [
          RehypeHighlight,
          {
            detect: false,
            ignoreMissing: true
          }
        ]
      ]}
      components={{
        pre: PreCode as any,
        p: (pProps) => <p {...pProps} dir="auto" />,
        a: (aProps) => {
          const href = aProps.href || ''
          const isInternal = /^\/#/i.test(href)
          const target = isInternal ? '_self' : (aProps.target ?? '_blank')
          return <a {...aProps} target={target} />
        },
        table: (tableProps) => <TableWrapper>{<table {...tableProps} />}</TableWrapper>
      }}
    >
      {escapedContent}
    </ReactMarkdown>
  )
}

export const MarkdownContent = React.memo(_MarkDownContent)

export function Markdown(
  props: {
    content: string
    loading?: boolean
    fontSize?: number
    parentRef?: RefObject<HTMLDivElement>
    defaultShow?: boolean
  } & React.DOMAttributes<HTMLDivElement>
) {
  const mdRef = useRef<HTMLDivElement>(null)
  return (
    <div
      className="markdown-body"
      style={{
        fontSize: `${props.fontSize ?? 14}px`
      }}
      ref={mdRef}
      onContextMenu={props.onContextMenu}
      onDoubleClickCapture={props.onDoubleClickCapture}
      dir="auto"
    >
      {props.loading ? <img src={LoadingIcon} /> : <MarkdownContent content={props.content} />}
    </div>
  )
}
