import {
  DndContext,
  DragOverlay,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Search, Tag as TagIcon, Tags, Wand2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { toast } from "sonner"

import { TagAiSuggestDialog } from "@/components/library/tag-ai-suggest-dialog"
import { TagCategorySidebar } from "@/components/library/tag-category-sidebar"
import { TagCategoryTagGrid } from "@/components/library/tag-category-tag-grid"
import { TAG_CATEGORY_DUAL_PANEL_HEIGHT } from "@/components/library/tag-category-styles"
import {
  TagChip,
  TagGridDragPreview,
  UNCATEGORIZED_DROP_ID,
  type TagActions,
  type TagSelectOptions,
} from "@/components/library/tag-management-shared"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLibraryBrowseFilters } from "@/context/library-browse-filters"
import { useLibraryProjectPreview } from "@/context/library-project-preview"
import { useLibrarySelection } from "@/context/library-selection"
import { useProjectLibrary } from "@/context/project-library"
import { usePlApi } from "@/hooks/use-pl-api"
import { snapOverlayTopLeftToPointer } from "@/lib/dnd-modifiers"
import type { TagCategory, TagWithUsage } from "@/types/tag"

/** 仅当指针在分类 droppable 上时才命中（禁止 closestCenter 误放） */
const tagCategoryCollisionDetection: CollisionDetection = (args) => {
  const columnsOnly = args.droppableContainers.filter(({ id }) => String(id).startsWith("tm-drop-"))
  if (columnsOnly.length === 0) {
    return []
  }
  return pointerWithin({ ...args, droppableContainers: columnsOnly })
}

const LS_FAVORITE_TAGS = "projectPilot:favoriteTagIds"
const LS_TAG_COLORS = "projectPilot:tagColorIndexById"

function loadFavoriteSet(): Set<number> {
  try {
    const raw = localStorage.getItem(LS_FAVORITE_TAGS)
    if (!raw) {
      return new Set()
    }
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) {
      return new Set()
    }
    return new Set(arr.filter((x): x is number => typeof x === "number"))
  } catch {
    return new Set()
  }
}

function persistFavoriteSet(s: Set<number>) {
  localStorage.setItem(LS_FAVORITE_TAGS, JSON.stringify([...s]))
}

function loadColorMap(): Record<number, number> {
  try {
    const raw = localStorage.getItem(LS_TAG_COLORS)
    if (!raw) {
      return {}
    }
    const m = JSON.parse(raw) as Record<string, unknown>
    const out: Record<number, number> = {}
    for (const [k, v] of Object.entries(m)) {
      const id = Number(k)
      if (Number.isFinite(id) && typeof v === "number") {
        out[id] = v
      }
    }
    return out
  } catch {
    return {}
  }
}

function persistColorMap(m: Record<number, number>) {
  const serial: Record<string, number> = {}
  for (const [k, v] of Object.entries(m)) {
    serial[String(k)] = v
  }
  localStorage.setItem(LS_TAG_COLORS, JSON.stringify(serial))
}

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

function firstLetterKey(name: string): string {
  const ch = name[0] ?? "#"
  if (/[A-Za-z]/.test(ch)) {
    return ch.toUpperCase()
  }
  return ch
}

function groupByFirstLetter(tags: TagWithUsage[]): { key: string; tags: TagWithUsage[] }[] {
  const map = new Map<string, TagWithUsage[]>()
  const sorted = [...tags].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  )
  for (const t of sorted) {
    const k = firstLetterKey(t.name)
    const arr = map.get(k)
    if (arr) {
      arr.push(t)
    } else {
      map.set(k, [t])
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, "zh-CN", { numeric: true }))
    .map(([key, list]) => ({ key, tags: list }))
}

