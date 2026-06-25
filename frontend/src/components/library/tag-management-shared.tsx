import { CSS } from "@dnd-kit/utilities"
import { useDraggable } from "@dnd-kit/core"
import { useRef } from "react"

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
import { TAG_CHIP_SURFACE_CLASS, TAG_CHIP_SELECTED_CLASS } from "@/components/library/tag-category-styles"
import type { TagCategory, TagWithUsage } from "@/types/tag"
import { cn } from "@/lib/utils"

export const UNCATEGORIZED_DROP_ID = "tm-drop-null"

export const TAG_ACCENT_BG = [
  "bg-blue-500",
  "bg-cyan-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-amber-400",
  "bg-rose-500",
  "bg-violet-500",
] as const

export const TAG_DEFAULT_SWATCH =
  "border-muted-foreground/40 bg-muted/80 dark:border-muted-foreground/50 dark:bg-muted/60"

export const TAG_COLOR_SWATCHES = [
  "border-blue-400 bg-blue-500/25",
  "border-cyan-400 bg-cyan-500/25",
  "border-teal-400 bg-teal-500/25",
  "border-orange-400 bg-orange-500/25",
  "border-amber-400 bg-amber-400/30",
  "border-rose-400 bg-rose-500/25",
  "border-violet-400 bg-violet-500/25",
] as const

export const TAG_SWATCH_SELECTED_RING = [
  "ring-2 ring-blue-500 ring-offset-2 ring-offset-background",
  "ring-2 ring-cyan-500 ring-offset-2 ring-offset-background",
  "ring-2 ring-teal-500 ring-offset-2 ring-offset-background",
  "ring-2 ring-orange-500 ring-offset-2 ring-offset-background",
  "ring-2 ring-amber-400 ring-offset-2 ring-offset-background",
  "ring-2 ring-rose-500 ring-offset-2 ring-offset-background",
  "ring-2 ring-violet-500 ring-offset-2 ring-offset-background",
] as const

export type TagActions = {
  categories: TagCategory[]
  favoriteIds: Set<number>
  tagColors: Record<number, number>
  toggleFavorite: (id: number) => void
  setTagColor: (id: number, idx: number | null) => void
  onRename: (tag: TagWithUsage) => void
  onAssociate: (tag: TagWithUsage) => void
  onMoveCategory: (id: number, category_id: number | null) => void
  onDelete: (tag: TagWithUsage) => void
  /** 双击标签：跳转资料库根目录并按该标签筛选 */
  onBrowseByTag?: (tag: TagWithUsage) => void
}

export function chipAccentBgClass(tagColors: Record<number, number>, tagId: number): string {
  const idx = tagColors[tagId]
  if (idx === undefined || idx < 0 || idx >= TAG_ACCENT_BG.length) {
    return ""
  }
  return TAG_ACCENT_BG[idx]
}

export function tagProjectUsageCount(tag: TagWithUsage): number {
  return tag.project_usage_count ?? tag.usage_count
}

export function tagFolderUsageCount(tag: TagWithUsage): number {
  return tag.folder_usage_count ?? 0
}

export function tagUsageCountTitle(tag: TagWithUsage): string | undefined {
  const projects = tagProjectUsageCount(tag)
  const folders = tagFolderUsageCount(tag)
  if (folders > 0) {
    return `项目 ${projects}，文件夹 ${folders}（筛选含文件夹内项目）`
  }
  return projects !== tag.usage_count ? `项目 ${projects}` : undefined
}

function TagChipInner({
  tag,
  accentBg,
  muted = false,
}: {
  tag: TagWithUsage
  accentBg: string
  muted?: boolean
}) {
  const projectCount = tagProjectUsageCount(tag)
  return (
    <>
      <span
        className={cn(
          "w-[3px] shrink-0 self-stretch",
          muted ? "bg-muted-foreground/40" : accentBg || "bg-transparent"
        )}
        aria-hidden
      />
      <span className="flex min-w-0 flex-1 items-center justify-between gap-1.5 px-1.5 py-1">
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left text-sm leading-snug",
            muted ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {tag.name}
        </span>
        <span className="text-muted-foreground shrink-0 tabular-nums text-xs" title={tagUsageCountTitle(tag)}>
          {projectCount}
          {tagFolderUsageCount(tag) > 0 ? (
            <span className="text-muted-foreground/70">+{tagFolderUsageCount(tag)}</span>
          ) : null}
        </span>
      </span>
    </>
  )
}

export function TagChipDragPreview({
  tag,
  tagColors,
}: {
  tag: TagWithUsage
  tagColors: Record<number, number>
}) {
  const accentBg = chipAccentBgClass(tagColors, tag.id)
  return (
    <span className="bg-background text-foreground border-border pointer-events-none inline-flex min-w-[68px] max-w-[min(100%,10.8rem)] cursor-grabbing items-stretch overflow-hidden rounded-md border text-sm shadow-md">
      <TagChipInner tag={tag} accentBg={accentBg} />
    </span>
  )
}

