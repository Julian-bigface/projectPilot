import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { PopoverContent } from "@/components/ui/popover"
import { useLibraryBrowseFilters } from "@/context/library-browse-filters"
import { useAutoScrollbarVisible } from "@/hooks/use-auto-scrollbar-visible"
import { usePlApi } from "@/hooks/use-pl-api"
import { collectTagIdsFromProjects } from "@/lib/library-project-filters"
import { domainTagPillClass } from "@/lib/topic-pill-palette"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/project"
import type { TagCategory, TagWithUsage } from "@/types/tag"

/** 资料库浏览：标签筛选 Popover 双栏主体高度（左分类 / 右标签列表一致） */
const LIBRARY_TAG_FILTER_BODY_HEIGHT = "h-[min(60vh,400px)] max-h-[min(60vh,400px)]"

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

type TagGroupKey = "selected" | "all" | "uncategorized" | `cat-${number}`

type SidebarRow = {
  key: TagGroupKey
  label: string
  count: number
}

type LibraryTagFilterPanelProps = {
  scopeProjects: Project[]
}

export function LibraryTagFilterPanel({ scopeProjects }: LibraryTagFilterPanelProps) {
  const {
    selectedTagIds,
    tagMatchMode,
    setTagMatchMode,
    toggleTagId,
    setSelectedTagIds,
  } = useLibraryBrowseFilters()

  const [activeGroup, setActiveGroup] = useState<TagGroupKey>("all")
  const [tagSearch, setTagSearch] = useState("")
  const plApi = usePlApi()
  const { scrollbarVisible: navScrollbarVisible, onScroll: onNavScroll } = useAutoScrollbarVisible()
  const { scrollbarVisible: tagsScrollbarVisible, onScroll: onTagsScroll } = useAutoScrollbarVisible()

  const tagsQuery = useQuery({
    queryKey: ["tags", plApi.libraryId],
    queryFn: async (): Promise<TagWithUsage[]> => {
      const res = await fetch(plApi.path("/tags"))
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<TagWithUsage[]>
    },
  })

  const categoriesQuery = useQuery({
    queryKey: ["tag-categories", plApi.libraryId],
    queryFn: async (): Promise<TagCategory[]> => {
      const res = await fetch(plApi.path("/tag-categories"))
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<TagCategory[]>
    },
  })

  const scopeTagIds = useMemo(
    () => collectTagIdsFromProjects(scopeProjects),
    [scopeProjects]
  )

  const tags = useMemo(() => {
    const all = tagsQuery.data ?? []
    return all.filter((t) => scopeTagIds.has(t.id))
  }, [tagsQuery.data, scopeTagIds])

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])

  const sidebarRows = useMemo((): SidebarRow[] => {
    const uncategorized = tags.filter((t) => t.category_id === null)
    const rows: SidebarRow[] = [
      { key: "selected", label: "已选定", count: selectedTagIds.length },
      { key: "all", label: "所有标签", count: tags.length },
      { key: "uncategorized", label: "未分类标签", count: uncategorized.length },
    ]
    for (const c of categories) {
      rows.push({
        key: `cat-${c.id}`,
        label: c.name,
        count: tags.filter((t) => t.category_id === c.id).length,
      })
    }
    return rows
  }, [tags, categories, selectedTagIds.length])

  const groupTags = useMemo(() => {
    if (activeGroup === "selected") {
      const set = new Set(selectedTagIds)
      return tags.filter((t) => set.has(t.id) && scopeTagIds.has(t.id))
    }
    if (activeGroup === "all") {
      return tags
    }
    if (activeGroup === "uncategorized") {
      return tags.filter((t) => t.category_id === null)
    }
    if (activeGroup.startsWith("cat-")) {
      const catId = Number.parseInt(activeGroup.slice(4), 10)
      return tags.filter((t) => t.category_id === catId)
    }
    return tags
  }, [activeGroup, tags, selectedTagIds, scopeTagIds])

  const visibleTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase()
    if (!q) {
      return groupTags
    }
    return groupTags.filter((t) => t.name.toLowerCase().includes(q))
  }, [groupTags, tagSearch])

  return (
    <PopoverContent
      className="w-[min(100vw-2rem,36rem)] p-0"
      align="start"
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <div>
        <div className={cn("flex min-h-0 items-stretch", LIBRARY_TAG_FILTER_BODY_HEIGHT)}>
          <nav
            className={cn(
              "border-border min-h-0 w-36 shrink-0 overflow-y-auto overscroll-contain border-r py-1 main-auto-scrollbar",
              navScrollbarVisible && "main-auto-scrollbar--visible"
            )}
            aria-label="标签分组"
            onScroll={onNavScroll}
            onWheel={(e) => e.stopPropagation()}
          >
            {sidebarRows.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => {
                  setActiveGroup(row.key)
                  setTagSearch("")
                }}
                className={cn(
                  "hover:bg-muted/60 flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors",
                  activeGroup === row.key && "bg-muted text-foreground font-medium"
                )}
              >
                <span className="min-w-0 truncate">{row.label}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums">{row.count}</span>
              </button>
            ))}
          </nav>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="border-border shrink-0 border-b px-3 py-2">
              <div className="relative">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="搜索标签名"
                  className="h-8 border-0 bg-muted/40 pl-8 text-xs shadow-none"
                  aria-label="搜索标签名"
                />
              </div>
              {selectedTagIds.length > 0 ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground mt-2 text-xs underline-offset-2 hover:underline"
                  onClick={() => setSelectedTagIds([])}
                >
                  清空已选（{selectedTagIds.length}）
                </button>
              ) : null}
            </div>

            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 main-auto-scrollbar",
                tagsScrollbarVisible && "main-auto-scrollbar--visible"
              )}
              onScroll={onTagsScroll}
              onWheel={(e) => e.stopPropagation()}
            >
              {tagsQuery.isLoading ? (
                <p className="text-muted-foreground text-xs">加载标签…</p>
              ) : tagsQuery.isError ? (
                <p className="text-destructive text-xs">加载失败</p>
              ) : visibleTags.length === 0 ? (
                <p className="text-muted-foreground text-xs">暂无标签</p>
              ) : (
                <ul className="space-y-1">
                  {visibleTags.map((tag) => {
                    const checked = selectedTagIds.includes(tag.id)
                    return (
                      <li key={tag.id}>
                        <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5">
                          <input
                            type="checkbox"
                            className="border-input text-primary focus-visible:ring-ring size-3.5 shrink-0 rounded border"
                            checked={checked}
                            onChange={() => toggleTagId(tag.id)}
                          />
                          <span className={cn(domainTagPillClass(tag.id), "max-w-full truncate")}>
                            {tag.name}
                          </span>
                          <span className="text-muted-foreground ml-auto shrink-0 text-[10px] tabular-nums">
                            {tag.usage_count}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <footer className="border-border flex flex-wrap items-center gap-2 border-t px-3 py-2">
          <span className="text-muted-foreground text-xs">匹配逻辑：</span>
          <select
            value={tagMatchMode}
            onChange={(e) => setTagMatchMode(e.target.value as "any" | "all")}
            className="border-input bg-background h-7 rounded-md border px-2 text-xs shadow-none"
            aria-label="标签匹配逻辑"
          >
            <option value="any">任意符合（或）</option>
            <option value="all">全部符合（且）</option>
          </select>
        </footer>
      </div>
    </PopoverContent>
  )
}
