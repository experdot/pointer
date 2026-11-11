import { describe, expect, it } from 'vitest'
import { prepareMarkdown } from './prepareMarkdown'

describe('Markdown 预处理的代码边界', () => {
  it.each([
    '`$1 \\(x\\)`',
    '``$1 `literal` \\[x\\]``',
    '```bash\necho "$1"\n```',
    '~~~~sh\necho "$1"\n~~~~',
    '```sh\necho "$1"',
    '    echo "$1"\n    \\(literal\\)',
    '> ```sh\n> echo "$1"\n> ```',
    '- code:\n\n      echo "$1"',
    '$2+2$',
    '$$1+2$$',
    '[link](https://example.invalid/$1)',
    '![image](https://example.invalid/$1.png)'
  ])('保持代码字面内容：%s', (code) => {
    expect(prepareMarkdown(code)).toBe(code)
  })
  it('只处理代码外金额与公式，已经转义的金额不会二次转义', () => {
    expect(prepareMarkdown('价格 $5 和 \\$10；`$1`；\\(x+1\\)；\\[y\\]')).toBe(
      '价格 \\$5 和 \\$10；`$1`；$x+1$；$$y$$'
    )
  })
})
