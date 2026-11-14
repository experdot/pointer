/** 模拟带搜索、思考和附件元数据的导出，正文均为测试数据。 */
export function deepseekExport(fragments: unknown[]): unknown[] {
  return [
    {
      id: 'deepseek-fragments',
      title: '片段导入回归',
      inserted_at: '2024-01-01T00:00:00.000Z',
      mapping: {
        root: { id: 'root', parent: null, children: ['1'], message: null },
        '1': {
          id: '1',
          parent: 'root',
          children: ['2'],
          message: {
            inserted_at: '2024-01-01T00:00:01.000Z',
            fragments: [{ type: 'REQUEST', content: '测试问题' }]
          }
        },
        '2': {
          id: '2',
          parent: '1',
          children: [],
          message: {
            model: 'deepseek-chat',
            inserted_at: '2024-01-01T00:00:02.000Z',
            fragments
          }
        }
      }
    }
  ]
}
