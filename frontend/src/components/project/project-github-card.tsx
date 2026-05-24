import { useDraggable } from "@dnd-kit/core"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Calendar, GitFork, Star } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { projectDragId } from "@/components/layout/library-dnd-ids"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLibraryFeatureDrawer } from "@/context/library-feature-drawer"
import { useLibrarySelection } from "@/context/library-selection"
import { useLibraryProjectPreview } from "@/context/library-project-preview"
import { formatGithubPushedRelative } from "@/lib/github-relative-time"
import { invalidateProjectRelated } from "@/lib/invalidate-project-queries"
import { parseGithubOwner, projectSubtitle } from "@/lib/project-display"
import { domainTagPillClass } from "@/lib/topic-pill-palette"
import { cn } from "@/lib/utils"
import type { FolderRow } from "@/types/library"
import type { Project } from "@/types/project"

type ProjectGithubCardProps = {
  project: Project
  className?: string
  /** 资料库主区等场景：与侧栏文件夹树同属 `DndContext` 时可拖入文件夹归类 */
  draggableProjectId?: number
  /** 网格等高单元为 true；瀑布流为 false，避免 `h-full` 撑满列 */
  fillGridCell?: boolean
  /** 回收站列表：禁用拖拽与移入文件夹，提供恢复/彻底删除 */
  trashMode?: boolean
}

/** 与 `ProjectLibraryPreviewPanel` 项目名 `h2`（`text-base`…）字号与字重一致 */
const ALERT_TITLE_LIKE_PREVIEW_PANEL =
  "text-foreground min-w-0 break-words text-left text-base leading-snug font-semibold tracking-tight sm:text-left"
/** 相对 UI 默认 `p-6` / `gap-4`：纵向内边距 ×1.4；标题区与按钮区间距在 ×1.4 基础上再 ×1.2（+20%） */
const ALERT_CONTENT_HEIGHT_PLUS_40 = "px-6 py-[calc(1.5rem*1.4)] gap-[calc(1rem*1.4*1.2)]"

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

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 98 96" className={className} aria-hidden>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.225-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
      />
    </svg>
  )
}

function stopCardPointer(e: React.PointerEvent | React.MouseEvent) {
  e.stopPropagation()
}

