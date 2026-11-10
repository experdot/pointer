import { describe, expect, it } from 'vitest'
import { parseCsv } from './parseCsv'
import { parseMarkdownTable } from './parseMarkdownTable'
import { csvFormatPlugin } from './plugins/formats/csvFormat'
import { htmlFormatPlugin } from './plugins/formats/htmlFormat'
import { txtFormatPlugin } from './plugins/formats/txtFormat'
import type { ExportOptions, ExtractedContent } from './types'

describe('[R23,R24] 表格转换', () => {
  it('三种格式共用 GFM 解析，保留空单元格和转义竖线', async () => {
    const markdown = '| A | B | C | D |\n| --- | --- | --- | --- |\n| | x\\|y | "q",r | |'
    const expected = [
      ['A', 'B', 'C', 'D'],
      ['', 'x|y', '"q",r', '']
    ]
    expect(parseMarkdownTable(markdown)).toEqual(expected)
    const content = { contentType: 'table', rawContent: markdown } as ExtractedContent
    const options = {} as ExportOptions
    const csv = await csvFormatPlugin.convert(content, options)
    expect(parseCsv(csv.content as string)).toEqual({
      headers: expected[0],
      rows: expected.slice(1)
    })
    const html = await htmlFormatPlugin.convert(content, options)
    expect(html.content).toContain('<td></td><td>x|y</td><td>&quot;q&quot;,r</td><td></td>')
    const txt = await txtFormatPlugin.convert(content, options)
    expect(txt.content).toBe('A\tB\tC\tD\n\tx|y\t"q",r\t')
  })

  it.each([
    [
      '\uFEFFa,b,c\r\n"line1\r\nline2","a""b",\r\n',
      { headers: ['a', 'b', 'c'], rows: [['line1\r\nline2', 'a"b', '']] }
    ],
    ['a,b\n"x\ny",z', { headers: ['a', 'b'], rows: [['x\ny', 'z']] }],
    [',,\n,,', { headers: ['', '', ''], rows: [['', '', '']] }],
    ['a,b\n x , ', { headers: ['a', 'b'], rows: [[' x ', ' ']] }],
    ['a,b\n"",""', { headers: ['a', 'b'], rows: [['', '']] }]
  ])('完整 CSV 文本解析：%s', (csv, expected) => {
    expect(parseCsv(csv)).toEqual(expected)
  })
})
