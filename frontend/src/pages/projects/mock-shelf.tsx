/** Phase 1 占位页：纯前端常量，不调 API，用于对照实现计划中「模拟数据」表述。 */

const MOCK_ROWS = [
  {
    id: "demo-1",
    title: "示例项目 Alpha",
    tag: "DevTools",
    note: "占位文案：可与后续 AI / GitHub 导入对照",
  },
  {
    id: "demo-2",
    title: "示例项目 Beta",
    tag: "自动化",
    note: "仅占位，不参与后端持久化",
  },
  {
    id: "demo-3",
    title: "示例项目 Gamma",
    tag: "数据分析",
    note: "删除本页不影响 `/projects` 列表数据",
  },
]

export function MockShelfPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">模拟列表（占位）</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Phase 1 占位：以下为<strong className="text-foreground font-medium">前端写死的示例数据</strong>
          ，不请求后端。真实数据请使用左侧「列表（API）」或「看板（API）」。
        </p>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 border-border border-b">
            <tr>
              <th className="p-3 font-medium">标题</th>
              <th className="p-3 font-medium">标签（示意）</th>
              <th className="p-3 font-medium">说明</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ROWS.map((row) => (
              <tr key={row.id} className="border-border border-t">
                <td className="p-3">{row.title}</td>
                <td className="p-3">
                  <span className="bg-secondary text-secondary-foreground rounded px-2 py-0.5 text-xs">
                    {row.tag}
                  </span>
                </td>
                <td className="text-muted-foreground p-3">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
