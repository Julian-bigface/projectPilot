import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, FilePlus, Loader2, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { NavLink, useNavigate, useParams } from "react-router"
import { toast } from "sonner"

import { ProjectPickerDialog } from "@/components/content-factory/project-picker-dialog"
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  useOptionalProjectLibrary,
  writeLastProjectLibraryId,
} from "@/context/project-library"
import {
  createContentFactoryDraft,
  deleteContentFactoryDraft,
  fetchContentFactoryDrafts,
  patchContentFactoryDraft,
} from "@/lib/content-factory-api"
import { writeLastContentFactoryLibraryId } from "@/lib/content-factory-path"
import { groupContentFactoryDraftsByTime } from "@/lib/group-content-factory-drafts-by-time"
import { cn } from "@/lib/utils"
import { CONTENT_FACTORY_SECTIONS, type ContentFactoryDraft } from "@/types/content-factory"
import type { ProjectLibrary } from "@/types/project-library"

function draftDisplayTitle(draft: ContentFactoryDraft): string {
  return draft.title || `${draft.project.name} 推荐稿`
}

type DraftSidebarItemProps = {
  draft: ContentFactoryDraft
  active: boolean
  href: string
  onEditTitle: (draft: ContentFactoryDraft) => void
  onDelete: (draft: ContentFactoryDraft) => void
}

