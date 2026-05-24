/**
 * 项目「领域标签」双栏选择弹窗：与详情页一致，供资料库卡片等复用。
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { invalidateProjectRelated } from "@/lib/invalidate-project-queries"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/project"
import type { TagCategory, TagWithUsage } from "@/types/tag"

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

type TagPickerNav =
  | { kind: "selected" }
  | { kind: "all" }
  | { kind: "uncategorized" }
  | { kind: "category"; id: number }

function TagPickerNavButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
        active
          ? "bg-primary/15 text-foreground ring-ring/50 ring-1"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="text-muted-foreground shrink-0 tabular-nums text-xs">{count}</span>
    </button>
  )
}

export type ProjectDomainTagsDialogProps = {
  projectId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTagIds: number[]
  /** 稳定键：标签 id 集合变化时用于重置草稿 */
  tagIdsKey: string
  /** 弹窗标题 */
  title?: string
  /** 保存成功后额外回调（如详情页写入 React Query 缓存） */
  onSaved?: (project: Project) => void
}

export function ProjectDomainTagsDialog({
  projectId,
  open,
  onOpenChange,
  initialTagIds,
  tagIdsKey,
  title = "编辑领域标签",
  onSaved,
}: ProjectDomainTagsDialogProps) {
  const queryClient = useQueryClient()
  const [draftTagIds, setDraftTagIds] = useState<number[]>([])
  const [tagsError, setTagsError] = useState<string | null>(null)
  const [tagPickerNav, setTagPickerNav] = useState<TagPickerNav>({ kind: "all" })
  const [tagSearch, setTagSearch] = useState("")

  const initialIdsRef = useRef(initialTagIds)
  initialIdsRef.current = initialTagIds

  useEffect(() => {
    if (!open) {
      return
    }
    setDraftTagIds([...initialIdsRef.current])
    setTagsError(null)
  }, [open, tagIdsKey])

  useEffect(() => {
    if (open) {
      setTagPickerNav({ kind: "all" })
      setTagSearch("")
    }
  }, [open])

  const allTagsQuery = useQuery({
    queryKey: ["tags"],
    queryFn: async (): Promise<TagWithUsage[]> => {
      const res = await fetch("/api/tags")
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<TagWithUsage[]>
    },
    enabled: open,
  })

  const categoriesQuery = useQuery({
    queryKey: ["tag-categories"],
    queryFn: async (): Promise<TagCategory[]> => {
      const res = await fetch("/api/tag-categories")
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<TagCategory[]>
    },
    enabled: open,
  })

  const patchTagsMutation = useMutation({
    mutationFn: async (tag_ids: number[]) => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_ids }),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<Project>
    },
    onSuccess: async (data) => {
      onSaved?.(data)
      await invalidateProjectRelated(queryClient, projectId)
      setTagsError(null)
      onOpenChange(false)
    },
    onError: (err) => {
      setTagsError(err instanceof Error ? err.message : "保存失败")
    },
  })

  const allTagRows = allTagsQuery.data ?? []
  const sortedCategories = useMemo(() => {
    const rows = categoriesQuery.data ?? []
    return [...rows].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "zh-CN"),
    )
  }, [categoriesQuery.data])

  const uncategorizedCount = useMemo(
    () => allTagRows.filter((t) => t.category_id === null).length,
    [allTagRows],
  )

  const tagsForRight = useMemo(() => {
    const q = tagSearch.trim().toLowerCase()
    let base: TagWithUsage[]
    switch (tagPickerNav.kind) {
      case "selected":
        base = allTagRows.filter((t) => draftTagIds.includes(t.id))
        break
      case "all":
        base = allTagRows
        break
      case "uncategorized":
        base = allTagRows.filter((t) => t.category_id === null)
        break
      case "category":
        base = allTagRows.filter((t) => t.category_id === tagPickerNav.id)
        break
    }
    const sorted = [...base].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
    if (!q) {
      return sorted
    }
    return sorted.filter((t) => t.name.toLowerCase().includes(q))
  }, [allTagRows, tagPickerNav, draftTagIds, tagSearch])

  const toggleDraftTag = (id: number) => {
    setDraftTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].sort((a, b) => a - b),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(86.4vh,672px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault()
            patchTagsMutation.mutate(draftTagIds)
          }}
        >
          <div className="border-border shrink-0 border-b px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-left">{title}</DialogTitle>
              <DialogDescription className="text-muted-foreground text-left text-sm">
                左侧按分类浏览；勾选右侧标签以关联到本项目，保存后替换原有绑定并刷新使用次数。
              </DialogDescription>
            </DialogHeader>
          </div>

          {allTagsQuery.isLoading || categoriesQuery.isLoading ? (
            <div className="text-muted-foreground flex min-h-0 flex-1 items-center justify-center gap-2 px-6 py-10 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              加载标签与分类…
            </div>
          ) : allTagsQuery.isError ? (
            <p className="text-destructive flex min-h-0 flex-1 items-center px-6 py-8 text-sm">
              {(allTagsQuery.error as Error).message || "加载标签失败"}
            </p>
          ) : categoriesQuery.isError ? (
            <p className="text-destructive flex min-h-0 flex-1 items-center px-6 py-8 text-sm">
              {(categoriesQuery.error as Error).message || "加载分类失败"}
            </p>
          ) : (
            <div className="flex min-h-0 flex-1 divide-x">
              <aside className="bg-muted/25 w-[220px] shrink-0 space-y-1 overflow-y-auto p-3">
                <TagPickerNavButton
                  active={tagPickerNav.kind === "selected"}
                  label="已选定"
                  count={draftTagIds.length}
                  onClick={() => setTagPickerNav({ kind: "selected" })}
                />
                <TagPickerNavButton
                  active={tagPickerNav.kind === "all"}
                  label="所有标签"
                  count={allTagRows.length}
                  onClick={() => setTagPickerNav({ kind: "all" })}
                />
                <TagPickerNavButton
                  active={tagPickerNav.kind === "uncategorized"}
                  label="未分类标签"
                  count={uncategorizedCount}
                  onClick={() => setTagPickerNav({ kind: "uncategorized" })}
                />
                <div className="border-border my-2 border-t pt-2">
                  <p className="text-muted-foreground px-3 pb-1 text-[11px] font-medium tracking-wide uppercase">
                    分类
                  </p>
                  <div className="space-y-1">
                    {sortedCategories.map((c) => (
                      <TagPickerNavButton
                        key={c.id}
                        active={tagPickerNav.kind === "category" && tagPickerNav.id === c.id}
                        label={c.name}
                        count={allTagRows.filter((t) => t.category_id === c.id).length}
                        onClick={() => setTagPickerNav({ kind: "category", id: c.id })}
                      />
                    ))}
                  </div>
                </div>
              </aside>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="border-border shrink-0 border-b p-3">
                  <div className="relative">
                    <Search
                      className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                      aria-hidden
                    />
                    <Input
                      type="search"
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      placeholder="搜索标签名"
                      className="bg-muted/40 border-0 pl-9 shadow-none"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {allTagRows.length === 0 ? (
                    <p className="text-muted-foreground p-6 text-sm">
                      暂无可用标签。请先在资料库 → 标签管理中创建。
                    </p>
                  ) : tagsForRight.length === 0 ? (
                    <p className="text-muted-foreground p-6 text-sm">当前分类下没有匹配的标签。</p>
                  ) : (
                    <ul className="divide-border divide-y">
                      {tagsForRight.map((tag) => (
                        <li key={tag.id}>
                          <label className="hover:bg-muted/45 flex cursor-pointer items-center gap-3 px-4 py-2.5">
                            <input
                              type="checkbox"
                              className="border-input text-primary size-4 shrink-0 rounded"
                              checked={draftTagIds.includes(tag.id)}
                              onChange={() => toggleDraftTag(tag.id)}
                            />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{tag.name}</span>
                            <span className="text-muted-foreground shrink-0 tabular-nums text-xs">
                              {tag.usage_count}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="border-border shrink-0 border-t px-6 py-4">
            {tagsError ? <p className="text-destructive mb-3 text-xs">{tagsError}</p> : null}
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={patchTagsMutation.isPending || allTagsQuery.isLoading}>
                {patchTagsMutation.isPending ? "保存中…" : "保存"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
