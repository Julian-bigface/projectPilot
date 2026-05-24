import {
  DndContext,
  DragOverlay,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  closestCenter,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MoreHorizontal, Plus, Search, Tag as TagIcon, Tags } from "lucide-react"
import { useCallback, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"

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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { TagCategory, TagWithUsage } from "@/types/tag"
import { cn } from "@/lib/utils"

const UNCATEGORIZED_DROP_ID = "tm-drop-null"

/** 只与分类栏 droppable（tm-drop-*）碰撞；分层检测避免缝隙松手时 closestCorners 为空导致 over 丢失 */
const tagCategoryCollisionDetection: CollisionDetection = (args) => {
  const columnsOnly = args.droppableContainers.filter(({ id }) => String(id).startsWith("tm-drop-"))
  if (columnsOnly.length === 0) {
    return []
  }
  const scoped = { ...args, droppableContainers: columnsOnly }
  const byPointer = pointerWithin(scoped)
  if (byPointer.length > 0) {
    return byPointer
  }
  const byCorners = closestCorners(scoped)
  if (byCorners.length > 0) {
    return byCorners
  }
  return closestCenter(scoped)
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

/** 左侧色条背景 class（仅本机偏好）；存储值为 0..length-1；用独立条带避免选色后芯片宽度变化 */
const TAG_ACCENT_BG = [
  "bg-blue-500",
  "bg-cyan-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-amber-400",
  "bg-rose-500",
  "bg-violet-500",
] as const

/** 右键菜单首钮「默认」外观（清除本机色偏好） */
const TAG_DEFAULT_SWATCH =
  "border-muted-foreground/40 bg-muted/80 dark:border-muted-foreground/50 dark:bg-muted/60"

/** 与 TAG_ACCENT_BG 顺序一一对应（共 7 色） */
const TAG_COLOR_SWATCHES = [
  "border-blue-400 bg-blue-500/25",
  "border-cyan-400 bg-cyan-500/25",
  "border-teal-400 bg-teal-500/25",
  "border-orange-400 bg-orange-500/25",
  "border-amber-400 bg-amber-400/30",
  "border-rose-400 bg-rose-500/25",
  "border-violet-400 bg-violet-500/25",
] as const

/** 选中态圆环（随色相变化，避免默认 ring 发黑） */
const TAG_SWATCH_SELECTED_RING = [
  "ring-2 ring-blue-500 ring-offset-2 ring-offset-background",
  "ring-2 ring-cyan-500 ring-offset-2 ring-offset-background",
  "ring-2 ring-teal-500 ring-offset-2 ring-offset-background",
  "ring-2 ring-orange-500 ring-offset-2 ring-offset-background",
  "ring-2 ring-amber-400 ring-offset-2 ring-offset-background",
  "ring-2 ring-rose-500 ring-offset-2 ring-offset-background",
  "ring-2 ring-violet-500 ring-offset-2 ring-offset-background",
] as const

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

type TagActions = {
  categories: TagCategory[]
  favoriteIds: Set<number>
  tagColors: Record<number, number>
  toggleFavorite: (id: number) => void
  setTagColor: (id: number, idx: number | null) => void
  onRename: (tag: TagWithUsage) => void
  onAssociate: (tag: TagWithUsage) => void
  onMoveCategory: (id: number, category_id: number | null) => void
  onDelete: (tag: TagWithUsage) => void
}

function chipAccentBgClass(tagColors: Record<number, number>, tagId: number): string {
  const idx = tagColors[tagId]
  if (idx === undefined || idx < 0 || idx >= TAG_ACCENT_BG.length) {
    return ""
  }
  return TAG_ACCENT_BG[idx]
}

/** 供 DragOverlay 使用：无交互、挂到 body，避免被分类栏 overflow 裁切 */
function TagChipDragPreview({ tag, tagColors }: { tag: TagWithUsage; tagColors: Record<number, number> }) {
  const accentBg = chipAccentBgClass(tagColors, tag.id)
  return (
    <span className="bg-background text-foreground border-border pointer-events-none inline-flex min-w-[68px] max-w-[min(100%,10.8rem)] cursor-grabbing items-stretch overflow-hidden rounded-md border text-sm shadow-md">
      <span className={cn("w-[3px] shrink-0 self-stretch", accentBg || "bg-transparent")} aria-hidden />
      <span className="flex min-w-0 flex-1 items-center justify-between gap-1.5 px-1.5 py-1">
        <span className="text-foreground min-w-0 flex-1 truncate text-left text-sm leading-snug">{tag.name}</span>
        <span className="text-muted-foreground shrink-0 tabular-nums text-xs">{tag.usage_count}</span>
      </span>
    </span>
  )
}

function TagChipMenuContent({ tag, actions }: { tag: TagWithUsage; actions: TagActions }) {
  const isFav = actions.favoriteIds.has(tag.id)
  const storedColor = actions.tagColors[tag.id]
  const isDefaultColor = storedColor === undefined || storedColor === null
  return (
    <ContextMenuContent className="w-[13.5rem]">
      <ContextMenuItem onSelect={() => actions.onAssociate(tag)}>查看标签关联素材</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => actions.toggleFavorite(tag.id)}>
        {isFav ? "取消常用标签" : "设置为常用标签"}
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger className="w-full">添加至分类</ContextMenuSubTrigger>
        <ContextMenuSubContent className="max-h-52 overflow-y-auto">
          <ContextMenuItem onSelect={() => actions.onMoveCategory(tag.id, null)}>未分类</ContextMenuItem>
          {actions.categories.map((c) => (
            <ContextMenuItem key={c.id} onSelect={() => actions.onMoveCategory(tag.id, c.id)}>
              {c.name}
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => actions.onRename(tag)}>重命名标签</ContextMenuItem>
      <ContextMenuSeparator />
      <div
        className="flex w-full items-center gap-2 px-2 py-1.5"
        onPointerDown={(e) => e.preventDefault()}
      >
        <div className="flex min-w-0 flex-1 justify-center">
          <button
            type="button"
            title="默认"
            className={cn(
              "size-4 shrink-0 rounded-full border-2",
              TAG_DEFAULT_SWATCH,
              isDefaultColor &&
                "ring-2 ring-slate-400 ring-offset-2 ring-offset-background dark:ring-slate-500",
            )}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              actions.setTagColor(tag.id, null)
            }}
          />
        </div>
        {TAG_COLOR_SWATCHES.map((cls, storageIdx) => (
          <div key={storageIdx} className="flex min-w-0 flex-1 justify-center">
            <button
              type="button"
              title={`颜色 ${storageIdx + 1}`}
              className={cn(
                "size-4 shrink-0 rounded-full border-2",
                cls,
                !isDefaultColor &&
                  storedColor === storageIdx &&
                  TAG_SWATCH_SELECTED_RING[storageIdx],
              )}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                actions.setTagColor(tag.id, storageIdx)
              }}
            />
          </div>
        ))}
      </div>
      <ContextMenuSeparator />
      <ContextMenuItem
        className="text-destructive focus:text-destructive"
        onSelect={() => actions.onDelete(tag)}
      >
        删除标签
      </ContextMenuItem>
    </ContextMenuContent>
  )
}