export function TagChipMenuContent({ tag, actions }: { tag: TagWithUsage; actions: TagActions }) {
  const isFav = actions.favoriteIds.has(tag.id)
  const storedColor = actions.tagColors[tag.id]
  const isDefaultColor = storedColor === undefined || storedColor === null
  return (
    <ContextMenuContent className="w-[13.5rem]">
      {actions.onBrowseByTag ? (
        <>
          <ContextMenuItem onSelect={() => actions.onBrowseByTag?.(tag)}>
            在资料库按此标签筛选
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      ) : null}
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
      <div className="flex w-full items-center gap-2 px-2 py-1.5" onPointerDown={(e) => e.preventDefault()}>
        <div className="flex min-w-0 flex-1 justify-center">
          <button
            type="button"
            title="默认"
            className={cn(
              "size-4 shrink-0 rounded-full border-2",
              TAG_DEFAULT_SWATCH,
              isDefaultColor && "ring-2 ring-slate-400 ring-offset-2 ring-offset-background dark:ring-slate-500"
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
                !isDefaultColor && storedColor === storageIdx && TAG_SWATCH_SELECTED_RING[storageIdx]
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

export function TagChip({ tag, actions }: { tag: TagWithUsage; actions: TagActions }) {
  const accentBg = chipAccentBgClass(actions.tagColors, tag.id)
  const canBrowse = Boolean(actions.onBrowseByTag)
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <span
          title={
            canBrowse
              ? `${tagUsageCountTitle(tag) ? `${tagUsageCountTitle(tag)}；` : ""}双击在资料库按此标签筛选`
              : tagUsageCountTitle(tag)
          }
          className={cn(
            "bg-background text-foreground border-border inline-flex min-w-[68px] max-w-[min(100%,10.8rem)] items-stretch overflow-hidden rounded-md border text-sm shadow-sm",
            canBrowse ? "cursor-pointer" : "cursor-default"
          )}
          onDoubleClick={
            canBrowse
              ? (e) => {
                  e.preventDefault()
                  actions.onBrowseByTag?.(tag)
                }
              : undefined
          }
        >
          <TagChipInner tag={tag} accentBg={accentBg} />
        </span>
      </ContextMenuTrigger>
      <TagChipMenuContent tag={tag} actions={actions} />
    </ContextMenu>
  )
}

export function TagGridDragPreview({
  tag,
  tagColors,
}: {
  tag: TagWithUsage
  tagColors: Record<number, number>
}) {
  const accentBg = chipAccentBgClass(tagColors, tag.id)
  return (
    <span className={cn(TAG_CHIP_SURFACE_CLASS, "pointer-events-none max-w-[min(100%,10.8rem)] cursor-grabbing shadow-md")}>
      <TagChipInner tag={tag} accentBg={accentBg} />
    </span>
  )
}

export type TagSelectOptions = {
  additive: boolean
  range: boolean
}

export type TagGridRowSelectHandler = (
  options: TagSelectOptions,
  visibleTagIds: number[]
) => void

export function TagGridRow({
  tag,
  actions,
  selected,
  visibleTagIds,
  onSelect,
}: {
  tag: TagWithUsage
  actions: TagActions
  selected: boolean
  visibleTagIds: number[]
  onSelect: TagGridRowSelectHandler
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tm-drag-${tag.id}`,
    data: { tag },
  })
  const style = {
    transform: isDragging ? undefined : CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  }
  const accentBg = chipAccentBgClass(actions.tagColors, tag.id)
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)

  const handlePointerDown = (event: React.PointerEvent<HTMLSpanElement>) => {
    pointerDownRef.current = { x: event.clientX, y: event.clientY }
    listeners?.onPointerDown?.(event)
  }

  const handleClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    const down = pointerDownRef.current
    pointerDownRef.current = null
    if (down) {
      const dx = event.clientX - down.x
      const dy = event.clientY - down.y
      if (Math.hypot(dx, dy) > 4) return
    }
    if (isDragging) return
    onSelect(
      { additive: event.ctrlKey || event.metaKey, range: event.shiftKey },
      visibleTagIds
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <span
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          onPointerDown={handlePointerDown}
          role="button"
          tabIndex={0}
          aria-pressed={selected}
          aria-label={`${tag.name}，用量 ${tag.usage_count}${selected ? "，已选中" : ""}`}
          onClick={handleClick}
          onDoubleClick={
            actions.onBrowseByTag
              ? (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  actions.onBrowseByTag?.(tag)
                }
              : undefined
          }
          title={actions.onBrowseByTag ? "双击在资料库按此标签筛选" : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onSelect({ additive: e.ctrlKey || e.metaKey, range: e.shiftKey }, visibleTagIds)
            }
          }}
          className={cn(
            TAG_CHIP_SURFACE_CLASS,
            "cursor-grab touch-none active:cursor-grabbing",
            selected && TAG_CHIP_SELECTED_CLASS
          )}
        >
          <TagChipInner tag={tag} accentBg={accentBg} muted={selected} />
        </span>
      </ContextMenuTrigger>
      <TagChipMenuContent tag={tag} actions={actions} />
    </ContextMenu>
  )
}
