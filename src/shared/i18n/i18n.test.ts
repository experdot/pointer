import { describe, expect, it } from 'vitest'
import { en, zh } from './resources'
import { createI18n } from './index'
import { LocalizedError, formatError, msg } from './message'
import { RuntimeError, toFailure } from '../contracts'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

describe('双语资源与错误契约', () => {
  it('界面文案不使用硬编码文本、固定语言常量或模块初始化时的翻译', async () => {
    const root = new URL('../../renderer/src/', import.meta.url)
    const files = (await readdir(root, { recursive: true })).filter(
      (file) => /\.tsx?$/.test(file) && !/\.test\.|\.d\.ts$/.test(file)
    )
    const missing: string[] = []
    const literalLabels = new Set([
      '简体中文',
      'English',
      'Pointer',
      'GitHub',
      'OpenAI',
      'OpenRouter',
      'Markdown',
      'HTML',
      'CSV',
      'Aa',
      'W',
      'import.json'
    ])
    for (const file of files) {
      const path = fileURLToPath(new URL(file.replaceAll('\\', '/'), root))
      const source = ts.createSourceFile(
        path,
        await readFile(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true
      )
      const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node)) {
          const imports = node.importClause?.namedBindings
          if (imports && ts.isNamedImports(imports)) {
            for (const item of imports.elements) {
              if (
                ['DEFAULT_PAGE_NAME', 'DEFAULT_FOLDER_NAME', 'ROLE_DISPLAY_NAMES'].includes(
                  (item.propertyName ?? item.name).text
                )
              )
                missing.push(`${file}: 界面不能直接使用固定语言常量 ${item.getText(source)}`)
            }
          }
        }
        if (ts.isCallExpression(node) && node.expression.getText(source) === 't') {
          let scope: ts.Node | undefined = node.parent
          while (scope && !ts.isFunctionLike(scope)) scope = scope.parent
          if (!scope) missing.push(`${file}: 模块初始化时缓存了翻译 ${node.getText(source)}`)
        }
        if (
          ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node) ||
          ts.isJsxText(node)
        ) {
          const parent = node.parent
          const isUiLabel =
            ts.isJsxText(node) ||
            (ts.isJsxAttribute(parent) &&
              /^(label|title|placeholder|aria-label|alt)$/.test(parent.name.getText(source))) ||
            (ts.isPropertyAssignment(parent) &&
              parent.initializer === node &&
              /^(label|title|name|description|emptyText)$/.test(parent.name.getText(source)))
          let ancestor: ts.Node | undefined = node.parent
          let logging = false
          while (ancestor) {
            if (
              ts.isCallExpression(ancestor) &&
              /^console\./.test(ancestor.expression.getText(source))
            )
              logging = true
            ancestor = ancestor.parent
          }
          if (
            !logging &&
            !literalLabels.has(node.text.trim()) &&
            (/\p{Script=Han}/u.test(node.text) || (isUiLabel && /[a-zA-Z]/.test(node.text)))
          )
            missing.push(
              `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${node.text}`
            )
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    expect(missing).toEqual([])
  })
  it('两种语言包含相同的键与插值参数', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    const parameters = (text: string): string[] =>
      [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(parameters(zh[key]), key).toEqual(parameters(en[key]))
      expect(en[key], key).not.toMatch(/\p{Script=Han}/u)
    }
  })

  it('实例独立，插值中的特殊字符不被二次解释', async () => {
    const english = createI18n('en-US')
    const chinese = createI18n('zh-CN')
    expect(english.t('settings.title')).toBe('Settings')
    expect(chinese.t('settings.title')).toBe('设置')
    const name = '<test> $& {{x}}'
    expect(english.t('common.copyName', { v0: name })).toBe(`${name} copy`)
    await english.instance.changeLanguage('zh-CN')
    expect(english.t('settings.title')).toBe('设置')
  })

  it('英文数量使用单复数，中文保留完整的数量文案', () => {
    const english = createI18n('en-US').t
    const chinese = createI18n('zh-CN').t
    expect(english('import.conversations', { count: 1 })).toBe('Import 1 conversation')
    expect(english('import.conversations', { count: 2 })).toBe('Import 2 conversations')
    expect(english('common.selectedMessages', { count: 0 })).toBe('0 messages selected')
    expect(chinese('import.conversations', { count: 1 })).toBe('导入 1 个对话')
  })

  it('跨 IPC 的错误保留错误码、诊断和可翻译参数', () => {
    const failure = toFailure(
      new RuntimeError('ai.no-api-key', msg('errors.ai.noKey', { v0: 'Personal' }), { id: 'llm' })
    )
    expect(failure).toMatchObject({ ok: false, code: 'ai.no-api-key', details: { id: 'llm' } })
    expect(formatError(failure, createI18n('en-US').t)).toBe(
      'LLM connection “Personal” has no API key'
    )
    expect(formatError(failure, createI18n('zh-CN').t)).toContain('缺少 API Key')
    expect(toFailure(new LocalizedError(msg('errors.search.tooManyResults')))).toHaveProperty(
      'localized'
    )
    expect(formatError(new Error('Provider: rate limited'), createI18n('zh-CN').t)).toBe(
      'Provider: rate limited'
    )
  })
})