function TagChip({ tag, actions }: { tag: TagWithUsage; actions: TagActions }) {
  const accentBg = chipAccentBgClass(actions.tagColors, tag.id)
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <span className="bg-background text-foreground border-border inline-flex min-w-[68px] max-w-[min(100%,10.8rem)] cursor-default items-stretch overflow-hidden rounded-md border text-sm shadow-sm">
          <span
            className={cn("w-[3px] shrink-0 self-stretch", accentBg || "bg-transparent")}
            aria-hidden
          />
          <span className="flex min-w-0 flex-1 items-center justify-between gap-1.5 px-1.5 py-1">
            <span className="text-foreground min-w-0 flex-1 truncate text-left text-sm leading-snug">
              {tag.name}
            </span>
            <span className="text-muted-foreground shrink-0 tabular-nums text-xs">{tag.usage_count}</span>
          </span>
        </span>
      </ContextMenuTrigger>
      <TagChipMenuContent tag={tag} actions={actions} />
    </ContextMenu>
  )
}

function DraggableTagChip({ tag, actions }: { tag: TagWithUsage; actions: TagActions }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tm-drag-${tag.id}`,
    data: { tag },
  })
  const style = {
    // 使用 DragOverlay 时源节点不再位移，避免仍在 overflow 容器内被裁切
    transform: isDragging ? undefined : CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
  }
  const accentBg = chipAccentBgClass(actions.tagColors, tag.id)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <span
          ref={setNodeRef}
          style={style}
          {...listeners}
          {...attributes}
          className="bg-background text-foreground border-border inline-flex min-w-[68px] max-w-[min(100%,10.8rem)] cursor-grab items-stretch overflow-hidden rounded-md border text-sm shadow-sm touch-none active:cursor-grabbing"
        >
          <span
            className={cn("w-[3px] shrink-0 self-stretch", accentBg || "bg-transparent")}
            aria-hidden
          />
          <span className="flex min-w-0 flex-1 items-center justify-between gap-1.5 px-1.5 py-1">
            <span className="text-foreground min-w-0 flex-1 truncate text-left text-sm leading-snug">
              {tag.name}
            </span>
            <span className="text-muted-foreground shrink-0 tabular-nums text-xs">{tag.usage_count}</span>
          </span>
        </span>
      </ContextMenuTrigger>
      <TagChipMenuContent tag={tag} actions={actions} />
    </ContextMenu>
  )
}

function CategoryDropColumn({
  dropId,
  title,
  tags,
  headerExtra,
  renderTag,
}: {
  dropId: string
  title: string
  tags: TagWithUsage[]
  headerExtra?: ReactNode
  renderTag: (t: TagWithUsage) => ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-border bg-muted/20 flex min-h-[160px] min-w-[220px] max-w-[280px] shrink-0 flex-col rounded-lg border p-3 transition-colors",
        isOver && "bg-primary/10 ring-primary ring-2 ring-offset-2 ring-offset-background",
      )}
    >
      <div className="mb-2 flex min-h-[28px] items-start justify-between gap-2">
        <h3 className="text-foreground text-sm font-semibold leading-snug">
          {title}
          <span className="text-muted-foreground ml-1.5 font-normal tabular-nums">({tags.length})</span>
        </h3>
        {headerExtra}
      </div>
      <div className="flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto">
        {tags.length === 0 ? (
          <p className="text-muted-foreground text-xs">拖入标签至此</p>
        ) : (
          tags.map((t) => <span key={t.id}>{renderTag(t)}</span>)
        )}
      </div>
    </div>
  )
}

export function TagManagementPage() {
  const queryClient = useQueryClient()
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
  const [deleteTarget, setDeleteTarget] = useState<TagWithUsage | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(loadFavoriteSet)
  const [tagColors, setTagColors] = useState<Record<number, number>>(loadColorMap)
  const [renameTagTarget, setRenameTagTarget] = useState<TagWithUsage | null>(null)
  const [renameTagInput, setRenameTagInput] = useState("")
  const [associationTag, setAssociationTag] = useState<TagWithUsage | null>(null)
  const [activeDragTag, setActiveDragTag] = useState<TagWithUsage | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const tagsQuery = useQuery({
    queryKey: ["tags"],
    queryFn: async (): Promise<TagWithUsage[]> => {
      const res = await fetch("/api/tags")
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<TagWithUsage[]>
    },
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
  })

  const createMutation = useMutation({
    mutationFn: async (body: { name: string; category_id: number | null }) => {
      const res = await fetch("/api/tags", {
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
      queryClient.invalidateQueries({ queryKey: ["tags"] })
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
      const res = await fetch(`/api/tags/${vars.id}`, {
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
      await queryClient.cancelQueries({ queryKey: ["tags"] })
      const previous = queryClient.getQueryData<TagWithUsage[]>(["tags"])
      queryClient.setQueryData<TagWithUsage[]>(["tags"], (old) => {
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
        queryClient.setQueryData(["tags"], ctx.previous)
      }
      if (!("name" in vars)) {
        toast.error(e.message || "更新失败")
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/tags/${id}`, { method: "DELETE" })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] })
      toast.success("已删除标签")
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error(e.message || "删除失败"),
  })

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/tag-categories", {
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
      const res = await fetch(`/api/tag-categories/${vars.id}`, {
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
      queryClient.invalidateQueries({ queryKey: ["tags"] })
      toast.success("已重命名")
      setRenameCat(null)
    },
    onError: (e: Error) => toast.error(e.message || "重命名失败"),
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/tag-categories/${id}`, { method: "DELETE" })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tag-categories"] })
      queryClient.invalidateQueries({ queryKey: ["tags"] })
      toast.success("已删除分类（标签已移至未分类）")
      setDeleteCategoryTarget(null)
    },
    onError: (e: Error) => toast.error(e.message || "删除失败"),
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
  const uncategorizedTags = useMemo(
    () => filtered.filter((t) => t.category_id === null),
    [filtered],
  )

  const total = tagsQuery.data?.length ?? 0

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
    } finally {
      setActiveDragTag(null)
    }
  }

  const requestDeleteTag = useCallback((t: TagWithUsage) => setDeleteTarget(t), [])

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
    }),
    [categories, favoriteIds, tagColors, toggleFavorite, setTagColorPref, patchTagMutation, requestDeleteTag],
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
              {mainTab === "categories"
                ? "自定义分类；未指定分类的标签在「未分类」。将标签拖入某一栏即可完成归类。"
                : "为项目打上标签，便于分类与检索；可在「标签分类」中整理归类。"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {mainTab === "categories" ? (
              <Button type="button" variant="secondary" className="gap-1.5" onClick={() => setCreateCatOpen(true)}>
                <Plus className="size-4" aria-hidden />
                新建分类
              </Button>
            ) : null}
            <Button type="button" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              创建标签
            </Button>
          </div>
        </div>

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
              <div className="flex max-h-[min(72vh,760px)] gap-3 overflow-x-auto overflow-y-hidden px-3 py-1 pb-2">
                <CategoryDropColumn
                  dropId={UNCATEGORIZED_DROP_ID}
                  title="未分类"
                  tags={uncategorizedTags}
                  renderTag={(t) => <DraggableTagChip tag={t} actions={tagActions} />}
                />
                {categories.map((c) => (
                  <CategoryDropColumn
                    key={c.id}
                    dropId={`tm-drop-${c.id}`}
                    title={c.name}
                    tags={filtered.filter((t) => t.category_id === c.id)}
                    renderTag={(t) => <DraggableTagChip tag={t} actions={tagActions} />}
                    headerExtra={
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label={`分类 ${c.name} 操作`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setRenameCat(c)
                              setRenameCatInput(c.name)
                            }}
                          >
                            重命名
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setDeleteCategoryTarget(c)}
                          >
                            删除分类
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                  />
                ))}
              </div>
              <DragOverlay dropAnimation={null}>
                {activeDragTag ? <TagChipDragPreview tag={activeDragTag} tagColors={tagColors} /> : null}
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

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除标签</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `确定删除「${deleteTarget.name}」？若仍有项目使用该标签，将无法删除。`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id)
                }
              }}
            >
              {deleteMutation.isPending ? "删除中…" : "删除"}
            </AlertDialogAction>
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
                  deleteCategoryMutation.mutate(deleteCategoryTarget.id)
                }
              }}
            >
              {deleteCategoryMutation.isPending ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