function DraftSidebarItem({
  draft,
  active,
  href,
  onEditTitle,
  onDelete,
}: DraftSidebarItemProps) {
  const label = draftDisplayTitle(draft)

  return (
    <ContextMenu>
      <HoverCard openDelay={400} closeDelay={80}>
        <ContextMenuTrigger asChild>
          <HoverCardTrigger asChild>
            <NavLink
              to={href}
              className={cn(
                "rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                active ? "bg-accent" : "hover:bg-muted/60"
              )}
            >
              <div className="text-foreground truncate font-semibold">{label}</div>
              <div className="text-muted-foreground mt-0.5 truncate text-[10px]">
                {draft.project.full_name}
              </div>
            </NavLink>
          </HoverCardTrigger>
        </ContextMenuTrigger>
        <HoverCardContent
          side="right"
          align="start"
          className="w-72 p-3 text-xs leading-relaxed"
        >
          <p className="text-foreground font-semibold break-words">{label}</p>
        </HoverCardContent>
      </HoverCard>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onSelect={() => onEditTitle(draft)}>编辑标题</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => onDelete(draft)}
        >
          删除草稿
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function ContentFactorySidebar() {
  const { libraryId: libraryIdParam, draftId: draftIdParam } = useParams()
  const libraryId = Number(libraryIdParam)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameDraftId, setRenameDraftId] = useState<number | null>(null)
  const [renameInput, setRenameInput] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ContentFactoryDraft | null>(null)
  const libraryCtx = useOptionalProjectLibrary()
  const libraryName = libraryCtx?.library?.name

  const librariesListQuery = useQuery({
    queryKey: ["project-libraries"],
    queryFn: async (): Promise<ProjectLibrary[]> => {
      const res = await fetch("/api/project-libraries")
      if (!res.ok) {
        throw new Error(res.statusText || `HTTP ${res.status}`)
      }
      return res.json() as Promise<ProjectLibrary[]>
    },
  })

  const switchLibrary = useCallback(
    (id: number) => {
      if (id === libraryId) {
        return
      }
      writeLastContentFactoryLibraryId(id)
      writeLastProjectLibraryId(id)
      navigate(`/libraries/${id}/content-factory/project-promotion`)
    },
    [libraryId, navigate]
  )

  useEffect(() => {
    if (Number.isFinite(libraryId) && libraryId > 0) {
      writeLastContentFactoryLibraryId(libraryId)
    }
  }, [libraryId])

  const draftsQuery = useQuery({
    queryKey: ["content-factory", libraryId, "drafts"],
    queryFn: () => fetchContentFactoryDrafts(libraryId),
    enabled: Number.isFinite(libraryId) && libraryId > 0,
  })

  const draftTimeGroups = useMemo(
    () => groupContentFactoryDraftsByTime(draftsQuery.data ?? []),
    [draftsQuery.data]
  )

  const createMutation = useMutation({
    mutationFn: (projectId: number) =>
      createContentFactoryDraft(libraryId, { project_id: projectId }),
    onSuccess: (draft) => {
      void queryClient.invalidateQueries({ queryKey: ["content-factory", libraryId, "drafts"] })
      navigate(`/libraries/${libraryId}/content-factory/project-promotion/${draft.id}`)
      setPickerOpen(false)
    },
    onError: (err: Error) => {
      toast.error(err.message || "创建草稿失败")
    },
  })

  const basePath = `/libraries/${libraryId}/content-factory`

  const invalidateDrafts = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["content-factory", libraryId, "drafts"] })
  }, [libraryId, queryClient])

  const renameMutation = useMutation({
    mutationFn: ({ draftId, title }: { draftId: number; title: string }) =>
      patchContentFactoryDraft(libraryId, draftId, { title }),
    onSuccess: (_data, { draftId }) => {
      invalidateDrafts()
      void queryClient.invalidateQueries({
        queryKey: ["content-factory", libraryId, "draft", draftId],
      })
      setRenameOpen(false)
      toast.success("标题已更新")
    },
    onError: (err: Error) => {
      toast.error(err.message || "更新标题失败")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (draftId: number) => deleteContentFactoryDraft(libraryId, draftId),
    onSuccess: (_data, deletedId) => {
      invalidateDrafts()
      void queryClient.removeQueries({
        queryKey: ["content-factory", libraryId, "draft", deletedId],
      })
      setDeleteOpen(false)
      setDeleteTarget(null)
      if (draftIdParam === String(deletedId)) {
        navigate(`${basePath}/project-promotion`)
      }
      toast.success("草稿已删除")
    },
    onError: (err: Error) => {
      toast.error(err.message || "删除草稿失败")
    },
  })

  const openRename = useCallback((draft: ContentFactoryDraft) => {
    setRenameDraftId(draft.id)
    setRenameInput(draftDisplayTitle(draft))
    setRenameOpen(true)
  }, [])

  const openDelete = useCallback((draft: ContentFactoryDraft) => {
    setDeleteTarget(draft)
    setDeleteOpen(true)
  }, [])

  const handleRenameSubmit = () => {
    const title = renameInput.trim()
    if (!renameDraftId || !title) {
      toast.error("标题不能为空")
      return
    }
    renameMutation.mutate({ draftId: renameDraftId, title })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border border-b px-3 py-3">
        <h2 className="px-1 text-sm font-semibold">内容工厂</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:bg-accent/50 mt-1 flex w-full min-w-0 items-center gap-0.5 rounded-md px-1 py-1 text-left text-[11px] transition-colors"
            >
              <span className="truncate">{libraryName ?? "选择项目库"}</span>
              <ChevronDown className="size-3 shrink-0" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 w-56 overflow-y-auto">
            {(librariesListQuery.data ?? []).map((lib) => (
              <DropdownMenuItem
                key={lib.id}
                onClick={() => switchLibrary(lib.id)}
                className={cn(lib.id === libraryId && "bg-accent")}
              >
                <span className="truncate">{lib.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => navigate("/libraries")}>
              管理项目库…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="border-border flex gap-1 border-b p-2">
        {CONTENT_FACTORY_SECTIONS.map((section) => {
          const href = `${basePath}/${section.id}`
          if (!section.enabled) {
            return (
              <div
                key={section.id}
                className="text-muted-foreground flex flex-1 flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-xs opacity-60"
                title="即将推出"
              >
                <span>{section.label}</span>
                <span className="bg-muted text-muted-foreground rounded px-1 text-[10px]">
                  即将推出
                </span>
              </div>
            )
          }
          return (
            <NavLink
              key={section.id}
              to={href}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 items-center justify-center rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-muted/60"
                )
              }
            >
              {section.label}
            </NavLink>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-muted-foreground text-xs font-medium">草稿库</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          title="新建草稿"
          aria-label="新建草稿"
          onClick={() => setPickerOpen(true)}
        >
          <FilePlus className="size-4" aria-hidden />
        </Button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="草稿库">
        {draftsQuery.isLoading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-xs">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            加载中…
          </div>
        ) : draftsQuery.isError ? (
          <div className="flex flex-col items-center gap-2 px-2 py-4 text-center">
            <p className="text-destructive text-xs">草稿加载失败，请确认后端已启动</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => void draftsQuery.refetch()}
            >
              <RefreshCw className="size-3" aria-hidden />
              重试
            </Button>
          </div>
        ) : (draftsQuery.data?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground px-2 py-4 text-xs">暂无草稿，点击上方 + 新建</p>
        ) : (
          draftTimeGroups.map((group, groupIndex) => (
            <section key={group.bucket} className="flex flex-col gap-0.5">
              <h3
                className={cn(
                  "text-muted-foreground px-2.5 pb-1 text-[11px] font-medium",
                  groupIndex > 0 ? "pt-3" : "pt-0.5"
                )}
              >
                {group.label}
              </h3>
              {group.drafts.map((draft) => (
                <DraftSidebarItem
                  key={draft.id}
                  draft={draft}
                  active={draftIdParam === String(draft.id)}
                  href={`${basePath}/project-promotion/${draft.id}`}
                  onEditTitle={openRename}
                  onDelete={openDelete}
                />
              ))}
            </section>
          ))
        )}
      </nav>

      <ProjectPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        libraryId={libraryId}
        loading={createMutation.isPending}
        onSelect={(projectId) => createMutation.mutate(projectId)}
      />

      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open)
          if (!open) {
            setRenameDraftId(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑标题</DialogTitle>
            <DialogDescription>修改草稿在侧栏中显示的名称。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="draft-rename-input">标题</Label>
            <Input
              id="draft-rename-input"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleRenameSubmit()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              disabled={renameMutation.isPending || !renameInput.trim()}
              onClick={handleRenameSubmit}
            >
              {renameMutation.isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) {
            setDeleteTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除草稿？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除「
              {deleteTarget ? draftDisplayTitle(deleteTarget) : ""}
              」，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending || deleteTarget == null}
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
    </div>
  )
}
