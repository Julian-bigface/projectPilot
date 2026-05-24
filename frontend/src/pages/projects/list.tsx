import { useCreate, useDelete, useList } from "@refinedev/core"
import { type FormEvent, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { parseGithubRepoUrl } from "@/lib/github-url"
import { projectSubtitle } from "@/lib/project-display"
import type { Project } from "@/types/project"

export function ProjectListPage() {
  const list = useList<Project>({
    resource: "projects",
    pagination: { currentPage: 1, pageSize: 100, mode: "server" },
  })
  const rows = list.result?.data ?? []
  const isLoading = list.query.isLoading
  const isError = list.query.isError
  const refetch = list.query.refetch

  const createMutation = useCreate<Project>({
    resource: "projects",
  })

  const deleteMutation = useDelete<Project>()

  const [gh, setGh] = useState("")
  const [intro, setIntro] = useState("")
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const parsedPreview = useMemo(() => parseGithubRepoUrl(gh.trim()), [gh])

  const onCreate = (e: FormEvent) => {
    e.preventDefault()
    const parsed = parseGithubRepoUrl(gh.trim())
    if (!parsed) {
      return
    }
    setCreating(true)
    const values: Record<string, unknown> = {
      github_url: parsed.normalizedUrl,
      name: parsed.name,
      full_name: parsed.full_name,
    }
    const t = intro.trim()
    if (t) {
      values.description = t
    }
    createMutation.mutate(
      {
        resource: "projects",
        values,
      },
      {
        onSuccess: () => {
          setGh("")
          setIntro("")
          void refetch()
        },
        onSettled: () => setCreating(false),
      }
    )
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">项目列表</h1>
        <p className="text-muted-foreground mt-1 text-sm">数据来自后端 `/projects`，使用 Refine `useList`。</p>
      </div>

      <form onSubmit={onCreate} className="border-border flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">手动添加（Phase 1）</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">GitHub 仓库 URL</span>
            <input
              required
              value={gh}
              onChange={(e) => setGh(e.target.value)}
              onBlur={() => {
                const p = parseGithubRepoUrl(gh)
                if (p) {
                  setGh(p.normalizedUrl)
                }
              }}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              placeholder="https://github.com/owner/repo"
            />
            {parsedPreview ? (
              <span className="text-muted-foreground text-xs">
                将保存为 <span className="text-foreground font-medium">{parsedPreview.name}</span>（
                <span className="font-mono">{parsedPreview.full_name}</span>）
              </span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">简介（可选）</span>
            <Textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="一句话说明"
              rows={3}
              className="resize-y"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={creating || !parseGithubRepoUrl(gh.trim())}>
            {creating ? "提交中…" : "创建"}
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="p-3 font-medium">ID</th>
              <th className="p-3 font-medium">项目</th>
              <th className="p-3 font-medium">Stars</th>
              <th className="p-3 font-medium">状态</th>
              <th className="p-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground p-6 text-center">
                  加载中…
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={5} className="text-destructive p-6 text-center">
                  加载失败（请确认后端已启动：<code className="text-xs">uvicorn app.main:app --port 8000</code>）
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground p-6 text-center">
                  暂无项目，请在上方表单添加。
                </td>
              </tr>
            ) : (
              rows.map((p: Project) => (
                <tr key={p.id} className="border-border border-t">
                  <td className="p-3 font-mono text-xs">{p.id}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground text-xs leading-snug">{projectSubtitle(p)}</span>
                    </div>
                  </td>
                  <td className="p-3">{p.stars}</td>
                  <td className="p-3">{p.state}</td>
                  <td className="p-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={deletingId === p.id}
                      onClick={() => {
                        setDeletingId(p.id)
                        deleteMutation.mutate(
                          { resource: "projects", id: p.id },
                          {
                            onSuccess: () => void refetch(),
                            onSettled: () => setDeletingId(null),
                          }
                        )
                      }}
                    >
                      删除
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
