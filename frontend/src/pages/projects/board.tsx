import { useList, useUpdate } from "@refinedev/core"
import { useMemo, useState } from "react"

import { projectSubtitle } from "@/lib/project-display"
import type { Project, ProjectState } from "@/types/project"
import { PROJECT_STATES } from "@/types/project"

export function ProjectBoardPage() {
  const list = useList<Project>({
    resource: "projects",
    pagination: { currentPage: 1, pageSize: 500, mode: "server" },
  })
  const isLoading = list.query.isLoading
  const isError = list.query.isError
  const refetch = list.query.refetch

  const updateMutation = useUpdate<Project>({
    resource: "projects",
  })
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const byColumn = useMemo(() => {
    const rows = list.result?.data ?? []
    const map = new Map<ProjectState, Project[]>()
    for (const s of PROJECT_STATES) {
      map.set(s, [])
    }
    for (const p of rows) {
      const col = map.get(p.state as ProjectState)
      if (col) {
        col.push(p)
      }
    }
    return map
  }, [list.result?.data])

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">看板</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          按 `state` 分列展示；切换下拉即调用 `PATCH /projects/:id`。
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">加载中…</p>
      ) : isError ? (
        <p className="text-destructive text-sm">
          加载失败，请确认后端已启动且 Vite 代理 `/api` 可用。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PROJECT_STATES.map((col) => (
            <section
              key={col}
              className="border-border bg-card flex min-h-[320px] flex-col rounded-lg border shadow-sm"
            >
              <header className="border-border bg-muted/40 border-b px-3 py-2">
                <h2 className="text-sm font-semibold">{col}</h2>
                <p className="text-muted-foreground text-xs">
                  {(byColumn.get(col) ?? []).length} 项
                </p>
              </header>
              <ul className="flex flex-1 flex-col gap-2 p-2">
                {(byColumn.get(col) ?? []).map((p) => (
                  <li
                    key={p.id}
                    className="border-border bg-background flex flex-col gap-2 rounded-md border p-3 shadow-xs"
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="text-muted-foreground line-clamp-2 text-xs">{projectSubtitle(p)}</div>
                    <a
                      href={p.github_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary truncate text-xs underline-offset-2 hover:underline"
                    >
                      {p.github_url}
                    </a>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">状态</span>
                      <select
                        className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                        value={p.state}
                        disabled={updatingId === p.id}
                        onChange={(e) => {
                          const next = e.target.value as ProjectState
                          setUpdatingId(p.id)
                          updateMutation.mutate(
                            {
                              resource: "projects",
                              id: p.id,
                              values: { state: next },
                            },
                            {
                              onSuccess: () => void refetch(),
                              onSettled: () => setUpdatingId(null),
                            }
                          )
                        }}
                      >
                        {PROJECT_STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