function formatGithubAbsolute(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return ""
  }
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function RepoAvatar({
  owner,
  displayName,
  fullName,
  className,
}: {
  owner: string | null
  displayName: string
  fullName: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const src = owner ? `https://github.com/${owner}.png?size=80` : null
  const initial = (displayName.trim() || fullName.trim() || "?").slice(0, 1).toUpperCase()

  if (!src || failed) {
    return (
      <div
        className={cn(
          "bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
          className
        )}
        aria-hidden
      >
        {initial}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      width={36}
      height={36}
      className={cn("size-9 shrink-0 rounded-md object-cover", className)}
      onError={() => setFailed(true)}
    />
  )
}

export function ProjectGithubCard({
  project,
  className,
  draggableProjectId,
  fillGridCell = true,
  trashMode = false,
}: ProjectGithubCardProps) {
  const p = project
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { previewProject, setPreviewProject } = useLibraryProjectPreview()
  const { ensureFeatureDrawerOpen } = useLibraryFeatureDrawer()
  const { setBrowsePendingFolderId } = useLibrarySelection()
  const selectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [permDeleteOpen, setPermDeleteOpen] = useState(false)

  const libraryCard = draggableProjectId !== undefined
  const showLibraryChrome = libraryCard && !trashMode
  const dragEnabled = draggableProjectId !== undefined && !trashMode

  const foldersQuery = useQuery({
    queryKey: ["folders", "flat"],
    queryFn: async (): Promise<FolderRow[]> => {
      const res = await fetch("/api/folders")
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<FolderRow[]>
    },
    enabled: showLibraryChrome,
  })

  const sortedFolders = useMemo(() => {
    const rows = foldersQuery.data
    if (!rows?.length) {
      return []
    }
    return [...rows].sort((a, b) =>
      a.sort_order !== b.sort_order ? a.sort_order - b.sort_order : a.name.localeCompare(b.name, "zh-CN")
    )
  }, [foldersQuery.data])

  const moveMutation = useMutation({
    mutationFn: async (folderId: number | null) => {
      if (p.folder_id === folderId) {
        return null
      }
      const res = await fetch(`/api/projects/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: folderId }),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json()
    },
    onSuccess: async (data) => {
      if (data === null) {
        return
      }
      toast.success("已移动项目")
      await invalidateProjectRelated(queryClient, p.id)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "移动失败")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json()
    },
    onSuccess: async (_, id) => {
      toast.success("已移入回收站")
      if (previewProject?.id === id) {
        setPreviewProject(null)
      }
      await invalidateProjectRelated(queryClient, id)
      setDeleteOpen(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "删除失败")
    },
  })

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/projects/${id}/restore`, { method: "POST" })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<Project>
    },
    onSuccess: async (_, id) => {
      toast.success("已恢复项目")
      if (previewProject?.id === id) {
        setPreviewProject(null)
      }
      await invalidateProjectRelated(queryClient, id)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "恢复失败")
    },
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/projects/${id}/permanent`, { method: "DELETE" })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
    },
    onSuccess: async (_, id) => {
      toast.success("已彻底删除")
      if (previewProject?.id === id) {
        setPreviewProject(null)
      }
      await invalidateProjectRelated(queryClient, id)
      setPermDeleteOpen(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "删除失败")
    },
  })

  const clearSelectTimer = () => {
    if (selectTimerRef.current) {
      clearTimeout(selectTimerRef.current)
      selectTimerRef.current = null
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    if (trashMode) {
      return
    }
    if (draggableProjectId === undefined) {
      return
    }
    if (e.detail >= 2) {
      clearSelectTimer()
      void navigate(`/projects/${p.id}`)
      return
    }
    if (e.detail === 1) {
      clearSelectTimer()
      selectTimerRef.current = setTimeout(() => {
        selectTimerRef.current = null
        ensureFeatureDrawerOpen()
        setBrowsePendingFolderId(null)
        setPreviewProject(p)
      }, 280)
    }
  }

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (trashMode) {
      return
    }
    if (draggableProjectId === undefined) {
      return
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      ensureFeatureDrawerOpen()
      setBrowsePendingFolderId(null)
      setPreviewProject(p)
    }
  }

  const handleContextMenu = useCallback(() => {
    clearSelectTimer()
  }, [])

  const copyGithubLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(p.github_url)
      toast.success("已复制链接")
    } catch {
      toast.error("复制失败，请检查浏览器权限")
    }
  }, [p.github_url])

  const openProjectDetail = useCallback(() => {
    setPreviewProject(null)
    void navigate(`/projects/${p.id}`)
  }, [navigate, p.id, setPreviewProject])

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragEnabled ? projectDragId(draggableProjectId!) : "library-project-card-inert",
    disabled: !dragEnabled,
  })

  const owner = parseGithubOwner(p.full_name)
  const descFromUser = p.description?.trim()
  const subtitleFallback = projectSubtitle(p)
  const bodyText =
    descFromUser ||
    (subtitleFallback !== p.full_name.trim() ? subtitleFallback : "")

  const pushedIso = p.github_pushed_at
  const pushedRelative = formatGithubPushedRelative(pushedIso)
  const pushedAbsolute = formatGithubAbsolute(pushedIso)
  const pushedTooltip =
    pushedAbsolute !== ""
      ? `上次推送：${pushedAbsolute}\n相对：${pushedRelative}`
      : "暂无上次推送时间"

  const MAX_TAGS_ON_CARD = 8
  const allTags = p.tags ?? []
  const tagOverflow = allTags.length > MAX_TAGS_ON_CARD
  const visibleTags = allTags.slice(0, MAX_TAGS_ON_CARD)
  const hiddenTagCount = allTags.length - visibleTags.length

  const deleteConfirmName = p.name.trim() || p.full_name

  const cardInner = (
    <>
      <div className="bg-amber-400 dark:bg-amber-500/90 h-0.5 w-full shrink-0" aria-hidden />
      <div className={cn("flex flex-col p-3", fillGridCell && "min-h-0 flex-1")}>
        <div className={cn("flex min-w-0 flex-col", fillGridCell && "min-h-0 flex-1")}>
          <div className="flex min-w-0 flex-wrap items-start gap-2">
            <RepoAvatar owner={owner} displayName={p.name} fullName={p.full_name} />
            <div className="min-w-0 flex-1 basis-[8rem]">
              <p className="text-foreground break-words text-xs font-semibold leading-snug tracking-tight">
                {p.name.trim() || p.full_name}
              </p>
              <div className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 text-xs leading-snug">
                <GithubMark className="size-3 shrink-0 opacity-80" aria-hidden />
                <a
                  href={p.github_url}
                  target="_blank"
                  rel="noreferrer"
                  title={p.github_url}
                  className="text-primary w-max min-w-0 max-w-full shrink truncate underline-offset-2 hover:underline"
                  onPointerDown={stopCardPointer}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {p.full_name}
                </a>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "mt-2 min-w-0 text-xs leading-snug",
              fillGridCell && "min-h-[calc(0.75rem*1.375*3)]",
            )}
          >
            {bodyText ? (
              <p
                className={cn(
                  "text-muted-foreground leading-snug",
                  fillGridCell && "line-clamp-3",
                )}
              >
                {bodyText}
              </p>
            ) : (
              <p className="text-muted-foreground/80 italic">暂无仓库简介</p>
            )}
          </div>

          <div
            className={cn(
              "mt-2 flex min-w-0 flex-wrap content-start items-start gap-1 px-0.5 py-px",
              fillGridCell && "min-h-[calc(2*1.25rem+0.25rem)]",
            )}
          >
            {allTags.length > 0 ? (
              <>
                {visibleTags.map((t) => (
                  <span key={t.id} className={domainTagPillClass(t.id)}>
                    <span className="truncate">{t.name}</span>
                  </span>
                ))}
                {tagOverflow ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="border-border text-muted-foreground bg-muted/45 inline-flex shrink-0 cursor-default items-center rounded-full border border-dashed px-2 py-px text-[11px] font-semibold leading-none tracking-wide select-none"
                        aria-label={`还有 ${hiddenTagCount} 个标签未在此卡片展示`}
                      >
                        …
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      还有 {hiddenTagCount} 个标签未在此卡片展示，可在详情或右栏预览中查看全部。
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground/70 px-0.5 text-xs leading-snug">暂无标签</span>
            )}
          </div>
        </div>

        <div className="border-border text-muted-foreground mt-3 flex w-full shrink-0 min-w-0 items-center justify-between gap-x-3 border-t pt-2 text-xs leading-snug">
          <div className="flex min-w-0 shrink items-center gap-x-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-default items-center gap-1 tabular-nums">
                  <Star className="size-3 shrink-0 opacity-70" aria-hidden />
                  <span className="truncate">{p.stars.toLocaleString("zh-CN")}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">Star：{p.stars.toLocaleString("zh-CN")}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-default items-center gap-1 tabular-nums">
                  <GitFork className="size-3 shrink-0 opacity-70" aria-hidden />
                  <span className="truncate">{(p.forks ?? 0).toLocaleString("zh-CN")}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">Fork：{(p.forks ?? 0).toLocaleString("zh-CN")}</TooltipContent>
            </Tooltip>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex min-w-0 shrink-0 cursor-default items-center justify-end gap-1 tabular-nums">
                <Calendar className="size-3 shrink-0 opacity-70" aria-hidden />
                <span className="max-w-[10rem] truncate">{pushedRelative}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs whitespace-pre-line">
              {pushedTooltip}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  )

  return (
    <>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className={ALERT_CONTENT_HEIGHT_PLUS_40}>
          <AlertDialogHeader className="text-left sm:text-left">
            <AlertDialogTitle className={ALERT_TITLE_LIKE_PREVIEW_PANEL}>
              将「{deleteConfirmName}」移入回收站？
            </AlertDialogTitle>
            <AlertDialogDescription>
              项目将暂存在回收站，可恢复或彻底删除；不会立即从磁盘移除 GitHub 仓库。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                deleteMutation.mutate(p.id)
              }}
            >
              {deleteMutation.isPending ? "处理中…" : "确认"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={permDeleteOpen} onOpenChange={setPermDeleteOpen}>
        <AlertDialogContent className={ALERT_CONTENT_HEIGHT_PLUS_40}>
          <AlertDialogHeader className="text-left sm:text-left">
            <AlertDialogTitle className={ALERT_TITLE_LIKE_PREVIEW_PANEL}>彻底删除「{deleteConfirmName}」？</AlertDialogTitle>
            <AlertDialogDescription>此操作无法撤销，项目记录将从本地移除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={permanentDeleteMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={permanentDeleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                permanentDeleteMutation.mutate(p.id)
              }}
            >
              {permanentDeleteMutation.isPending ? "删除中…" : "彻底删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            role="button"
            tabIndex={0}
            onClick={handleCardClick}
            onKeyDown={handleCardKeyDown}
            onContextMenu={handleContextMenu}
            className={cn(
              "border-border bg-card focus-visible:ring-ring relative flex min-h-0 flex-col overflow-hidden rounded-lg border shadow-sm transition-colors",
              fillGridCell && "h-full",
              "hover:bg-accent/25 cursor-pointer focus-visible:ring-2 focus-visible:outline-none",
              dragEnabled && "touch-none cursor-grab active:cursor-grabbing",
              isDragging && "opacity-40",
              className
            )}
          >
            {cardInner}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuItem onSelect={() => void copyGithubLink()}>复制链接</ContextMenuItem>
          {!trashMode ? <ContextMenuItem onSelect={openProjectDetail}>打开详情页</ContextMenuItem> : null}
          {showLibraryChrome ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuSub>
                <ContextMenuSubTrigger>移动到…</ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-52 min-w-[10rem] overflow-y-auto">
                  <ContextMenuItem
                    disabled={p.folder_id === null || moveMutation.isPending}
                    onSelect={() => moveMutation.mutate(null)}
                  >
                    未归类
                  </ContextMenuItem>
                  {sortedFolders.map((f) => (
                    <ContextMenuItem
                      key={f.id}
                      disabled={f.id === p.folder_id || moveMutation.isPending}
                      onSelect={() => moveMutation.mutate(f.id)}
                    >
                      {f.name}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                移入回收站…
              </ContextMenuItem>
            </>
          ) : null}
          {trashMode ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                disabled={restoreMutation.isPending}
                onSelect={() => restoreMutation.mutate(p.id)}
              >
                恢复
              </ContextMenuItem>
              <ContextMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                disabled={permanentDeleteMutation.isPending}
                onSelect={() => setPermDeleteOpen(true)}
              >
                彻底删除…
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
    </>
  )
}
