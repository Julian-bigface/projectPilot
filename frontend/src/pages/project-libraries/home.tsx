import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronDown,
  ChevronUp,
  FolderKanban,
  LayoutGrid,
  List,
  Pin,
  Plus,
  Search,
} from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { useNavigate } from "react-router"
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  clearLastProjectLibraryId,
  readLastProjectLibraryId,
  writeLastProjectLibraryId,
} from "@/context/project-library"
import { cn } from "@/lib/utils"
import type { ProjectLibrary, ProjectLibraryCreate } from "@/types/project-library"

const VIEW_MODE_KEY = "projectPilot.projectLibrariesView"

type ViewMode = "list" | "grid"

function readViewMode(): ViewMode {
  if (typeof window === "undefined") {
    return "list"
  }
  try {
    return window.localStorage.getItem(VIEW_MODE_KEY) === "grid" ? "grid" : "list"
  } catch {
    return "list"
  }
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return `${mm}-${dd} ${hh}:${min}`
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

async function fetchLibraries(): Promise<ProjectLibrary[]> {
  const res = await fetch("/api/project-libraries")
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res))
  }
  return res.json() as Promise<ProjectLibrary[]>
}

export function ProjectLibrariesHomePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [frequentOpen, setFrequentOpen] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<ProjectLibrary | null>(null)
  const [renameName, setRenameName] = useState("")
  const [renameDesc, setRenameDesc] = useState("")
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProjectLibrary | null>(null)

  const librariesQuery = useQuery({
    queryKey: ["project-libraries"],
    queryFn: fetchLibraries,
  })

  const createMutation = useMutation({
    mutationFn: async (body: ProjectLibraryCreate) => {
      const res = await fetch("/api/project-libraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || res.statusText)
      }
      return res.json() as Promise<ProjectLibrary>
    },
    onSuccess: async (lib) => {
      await queryClient.invalidateQueries({ queryKey: ["project-libraries"] })
      setCreateOpen(false)
      setNewName("")
      setNewDesc("")
      setCreateError(null)
      writeLastProjectLibraryId(lib.id)
      navigate(`/libraries/${lib.id}`)
    },
    onError: (err) => {
      setCreateError(err instanceof Error ? err.message : "创建失败")
    },
  })

  const pinMutation = useMutation({
    mutationFn: async ({ id, is_pinned }: { id: number; is_pinned: boolean }) => {
      const res = await fetch(`/api/project-libraries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_pinned }),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-libraries"] })
    },
  })

  const renameMutation = useMutation({
    mutationFn: async ({
      id,
      name,
      description,
    }: {
      id: number
      name: string
      description: string | null
    }) => {
      const res = await fetch(`/api/project-libraries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<ProjectLibrary>
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-libraries"] })
      setRenameTarget(null)
      setRenameError(null)
      toast.success("项目库已更新")
    },
    onError: (err) => {
      setRenameError(err instanceof Error ? err.message : "重命名失败")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/project-libraries/${id}`, { method: "DELETE" })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
    },
    onSuccess: async (_void, deletedId) => {
      await queryClient.invalidateQueries({ queryKey: ["project-libraries"] })
      if (readLastProjectLibraryId() === deletedId) {
        clearLastProjectLibraryId()
      }
      setDeleteTarget(null)
      toast.success("项目库已删除")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "删除失败")
    },
  })

  const libraries = librariesQuery.data ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return libraries
    }
    return libraries.filter(
      (lib) =>
        lib.name.toLowerCase().includes(q) ||
        (lib.description ?? "").toLowerCase().includes(q)
    )
  }, [libraries, search])

  const pinned = useMemo(
    () => filtered.filter((l) => l.is_pinned),
    [filtered]
  )

  const enterLibrary = (id: number) => {
    writeLastProjectLibraryId(id)
    navigate(`/libraries/${id}`)
  }

  const handleViewMode = (v: string) => {
    if (v !== "list" && v !== "grid") {
      return
    }
    setViewMode(v)
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, v)
    } catch {
      /* ignore */
    }
  }

  const submitCreate = () => {
    const name = newName.trim()
    if (!name) {
      setCreateError("请输入名称")
      return
    }
    createMutation.mutate({
      name,
      description: newDesc.trim() || null,
    })
  }

  const openRename = (lib: ProjectLibrary) => {
    setRenameTarget(lib)
    setRenameName(lib.name)
    setRenameDesc(lib.description ?? "")
    setRenameError(null)
  }

  const submitRename = () => {
    if (!renameTarget) {
      return
    }
    const name = renameName.trim()
    if (!name) {
      setRenameError("请输入名称")
      return
    }
    renameMutation.mutate({
      id: renameTarget.id,
      name,
      description: renameDesc.trim() || null,
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) {
      return
    }
    deleteMutation.mutate(deleteTarget.id)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-border flex shrink-0 flex-wrap items-center gap-3 border-b px-6 py-4">
        <h1 className="text-foreground min-w-0 flex-1 text-xl font-semibold tracking-tight">
          项目库
        </h1>
        <div className="relative w-full max-w-xs sm:w-56">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="搜索项目库"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
            aria-label="搜索项目库"
          />
        </div>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          新建项目库
        </Button>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={handleViewMode}
          variant="outline"
          size="sm"
          aria-label="视图切换"
        >
          <ToggleGroupItem value="list" aria-label="列表视图">
            <List className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="网格视图">
            <LayoutGrid className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        {pinned.length > 0 ? (
          <section className="mb-6">
            <div className="bg-muted/40 mb-2 flex items-center justify-between rounded-md px-3 py-2">
              <span className="text-muted-foreground text-xs font-medium">常用</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-7 gap-1 px-2 text-xs"
                onClick={() => setFrequentOpen((o) => !o)}
              >
                {frequentOpen ? (
                  <>
                    收起 <ChevronUp className="size-3.5" />
                  </>
                ) : (
                  <>
                    展开 <ChevronDown className="size-3.5" />
                  </>
                )}
              </Button>
            </div>
            {frequentOpen ? (
              <div className="flex flex-wrap gap-2">
                {pinned.map((lib) => (
                  <Button
                    key={lib.id}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8"
                    onClick={() => enterLibrary(lib.id)}
                  >
                    {lib.name}
                  </Button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {librariesQuery.isError ? (
          <p className="text-destructive text-sm">加载失败，请稍后重试。</p>
        ) : librariesQuery.isLoading ? (
          <p className="text-muted-foreground text-sm">加载中…</p>
        ) : viewMode === "grid" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((lib) => (
              <ProjectLibraryContextMenu
                key={lib.id}
                onEnter={() => enterLibrary(lib.id)}
                onRename={() => openRename(lib)}
                onDelete={() => setDeleteTarget(lib)}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => enterLibrary(lib.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      enterLibrary(lib.id)
                    }
                  }}
                  className="border-border hover:bg-muted/30 flex cursor-pointer flex-col rounded-lg border p-4 text-left transition-colors"
                >
                  <div className="mb-2 flex items-start gap-2">
                    <FolderKanban className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
                    <span className="text-foreground min-w-0 flex-1 font-medium">{lib.name}</span>
                    <PinButton
                      pinned={lib.is_pinned}
                      onToggle={() =>
                        pinMutation.mutate({ id: lib.id, is_pinned: !lib.is_pinned })
                      }
                    />
                  </div>
                  <p className="text-muted-foreground line-clamp-2 min-h-[2.5rem] text-xs">
                    {lib.description || "—"}
                  </p>
                  <p className="text-muted-foreground mt-3 text-[11px] tabular-nums">
                    {formatUpdatedAt(lib.updated_at)}
                  </p>
                </div>
              </ProjectLibraryContextMenu>
            ))}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left text-xs">
                <th className="pb-2 font-medium">名称</th>
                <th className="hidden pb-2 font-medium sm:table-cell">简介</th>
                <th className="pb-2 text-right font-medium">更新时间</th>
                <th className="w-10 pb-2" aria-label="置顶" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((lib) => (
                <ProjectLibraryContextMenu
                  key={lib.id}
                  onEnter={() => enterLibrary(lib.id)}
                  onRename={() => openRename(lib)}
                  onDelete={() => setDeleteTarget(lib)}
                >
                  <tr
                    className="border-border hover:bg-muted/30 cursor-pointer border-b transition-colors"
                    onClick={() => enterLibrary(lib.id)}
                  >
                    <td className="py-2.5 pr-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <FolderKanban className="text-primary size-4 shrink-0" aria-hidden />
                        <span className="text-foreground truncate font-medium">{lib.name}</span>
                      </div>
                    </td>
                    <td className="text-muted-foreground hidden max-w-md truncate py-2.5 sm:table-cell">
                      {lib.description || "—"}
                    </td>
                    <td className="text-muted-foreground py-2.5 text-right text-xs tabular-nums whitespace-nowrap">
                      {formatUpdatedAt(lib.updated_at)}
                    </td>
                    <td className="py-2.5 text-right">
                      <PinButton
                        pinned={lib.is_pinned}
                        onToggle={() =>
                          pinMutation.mutate({ id: lib.id, is_pinned: !lib.is_pinned })
                        }
                      />
                    </td>
                  </tr>
                </ProjectLibraryContextMenu>
              ))}
            </tbody>
          </table>
        )}

        {!librariesQuery.isLoading && filtered.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {search.trim() ? "没有匹配的项目库" : "暂无项目库，点击「新建项目库」开始"}
          </p>
        ) : null}
      </div>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null)
            setRenameError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名项目库</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pl-rename-name">名称</Label>
              <Input
                id="pl-rename-name"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    submitRename()
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-rename-desc">简介</Label>
              <Textarea
                id="pl-rename-desc"
                value={renameDesc}
                onChange={(e) => setRenameDesc(e.target.value)}
                placeholder="可选"
                rows={3}
              />
            </div>
            {renameError ? <p className="text-destructive text-xs">{renameError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button type="button" onClick={submitRename} disabled={renameMutation.isPending}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除项目库？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除「{deleteTarget?.name}」及其中的文件夹、标签与项目，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
              disabled={deleteMutation.isPending}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建项目库</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pl-name">名称</Label>
              <Input
                id="pl-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例如：开源项目"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-desc">简介</Label>
              <Textarea
                id="pl-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="可选"
                rows={3}
              />
            </div>
            {createError ? (
              <p className="text-destructive text-xs">{createError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={submitCreate} disabled={createMutation.isPending}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProjectLibraryContextMenu({
  children,
  onEnter,
  onRename,
  onDelete,
}: {
  children: ReactNode
  onEnter: () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onSelect={onEnter}>打开</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onRename}>重命名</ContextMenuItem>
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={onDelete}
        >
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function PinButton({ pinned, onToggle }: { pinned: boolean; onToggle: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-8 shrink-0", pinned && "text-primary")}
      aria-label={pinned ? "取消置顶" : "置顶到常用"}
      title={pinned ? "取消置顶" : "置顶到常用"}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <Pin className={cn("size-4", pinned && "fill-current")} aria-hidden />
    </Button>
  )
}
