import { useQuery } from "@tanstack/react-query"
import { ChevronDown } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { usePlApi } from "@/hooks/use-pl-api"
import { getLibraryScopeDisplayLabel } from "@/lib/library-scope-label"
import { projectsAtLibraryRoot, totalProjectsInLibraryTree } from "@/lib/library-tree"
import { cn } from "@/lib/utils"
import type { LibraryTreeResponse } from "@/types/library"
import type { LibraryScope } from "@/types/library-scope"
import type { Project } from "@/types/project"

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json()
    if (data && typeof data === "object" && "detail" in data) {
      const d = (data as { detail: unknown }).detail
      if (typeof d === "string") {
        return d
      }
      return JSON.stringify(d)
    }
  } catch {
    // ignore
  }
  return res.statusText || `HTTP ${res.status}`
}

export type LibraryScopeSummaryScope =
  | { kind: "all" }
  | { kind: "folders_all" }
  | { kind: "uncategorized" }
  | { kind: "no_tags" }
  | { kind: "trash" }

type LibraryScopeSummaryPanelProps = {
  scope: LibraryScopeSummaryScope
}

export function LibraryScopeSummaryPanel({ scope }: LibraryScopeSummaryPanelProps) {
  const [basicOpen, setBasicOpen] = useState(true)
  const plApi = usePlApi()

  const treeQuery = useQuery({
    queryKey: ["library", plApi.libraryId, "tree"],
    queryFn: async (): Promise<LibraryTreeResponse> => {
      const res = await fetch(plApi.path("/library/tree"))
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<LibraryTreeResponse>
    },
    enabled: scope.kind !== "no_tags" && scope.kind !== "trash",
  })

  const trashCountQuery = useQuery({
    queryKey: ["projects", plApi.libraryId, "trash-count"],
    queryFn: async (): Promise<number> => {
      const res = await fetch(`${plApi.path("/projects")}?deleted_only=true&_start=0&_end=1`)
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      const raw = res.headers.get("X-Total-Count")
      return raw ? Number.parseInt(raw, 10) : 0
    },
    enabled: scope.kind === "trash",
  })

  const noTagsProjectsQuery = useQuery({
    queryKey: ["projects", plApi.libraryId, "missing-tags"],
    queryFn: async (): Promise<Project[]> => {
      const res = await fetch(`${plApi.path("/projects")}?missing_tags=true&_start=0&_end=500`)
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<Project[]>
    },
    enabled: scope.kind === "no_tags",
  })

  const tree = treeQuery.data
  const label = getLibraryScopeDisplayLabel(scope as LibraryScope, tree?.folders)

  const fileCount = useMemo(() => {
    switch (scope.kind) {
      case "trash":
        return trashCountQuery.data ?? null
      case "no_tags":
        return (noTagsProjectsQuery.data ?? []).length
      case "uncategorized":
        return tree?.orphan_projects.length ?? null
      case "all":
        return tree ? totalProjectsInLibraryTree(tree.folders, tree.orphan_projects.length) : null
      case "folders_all":
        return tree
          ? projectsAtLibraryRoot(tree.folders, tree.orphan_projects, true).length
          : null
      default:
        return null
    }
  }, [scope.kind, tree, noTagsProjectsQuery.data, trashCountQuery.data])

  const loading =
    scope.kind === "no_tags"
      ? noTagsProjectsQuery.isLoading
      : scope.kind === "trash"
        ? trashCountQuery.isLoading
        : treeQuery.isLoading
  const error =
    scope.kind === "no_tags"
      ? noTagsProjectsQuery.isError
        ? (noTagsProjectsQuery.error as Error)?.message
        : null
      : scope.kind === "trash"
        ? trashCountQuery.isError
          ? (trashCountQuery.error as Error)?.message
          : null
        : treeQuery.isError
          ? (treeQuery.error as Error)?.message
          : null

  const countDisplay =
    fileCount === null ? (loading ? "…" : "—") : fileCount.toLocaleString("zh-CN")

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-3">
      <div className="border-border rounded-md border">
        <Button
          type="button"
          variant="ghost"
          className="text-foreground hover:bg-muted/50 flex h-10 w-full items-center justify-between rounded-none px-3 text-sm font-medium"
          onClick={() => setBasicOpen((o) => !o)}
          aria-expanded={basicOpen}
        >
          <span>基本信息</span>
          <ChevronDown
            className={cn("text-muted-foreground size-4 shrink-0 transition-transform", basicOpen && "rotate-180")}
            aria-hidden
          />
        </Button>
        {basicOpen ? (
          <div className="border-border space-y-0 border-t px-3 py-2 text-sm">
            <div className="text-muted-foreground flex items-center justify-between gap-3 py-1.5">
              <span>名称</span>
              <span className="text-foreground min-w-0 truncate text-right font-medium">{label}</span>
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-3 py-1.5">
              <span>文件数量</span>
              <span className="text-foreground tabular-nums">{error ? "—" : countDisplay}</span>
            </div>
            {scope.kind === "folders_all" ? (
              <p className="text-muted-foreground border-border border-t pt-2 text-xs leading-snug">
                数量与主区「文件夹」视图在默认勾选「显示子文件夹内项目」时一致（含库根未归类 + 树内全部项目）。
              </p>
            ) : null}
            {scope.kind === "trash" ? (
              <p className="text-muted-foreground border-border border-t pt-2 text-xs leading-snug">
                数量与主区「回收站」列表一致；可在此查看已软删除项目条数。
              </p>
            ) : null}
            {error ? <p className="text-destructive pt-1 text-xs">{error}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