export function TagManagementPage() {
  const { library } = useProjectLibrary()
  const { setLibraryScope } = useLibrarySelection()
  const {
    setSelectedTagIds: setBrowseSelectedTagIds,
    setSearchQuery: setBrowseSearchQuery,
    setSelectedFolderIds: setBrowseSelectedFolderIds,
    setTagMatchMode: setBrowseTagMatchMode,
  } = useLibraryBrowseFilters()
  const { setPreviewProject } = useLibraryProjectPreview()
  const queryClient = useQueryClient()
  const plApi = usePlApi()
  const [search, setSearch] = useState("")
  const [mainTab, setMainTab] = useState("all")
  const [createOpen, setCreateOpen] = useState(false)
  const [createCatOpen, setCreateCatOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newCategoryId, setNewCategoryId] = useState<number | null>(null)
  const [newCatName, setNewCatName] = useState("")
  const [renameCat, setRenameCat] = useState<TagCategory | null>(null)
  const [renameCatInput, setRenameCatInput] = useState("")
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<TagCategory | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteDialogTag, setDeleteDialogTag] = useState<TagWithUsage | null>(null)
  const [deleteDialogSubmitting, setDeleteDialogSubmitting] = useState(false)
  const clearDeleteDialogTagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteDialogSubmittingRef = useRef(false)
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(loadFavoriteSet)
  const [tagColors, setTagColors] = useState<Record<number, number>>(loadColorMap)
  const [renameTagTarget, setRenameTagTarget] = useState<TagWithUsage | null>(null)
  const [renameTagInput, setRenameTagInput] = useState("")
  const [associationTag, setAssociationTag] = useState<TagWithUsage | null>(null)
  const [activeDragTag, setActiveDragTag] = useState<TagWithUsage | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [checkedCategoryIds, setCheckedCategoryIds] = useState<Set<number>>(() => new Set())
  const lastCheckedCategoryIdRef = useRef<number | null>(null)
  const [batchDeleteCategoriesOpen, setBatchDeleteCategoriesOpen] = useState(false)
  const [categorySearch, setCategorySearch] = useState("")
  const [panelTagSearch, setPanelTagSearch] = useState("")
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(() => new Set())
  const lastSelectedTagIdRef = useRef<number | null>(null)
  const [batchMoving, setBatchMoving] = useState(false)
  const [aiSuggestOpen, setAiSuggestOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const tagsQueryKey = ["tags", plApi.libraryId] as const

  const tagsQuery = useQuery({
    queryKey: tagsQueryKey,
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

  const createMutation = useMutation({
    mutationFn: async (body: { name: string; category_id: number | null }) => {
      const res = await fetch(plApi.path("/tags"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<TagWithUsage>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsQueryKey })
      toast.success("已创建标签")
      setCreateOpen(false)
      setNewName("")
      setNewCategoryId(null)
    },
    onError: (e: Error) => toast.error(e.message || "创建失败"),
  })

  const patchTagMutation = useMutation({
    mutationFn: async (vars: { id: number; category_id?: number | null; name?: string }) => {
      const body: Record<string, unknown> = {}
      if ("category_id" in vars) {
        body.category_id = vars.category_id
      }
      if ("name" in vars) {
        body.name = vars.name
      }
      const res = await fetch(plApi.path(`/tags/${vars.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<TagWithUsage>
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: tagsQueryKey })
      const previous = queryClient.getQueryData<TagWithUsage[]>(tagsQueryKey)
      queryClient.setQueryData<TagWithUsage[]>(tagsQueryKey, (old) => {
        if (!old) {
          return old
        }
        return old.map((t) => {
          if (t.id !== vars.id) {
            return t
          }
          return {
            ...t,
            ...("category_id" in vars ? { category_id: vars.category_id ?? null } : {}),
            ...("name" in vars && vars.name !== undefined ? { name: vars.name } : {}),
          }
        })
      })
      return { previous }
    },
    onError: (e, vars, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(tagsQueryKey, ctx.previous)
      }
      if (!("name" in vars)) {
        toast.error(e.message || "更新失败")
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tagsQueryKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(plApi.path(`/tags/${id}`), { method: "DELETE" })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsQueryKey })
      queryClient.invalidateQueries({ queryKey: ["projects", plApi.libraryId] })
      queryClient.invalidateQueries({ queryKey: ["library", plApi.libraryId] })
      toast.success("已删除标签，并已从关联的项目与文件夹中移除")
      setDeleteDialogOpen(false)
      if (clearDeleteDialogTagTimerRef.current) {
        clearTimeout(clearDeleteDialogTagTimerRef.current)
      }
      clearDeleteDialogTagTimerRef.current = setTimeout(() => {
        setDeleteDialogTag(null)
        setDeleteDialogSubmitting(false)
        deleteDialogSubmittingRef.current = false
        clearDeleteDialogTagTimerRef.current = null
      }, 220)
    },
    onError: (e: Error) => {
      setDeleteDialogSubmitting(false)
      deleteDialogSubmittingRef.current = false
      toast.error(e.message || "删除失败")
    },
  })

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(plApi.path("/tag-categories"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<TagCategory>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tag-categories"] })
      toast.success("已创建分类")
      setCreateCatOpen(false)
      setNewCatName("")
    },
    onError: (e: Error) => toast.error(e.message || "创建失败"),
  })

  const renameCategoryMutation = useMutation({
    mutationFn: async (vars: { id: number; name: string }) => {
      const res = await fetch(plApi.path(`/tag-categories/${vars.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: vars.name }),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<TagCategory>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tag-categories"] })
      queryClient.invalidateQueries({ queryKey: tagsQueryKey })
      toast.success("已重命名")
      setRenameCat(null)
    },
    onError: (e: Error) => toast.error(e.message || "重命名失败"),
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(plApi.path(`/tag-categories/${id}`), { method: "DELETE" })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tag-categories"] })
      queryClient.invalidateQueries({ queryKey: tagsQueryKey })
    },
    onError: (e: Error) => toast.error(e.message || "删除失败"),
  })

  const batchDeleteCategoriesMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch(plApi.path(`/tag-categories/${id}`), { method: "DELETE" })
          if (!res.ok) {
            throw new Error(await parseErrorMessage(res))
          }
        })
      )
      const failed = results.filter((r) => r.status === "rejected")
      if (failed.length > 0) {
        const first = failed[0]
        const msg =
          first.status === "rejected" && first.reason instanceof Error
            ? first.reason.message
            : "部分分类删除失败"
        throw new Error(`${msg}（${failed.length}/${ids.length} 失败）`)
      }
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ["tag-categories"] })
      queryClient.invalidateQueries({ queryKey: tagsQueryKey })
      toast.success(`已删除 ${ids.length} 个分类（标签已移至未分类）`)
      setCheckedCategoryIds(new Set())
      lastCheckedCategoryIdRef.current = null
      setBatchDeleteCategoriesOpen(false)
      if (selectedCategoryId != null && ids.includes(selectedCategoryId)) {
        setSelectedCategoryId(null)
      }
    },
    onError: (e: Error) => toast.error(e.message || "批量删除失败"),
  })

  const filtered = useMemo(() => {
    const rows = tagsQuery.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) {
      return rows
    }
    return rows.filter((t) => t.name.toLowerCase().includes(q))
  }, [tagsQuery.data, search])

  const letterGroups = useMemo(() => groupByFirstLetter(filtered), [filtered])

  const categories = categoriesQuery.data ?? []

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, categorySearch])

  const filteredCategoryIds = useMemo(
    () => filteredCategories.map((c) => c.id),
    [filteredCategories]
  )

  const categoryCounts = useMemo(() => {
    const counts = new Map<number | null, number>()
    counts.set(null, 0)
    for (const c of categories) {
      counts.set(c.id, 0)
    }
    for (const t of tagsQuery.data ?? []) {
      const key = t.category_id
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [tagsQuery.data, categories])

  const uncategorizedCount = categoryCounts.get(null) ?? 0

  const tagsInSelectedCategory = useMemo(() => {
    const rows = tagsQuery.data ?? []
    return rows.filter((t) =>
      selectedCategoryId === null ? t.category_id === null : t.category_id === selectedCategoryId
    )
  }, [tagsQuery.data, selectedCategoryId])

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  )

  const total = tagsQuery.data?.length ?? 0

  useEffect(() => {
    setSelectedTagIds(new Set())
    lastSelectedTagIdRef.current = null
  }, [selectedCategoryId, panelTagSearch])

  const handleSelectCategory = useCallback((categoryId: number | null) => {
    setSelectedCategoryId(categoryId)
    setPanelTagSearch("")
  }, [])

  const handleCategoryRowMouseDown = useCallback(
    (categoryId: number | null, event: MouseEvent<HTMLButtonElement>) => {
      const ctrl = event.ctrlKey || event.metaKey
      const shift = event.shiftKey

      if (categoryId === null) {
        handleSelectCategory(null)
        if (!ctrl && !shift) {
          setCheckedCategoryIds(new Set())
          lastCheckedCategoryIdRef.current = null
        }
        return
      }

      if (shift) {
        const anchor = lastCheckedCategoryIdRef.current ?? selectedCategoryId
        if (anchor != null) {
          const start = filteredCategoryIds.indexOf(anchor)
          const end = filteredCategoryIds.indexOf(categoryId)
          if (start >= 0 && end >= 0) {
            const [from, to] = start < end ? [start, end] : [end, start]
            setCheckedCategoryIds((prev) => {
              const next = ctrl ? new Set(prev) : new Set<number>()
              for (let i = from; i <= to; i++) {
                next.add(filteredCategoryIds[i]!)
              }
              return next
            })
            lastCheckedCategoryIdRef.current = categoryId
            handleSelectCategory(categoryId)
            return
          }
        }
      }

      if (ctrl) {
        setCheckedCategoryIds((prev) => {
          const next = new Set(prev)
          if (next.has(categoryId)) {
            next.delete(categoryId)
          } else {
            next.add(categoryId)
          }
          return next
        })
        lastCheckedCategoryIdRef.current = categoryId
        handleSelectCategory(categoryId)
        return
      }

      setCheckedCategoryIds(new Set([categoryId]))
      lastCheckedCategoryIdRef.current = categoryId
      handleSelectCategory(categoryId)
    },
    [filteredCategoryIds, handleSelectCategory, selectedCategoryId]
  )

  const handleClearCategorySelection = useCallback(() => {
    setCheckedCategoryIds(new Set())
    lastCheckedCategoryIdRef.current = null
  }, [])

  const handleBatchDeleteCategories = useCallback(() => {
    if (checkedCategoryIds.size === 0) return
    setBatchDeleteCategoriesOpen(true)
  }, [checkedCategoryIds.size])

  const confirmBatchDeleteCategories = useCallback(() => {
    const ids = [...checkedCategoryIds]
    if (ids.length === 0) return
    batchDeleteCategoriesMutation.mutate(ids)
  }, [batchDeleteCategoriesMutation, checkedCategoryIds])

  useEffect(() => {
    if (mainTab !== "categories") return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return
      const target = e.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return
      }
      if (checkedCategoryIds.size === 0) return
      e.preventDefault()
      handleBatchDeleteCategories()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [checkedCategoryIds.size, handleBatchDeleteCategories, mainTab])

  const handleTagSelect = useCallback(
    (tagId: number, { additive, range }: TagSelectOptions, visibleTagIds: number[]) => {
      if (range) {
        const anchor = lastSelectedTagIdRef.current ?? tagId
        const start = visibleTagIds.indexOf(anchor)
        const end = visibleTagIds.indexOf(tagId)
        if (start >= 0 && end >= 0) {
          const [from, to] = start < end ? [start, end] : [end, start]
          setSelectedTagIds((prev) => {
            const next = additive ? new Set(prev) : new Set<number>()
            for (let i = from; i <= to; i++) {
              next.add(visibleTagIds[i]!)
            }
            return next
          })
          lastSelectedTagIdRef.current = tagId
          return
        }
      }

      if (additive) {
        setSelectedTagIds((prev) => {
          const next = new Set(prev)
          if (next.has(tagId)) {
            next.delete(tagId)
          } else {
            next.add(tagId)
          }
          return next
        })
        lastSelectedTagIdRef.current = tagId
        return
      }

      setSelectedTagIds((prev) => {
        if (prev.size === 1 && prev.has(tagId)) {
          lastSelectedTagIdRef.current = null
          return new Set()
        }
        lastSelectedTagIdRef.current = tagId
        return new Set([tagId])
      })
    },
    []
  )

  const handleSelectAllTags = useCallback((tagIds: number[]) => {
    setSelectedTagIds(new Set(tagIds))
    lastSelectedTagIdRef.current = tagIds[tagIds.length - 1] ?? null
  }, [])

  const handleClearTagSelection = useCallback(() => {
    setSelectedTagIds(new Set())
    lastSelectedTagIdRef.current = null
  }, [])

  const handleBatchMove = useCallback(
    async (categoryId: number | null) => {
      const ids = [...selectedTagIds]
      if (ids.length === 0) return
      setBatchMoving(true)
      try {
        await Promise.all(ids.map((id) => patchTagMutation.mutateAsync({ id, category_id: categoryId })))
        const label =
          categoryId === null ? "未分类" : categories.find((c) => c.id === categoryId)?.name ?? "分类"
        toast.success(`已将 ${ids.length} 个标签移入「${label}」`)
        setSelectedTagIds(new Set())
        lastSelectedTagIdRef.current = null
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "批量移动失败")
      } finally {
        setBatchMoving(false)
      }
    },
    [selectedTagIds, patchTagMutation, categories]
  )

  const categoryLabel = useCallback(
    (categoryId: number | null) => {
      if (categoryId === null) return "未分类"
      return categories.find((c) => c.id === categoryId)?.name ?? "分类"
    },
    [categories]
  )

  const submitCreate = () => {
    const name = newName.trim()
    if (!name) {
      toast.error("请输入标签名")
      return
    }
    createMutation.mutate({ name, category_id: newCategoryId })
  }

  const submitCreateCategory = () => {
    const name = newCatName.trim()
    if (!name) {
      toast.error("请输入分类名称")
      return
    }
    createCategoryMutation.mutate(name)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    if (!id.startsWith("tm-drag-")) {
      return
    }
    const tagId = Number.parseInt(id.replace("tm-drag-", ""), 10)
    if (Number.isNaN(tagId)) {
      return
    }
    const tag = (tagsQuery.data ?? []).find((t) => t.id === tagId) ?? null
    setActiveDragTag(tag)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    try {
      if (!over) {
        return
      }
      const dragId = String(active.id)
      const overId = String(over.id)
      if (!dragId.startsWith("tm-drag-")) {
        return
      }
      const tagId = Number.parseInt(dragId.replace("tm-drag-", ""), 10)
      if (Number.isNaN(tagId)) {
        return
      }

      let category_id: number | null = null
      if (overId === UNCATEGORIZED_DROP_ID) {
        category_id = null
      } else if (overId.startsWith("tm-drop-")) {
        const raw = overId.replace("tm-drop-", "")
        if (raw === "null") {
          category_id = null
        } else {
          const n = Number.parseInt(raw, 10)
          if (Number.isNaN(n)) {
            return
          }
          category_id = n
        }
      } else {
        return
      }

      const tag = (tagsQuery.data ?? []).find((t) => t.id === tagId)
      if (!tag) {
        return
      }
      const same =
        (tag.category_id === null && category_id === null) || tag.category_id === category_id
      if (same) {
        return
      }
      patchTagMutation.mutate({ id: tagId, category_id })
      toast.success(`已移入「${categoryLabel(category_id)}」`)
    } finally {
      setActiveDragTag(null)
    }
  }

  const closeDeleteTagDialog = useCallback(() => {
    setDeleteDialogOpen(false)
    if (clearDeleteDialogTagTimerRef.current) {
      clearTimeout(clearDeleteDialogTagTimerRef.current)
    }
    clearDeleteDialogTagTimerRef.current = setTimeout(() => {
      setDeleteDialogTag(null)
      setDeleteDialogSubmitting(false)
      deleteDialogSubmittingRef.current = false
      clearDeleteDialogTagTimerRef.current = null
    }, 220)
  }, [])

  const requestDeleteTag = useCallback((t: TagWithUsage) => {
    if (clearDeleteDialogTagTimerRef.current) {
      clearTimeout(clearDeleteDialogTagTimerRef.current)
      clearDeleteDialogTagTimerRef.current = null
    }
    setDeleteDialogSubmitting(false)
    deleteDialogSubmittingRef.current = false
    setDeleteDialogTag(t)
    setDeleteDialogOpen(true)
  }, [])

  const toggleFavorite = useCallback((id: number) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        toast.message("已取消常用标签")
      } else {
        next.add(id)
        toast.success("已设为常用标签")
      }
      persistFavoriteSet(next)
      return next
    })
  }, [])

  const setTagColorPref = useCallback((id: number, idx: number | null) => {
    setTagColors((prev) => {
      const next = { ...prev }
      if (idx === null) {
        delete next[id]
      } else {
        next[id] = idx
      }
      persistColorMap(next)
      return next
    })
  }, [])

  const browseLibraryByTag = useCallback(
    (tag: TagWithUsage) => {
      setPreviewProject(null)
      setBrowseSearchQuery("")
      setBrowseSelectedFolderIds([])
      setBrowseTagMatchMode("any")
      setBrowseSelectedTagIds([tag.id])
      setLibraryScope({ kind: "all" })
      const folderOnly =
        (tag.project_usage_count ?? 0) === 0 && (tag.folder_usage_count ?? 0) > 0
      toast.message(
        folderOnly
          ? `已在「${library?.name ?? "当前库"}」按标签「${tag.name}」筛选（标签在文件夹上）`
          : `已在「${library?.name ?? "当前库"}」按标签「${tag.name}」筛选`
      )
    },
    [
      setLibraryScope,
      setPreviewProject,
      setBrowseSearchQuery,
      setBrowseSelectedFolderIds,
      setBrowseSelectedTagIds,
      setBrowseTagMatchMode,
      library?.name,
    ]
  )

  const tagActions = useMemo<TagActions>(
    () => ({
      categories,
      favoriteIds,
      tagColors,
      toggleFavorite,
      setTagColor: setTagColorPref,
      onRename: (tag) => {
        setRenameTagTarget(tag)
        setRenameTagInput(tag.name)
      },
      onAssociate: setAssociationTag,
      onMoveCategory: (id, category_id) => patchTagMutation.mutate({ id, category_id }),
      onDelete: requestDeleteTag,
      onBrowseByTag: browseLibraryByTag,
    }),
    [
      categories,
      favoriteIds,
      tagColors,
      toggleFavorite,
      setTagColorPref,
      patchTagMutation,
      requestDeleteTag,
      browseLibraryByTag,
    ],
  )

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-lg p-1 sm:w-auto">
          <TabsTrigger value="all" className="gap-1.5 px-4 py-2">
            <Tags className="size-3.5" aria-hidden />
            所有标签
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5 px-4 py-2">
            <TagIcon className="size-3.5" aria-hidden />
            标签分类
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-foreground flex items-center gap-2 text-lg font-semibold tracking-tight">
              <TagIcon className="text-primary size-5 shrink-0" aria-hidden />
              <span>{mainTab === "categories" ? "标签分类" : `所有标签（${total}）`}</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
              当前项目库：
              <span className="text-foreground font-medium">{library?.name ?? "—"}</span>
              。标签仅在本库内有效，与其它项目库互不影响。
              {mainTab === "categories"
                ? " 左侧 Ctrl / Shift 多选分类，右键批量删除；右侧标签支持 Ctrl / Shift 多选与批量移动。"
                : " 数字为项目用量，+N 为文件夹用量；双击可在本库内按该标签筛选项目。"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {mainTab === "categories" && selectedCategoryId === null ? (
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={() => setAiSuggestOpen(true)}
                disabled={uncategorizedCount === 0}
              >
                <Wand2 className="size-4" aria-hidden />
                AI 整理未分类
              </Button>
            ) : null}
            <Button type="button" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              创建标签
            </Button>
          </div>
        </div>

        {mainTab === "all" ? (
          <div className="relative mt-3">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标签"
              className="bg-muted/40 border-0 pl-9 shadow-none"
              aria-label="搜索标签"
            />
          </div>
        ) : null}

        <TabsContent value="all" className="mt-6">
          {tagsQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">加载标签…</p>
          ) : tagsQuery.isError ? (
            <p className="text-destructive text-sm">{(tagsQuery.error as Error).message || "加载失败"}</p>
          ) : letterGroups.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无标签，请点击「创建标签」。</p>
          ) : (
            <div className="flex max-h-[min(70vh,720px)] flex-col gap-8 overflow-y-auto pr-1">
              {letterGroups.map(({ key, tags }) => (
                <section key={key} aria-labelledby={`letter-${key}`}>
                  <h3
                    id={`letter-${key}`}
                    className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase"
                  >
                    {key}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <TagChip key={t.id} tag={t} actions={tagActions} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          {tagsQuery.isLoading || categoriesQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">加载中…</p>
          ) : tagsQuery.isError ? (
            <p className="text-destructive text-sm">{(tagsQuery.error as Error).message || "加载失败"}</p>
          ) : categoriesQuery.isError ? (
            <p className="text-destructive text-sm">
              {(categoriesQuery.error as Error).message || "分类加载失败"}
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={tagCategoryCollisionDetection}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveDragTag(null)}
            >
              <div
                className={`flex min-h-0 items-stretch gap-3 ${TAG_CATEGORY_DUAL_PANEL_HEIGHT}`}
              >
                <TagCategorySidebar
                  categories={categories}
                  categoryCounts={categoryCounts}
                  categorySearch={categorySearch}
                  onCategorySearchChange={setCategorySearch}
                  selectedCategoryId={selectedCategoryId}
                  checkedCategoryIds={checkedCategoryIds}
                  onCategoryRowMouseDown={handleCategoryRowMouseDown}
                  onCreateCategory={() => setCreateCatOpen(true)}
                  onRenameCategory={(c) => {
                    setRenameCat(c)
                    setRenameCatInput(c.name)
                  }}
                  onDeleteCategory={setDeleteCategoryTarget}
                  onClearCategorySelection={handleClearCategorySelection}
                  onBatchDeleteCategories={handleBatchDeleteCategories}
                  batchDeleting={batchDeleteCategoriesMutation.isPending}
                />
                <TagCategoryTagGrid
                  selectedCategoryId={selectedCategoryId}
                  selectedCategory={selectedCategory}
                  tags={tagsInSelectedCategory}
                  panelTagSearch={panelTagSearch}
                  onPanelTagSearchChange={setPanelTagSearch}
                  selectedTagIds={selectedTagIds}
                  onTagSelect={handleTagSelect}
                  onSelectAll={handleSelectAllTags}
                  onClearSelection={handleClearTagSelection}
                  onBatchMove={handleBatchMove}
                  categories={categories}
                  actions={tagActions}
                  batchMoving={batchMoving}
                />
              </div>
              <DragOverlay dropAnimation={null} modifiers={[snapOverlayTopLeftToPointer]}>
                {activeDragTag ? (
                  <TagGridDragPreview tag={activeDragTag} tagColors={tagColors} />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>创建标签</DialogTitle>
            <DialogDescription>名称全局唯一；可选择已有分类，或保留在未分类。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="tag-name">名称</Label>
              <Input
                id="tag-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例如：DevTools"
                maxLength={256}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    submitCreate()
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tag-category">所属分类</Label>
              <select
                id="tag-category"
                value={newCategoryId === null ? "" : String(newCategoryId)}
                onChange={(e) => {
                  const v = e.target.value
                  setNewCategoryId(v === "" ? null : Number(v))
                }}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <option value="">未分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={submitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "创建中…" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createCatOpen} onOpenChange={setCreateCatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建分类</DialogTitle>
            <DialogDescription>分类名称不可重复。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="cat-name">名称</Label>
            <Input
              id="cat-name"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              maxLength={128}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  submitCreateCategory()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateCatOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={submitCreateCategory} disabled={createCategoryMutation.isPending}>
              {createCategoryMutation.isPending ? "创建中…" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameCat !== null} onOpenChange={(o) => !o && setRenameCat(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重命名分类</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="rename-cat">名称</Label>
            <Input
              id="rename-cat"
              value={renameCatInput}
              onChange={(e) => setRenameCatInput(e.target.value)}
              maxLength={128}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameCat(null)}>
              取消
            </Button>
            <Button
              type="button"
              onClick={() => {
                const name = renameCatInput.trim()
                if (!name || !renameCat) {
                  return
                }
                renameCategoryMutation.mutate({ id: renameCat.id, name })
              }}
              disabled={renameCategoryMutation.isPending}
            >
              {renameCategoryMutation.isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameTagTarget !== null} onOpenChange={(o) => !o && setRenameTagTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重命名标签</DialogTitle>
            <DialogDescription>名称全局唯一。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="rename-tag">名称</Label>
            <Input
              id="rename-tag"
              value={renameTagInput}
              onChange={(e) => setRenameTagInput(e.target.value)}
              maxLength={256}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  const name = renameTagInput.trim()
                  if (!name || !renameTagTarget) {
                    return
                  }
                  patchTagMutation.mutate(
                    { id: renameTagTarget.id, name },
                    {
                      onSuccess: () => {
                        toast.success("已重命名")
                        setRenameTagTarget(null)
                      },
                      onError: (err: Error) => toast.error(err.message || "重命名失败"),
                    },
                  )
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameTagTarget(null)}>
              取消
            </Button>
            <Button
              type="button"
              disabled={patchTagMutation.isPending}
              onClick={() => {
                const name = renameTagInput.trim()
                if (!name || !renameTagTarget) {
                  return
                }
                patchTagMutation.mutate(
                  { id: renameTagTarget.id, name },
                  {
                    onSuccess: () => {
                      toast.success("已重命名")
                      setRenameTagTarget(null)
                    },
                    onError: (err: Error) => toast.error(err.message || "重命名失败"),
                  },
                )
              }}
            >
              {patchTagMutation.isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={associationTag !== null} onOpenChange={(o) => !o && setAssociationTag(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>标签关联</DialogTitle>
            <DialogDescription>
              Pilot 以 GitHub 项目为关联对象；以下为当前绑定数量（与标签管理中 usage 一致）。
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-relaxed">
            标签「<span className="font-medium">{associationTag?.name}</span>」当前关联{" "}
            <strong className="tabular-nums">{associationTag?.usage_count ?? 0}</strong>{" "}
            个项目。可在项目详情中编辑领域标签以绑定或解除。
          </p>
          <DialogFooter>
            <Button type="button" onClick={() => setAssociationTag(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && !deleteDialogSubmittingRef.current) closeDeleteTagDialog()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除标签</AlertDialogTitle>
            <AlertDialogDescription className="min-h-10">
              {deleteDialogTag
                ? deleteDialogTag.usage_count > 0
                  ? `确定删除「${deleteDialogTag.name}」？将从 ${deleteDialogTag.usage_count} 处关联（项目或文件夹）中移除此标签，然后删除标签本身。`
                  : `确定删除「${deleteDialogTag.name}」？`
                : "\u00a0"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDialogSubmitting}>取消</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={!deleteDialogTag || deleteDialogSubmitting}
              onClick={() => {
                if (!deleteDialogTag || deleteDialogSubmittingRef.current) return
                deleteDialogSubmittingRef.current = true
                setDeleteDialogSubmitting(true)
                deleteMutation.mutate(deleteDialogTag.id)
              }}
            >
              {deleteDialogSubmitting ? "删除中…" : "删除"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteCategoryTarget !== null} onOpenChange={(o) => !o && setDeleteCategoryTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除分类</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCategoryTarget
                ? `确定删除「${deleteCategoryTarget.name}」？该分类下的标签将移回「未分类」。`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (deleteCategoryTarget) {
                  deleteCategoryMutation.mutate(deleteCategoryTarget.id, {
                    onSuccess: () => {
                      toast.success("已删除分类（标签已移至未分类）")
                      setDeleteCategoryTarget(null)
                      setCheckedCategoryIds((prev) => {
                        const next = new Set(prev)
                        next.delete(deleteCategoryTarget.id)
                        return next
                      })
                      if (selectedCategoryId === deleteCategoryTarget.id) {
                        setSelectedCategoryId(null)
                      }
                    },
                  })
                }
              }}
            >
              {deleteCategoryMutation.isPending ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={batchDeleteCategoriesOpen}
        onOpenChange={(o) => !batchDeleteCategoriesMutation.isPending && setBatchDeleteCategoriesOpen(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量删除分类</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除选中的 {checkedCategoryIds.size} 个分类？这些分类下的标签将全部移回「未分类」。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="text-muted-foreground max-h-40 list-inside list-disc overflow-y-auto text-sm">
            {categories
              .filter((c) => checkedCategoryIds.has(c.id))
              .map((c) => (
                <li key={c.id}>{c.name}</li>
              ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchDeleteCategoriesMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={batchDeleteCategoriesMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                confirmBatchDeleteCategories()
              }}
            >
              {batchDeleteCategoriesMutation.isPending ? "删除中…" : "删除全部"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TagAiSuggestDialog
        open={aiSuggestOpen}
        onOpenChange={setAiSuggestOpen}
        libraryPath={plApi.path}
        categories={categories}
        uncategorizedCount={uncategorizedCount}
      />
    </div>
  )
}
