import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronDown,
  ChevronLeft,
  LayoutGrid,
  PieChart,
  Plus,
  Search,
  Tag,
  Tags,
  Trash2,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router"
import { toast } from "sonner"

import { useLibraryProjectPreview } from "@/context/library-project-preview"
import { useLibrarySelection } from "@/context/library-selection"
import { useProjectLibrary } from "@/context/project-library"
import { usePlApi } from "@/hooks/use-pl-api"
import type { ProjectLibrary } from "@/types/project-library"
import { DEFAULT_LIBRARY_SCOPE, type LibraryScope } from "@/types/library-scope"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { HoverHelp } from "@/components/ui/hover-help"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { FolderNestDropBar, LibraryFolderTree } from "@/components/layout/library-folder-tree"
import { FolderTreePicker } from "@/components/library/folder-tree-picker"
import { ImportFolderBundleDialog } from "@/components/library/import-folder-bundle-dialog"
import { SaveCancelledError } from "@/lib/download-blob"
import { exportFolderBundle, parseFolderBundleFileText } from "@/lib/folder-bundle"
import type { FolderBundle } from "@/types/folder-bundle"
import { parseGithubRepoUrl } from "@/lib/github-url"
import { fetchGithubRepoPreview } from "@/lib/github-repo-preview"
import { getLibraryScopeDisplayLabel } from "@/lib/library-scope-label"
import { filterFolderTreeByName, findFolderNode, totalProjectsInLibraryTree, collectFolderFilterEntries } from "@/lib/library-tree"
import type { FolderRow, LibraryTreeResponse } from "@/types/library"
import { cn } from "@/lib/utils"

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

export function LibrarySidebar() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { library, libraryId } = useProjectLibrary()
  const plApi = usePlApi()
  const { setPreviewProject } = useLibraryProjectPreview()
  const { libraryScope, setLibraryScope, selectedFolderId, setBrowsePendingFolderId } = useLibrarySelection()

  const libraryPath = `/libraries/${libraryId}`

  const goLibraryIfNeeded = useCallback(() => {
    if (location.pathname !== libraryPath) {
      navigate(libraryPath)
    }
  }, [location.pathname, libraryPath, navigate])

  const selectPresetScope = useCallback(
    (scope: LibraryScope) => {
      setLibraryScope(scope)
      goLibraryIfNeeded()
    },
    [goLibraryIfNeeded, setLibraryScope]
  )
  const [treeSearch, setTreeSearch] = useState("")

  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [folderParentId, setFolderParentId] = useState<number | null>(null)

  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [gh, setGh] = useState("")
  const [projIntro, setProjIntro] = useState("")
  const [projectFolderId, setProjectFolderId] = useState<number | null>(null)

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameFolderId, setRenameFolderId] = useState<number | null>(null)
  const [renameInput, setRenameInput] = useState("")

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteFolderId, setDeleteFolderId] = useState<number | null>(null)
  const [deleteFolderName, setDeleteFolderName] = useState("")

  const [importBundleOpen, setImportBundleOpen] = useState(false)
  const [importBundleTargetId, setImportBundleTargetId] = useState<number | null>(null)
  const [importBundleTargetLabel, setImportBundleTargetLabel] = useState("库根")
  const [importBundleInitial, setImportBundleInitial] = useState<FolderBundle | null>(null)

  const [formError, setFormError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewInfo, setPreviewInfo] = useState<string | null>(null)
  const introEditedRef = useRef(false)

  const librariesListQuery = useQuery({
    queryKey: ["project-libraries"],
    queryFn: async (): Promise<ProjectLibrary[]> => {
      const res = await fetch("/api/project-libraries")
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<ProjectLibrary[]>
    },
  })

  const treeQuery = useQuery({
    queryKey: ["library", libraryId, "tree"],
    queryFn: async (): Promise<LibraryTreeResponse> => {
      const res = await fetch(plApi.path("/library/tree"))
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<LibraryTreeResponse>
    },
  })

  const noTagsCountQuery = useQuery({
    queryKey: ["projects", libraryId, "missing-tags-count"],
    queryFn: async (): Promise<number> => {
      const res = await fetch(
        `${plApi.path("/projects")}?missing_tags=true&_start=0&_end=1`
      )
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      const raw = res.headers.get("X-Total-Count")
      return raw ? Number.parseInt(raw, 10) : 0
    },
  })

  const trashCountQuery = useQuery({
    queryKey: ["projects", libraryId, "trash-count"],
    queryFn: async (): Promise<number> => {
      const res = await fetch(`${plApi.path("/projects")}?deleted_only=true&_start=0&_end=1`)
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      const raw = res.headers.get("X-Total-Count")
      return raw ? Number.parseInt(raw, 10) : 0
    },
  })

  const tagsListQuery = useQuery({
    queryKey: ["tags", libraryId],
    queryFn: async (): Promise<unknown[]> => {
      const res = await fetch(plApi.path("/tags"))
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<unknown[]>
    },
  })

  const tagsSidebarCountLabel = useMemo(() => {
    if (tagsListQuery.data === undefined || tagsListQuery.isError) {
      return "—"
    }
    const n = tagsListQuery.data.length
    return n > 0 ? String(n) : "—"
  }, [tagsListQuery.data, tagsListQuery.isError])

  useEffect(() => {
    if (folderDialogOpen) {
      setFolderName("")
      setFormError(null)
    }
  }, [folderDialogOpen])

  useEffect(() => {
    if (projectDialogOpen) {
      setGh("")
      setProjIntro("")
      setFormError(null)
      setPreviewLoading(false)
      setPreviewError(null)
      setPreviewInfo(null)
      introEditedRef.current = false
    }
  }, [projectDialogOpen])

  const projectUrlParsed = useMemo(() => parseGithubRepoUrl(gh.trim()), [gh])

  useEffect(() => {
    introEditedRef.current = false
  }, [projectUrlParsed?.full_name])

  useEffect(() => {
    if (!projectDialogOpen || !projectUrlParsed) {
      setPreviewLoading(false)
      setPreviewError(null)
      setPreviewInfo(null)
      return
    }
    const ac = new AbortController()
    const timer = window.setTimeout(() => {
      setPreviewLoading(true)
      setPreviewError(null)
      setPreviewInfo(null)
      void fetchGithubRepoPreview(projectUrlParsed, ac.signal)
        .then((preview) => {
          if (ac.signal.aborted) {
            return
          }
          if (preview.description && !introEditedRef.current) {
            setProjIntro(preview.description)
          }
          if (preview.error) {
            if (preview.fetched) {
              setPreviewInfo(preview.error)
            } else {
              setPreviewError(preview.error)
            }
          }
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") {
            return
          }
          setPreviewError("网络请求失败，请检查网络连接或确认后端已启动。")
        })
        .finally(() => {
          if (!ac.signal.aborted) {
            setPreviewLoading(false)
          }
        })
    }, 450)
    return () => {
      window.clearTimeout(timer)
      ac.abort()
    }
  }, [projectDialogOpen, projectUrlParsed])

  const createFolderMutation = useMutation({
    mutationFn: async (body: { name: string; parent_id: number | null }) => {
      const res = await fetch(plApi.path("/folders"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<FolderRow>
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["library", libraryId, "tree"] })
      await queryClient.invalidateQueries({ queryKey: ["folders", libraryId, "flat"] })
      await queryClient.invalidateQueries()
      setFolderDialogOpen(false)
    },
  })

  const createProjectMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const res = await fetch(plApi.path("/projects"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json()
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["library", libraryId, "tree"] })
      await queryClient.invalidateQueries()
      setProjectDialogOpen(false)
    },
  })

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await fetch(plApi.path(`/folders/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json()
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["library", libraryId, "tree"] })
      await queryClient.invalidateQueries({ queryKey: ["folders", libraryId, "flat"] })
      await queryClient.invalidateQueries()
      setRenameOpen(false)
      setRenameFolderId(null)
    },
  })

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(plApi.path(`/folders/${id}`), { method: "DELETE" })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
    },
    onSuccess: async (_void, deletedId) => {
      setDeleteOpen(false)
      setDeleteFolderId(null)
      setBrowsePendingFolderId(null)
      await queryClient.invalidateQueries({ queryKey: ["folders", libraryId, "flat"] })
      await queryClient.refetchQueries({ queryKey: ["library", libraryId, "tree"] })
      await queryClient.invalidateQueries()
      const treeData = queryClient.getQueryData<LibraryTreeResponse>([
        "library",
        libraryId,
        "tree",
      ])
      setLibraryScope((prev) => {
        if (prev.kind !== "folder") {
          return prev
        }
        if (prev.folderId === deletedId) {
          return DEFAULT_LIBRARY_SCOPE
        }
        if (!treeData?.folders || findFolderNode(treeData.folders, prev.folderId) === null) {
          return DEFAULT_LIBRARY_SCOPE
        }
        return prev
      })
    },
  })

  const onSubmitFolder = (e: React.FormEvent) => {
    e.preventDefault()
    const name = folderName.trim()
    if (!name) {
      setFormError("请输入文件夹名称")
      return
    }
    setFormError(null)
    createFolderMutation.mutate(
      { name, parent_id: folderParentId },
      {
        onError: (err) => {
          setFormError(err instanceof Error ? err.message : "创建失败")
        },
      }
    )
  }

  const onSubmitProject = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseGithubRepoUrl(gh.trim())
    if (!parsed) {
      setFormError("请填写可识别的 GitHub 仓库 URL（需包含 owner/repo）")
      return
    }
    setFormError(null)
    const payload: Record<string, unknown> = {
      github_url: parsed.normalizedUrl,
      name: parsed.name,
      full_name: parsed.full_name,
    }
    const intro = projIntro.trim()
    if (intro) {
      payload.description = intro
    }
    if (projectFolderId !== null) {
      payload.folder_id = projectFolderId
    }
    createProjectMutation.mutate(payload, {
      onError: (err) => {
        setFormError(err instanceof Error ? err.message : "创建失败")
      },
    })
  }

  const onSubmitRename = (e: React.FormEvent) => {
    e.preventDefault()
    if (renameFolderId === null) {
      return
    }
    const name = renameInput.trim()
    if (!name) {
      setFormError("请输入名称")
      return
    }
    setFormError(null)
    renameFolderMutation.mutate(
      { id: renameFolderId, name },
      {
        onError: (err) => {
          setFormError(err instanceof Error ? err.message : "重命名失败")
        },
      }
    )
  }

  const tree = treeQuery.data

  const folderTreeEntries = useMemo(() => {
    if (!tree?.folders) return []
    return collectFolderFilterEntries(tree.folders)
  }, [tree?.folders])

  const addProjectFolderLabel = useMemo(() => {
    if (projectFolderId === null) {
      return "未归类（库根层）"
    }
    if (!tree?.folders) {
      return "所选文件夹"
    }
    return findFolderNode(tree.folders, projectFolderId)?.name ?? "所选文件夹"
  }, [projectFolderId, tree?.folders])

  const filteredRoots = useMemo(() => {
    if (!tree?.folders) {
      return []
    }
    return filterFolderTreeByName(tree.folders, treeSearch)
  }, [tree?.folders, treeSearch])

  const selectedFolderLabel = useMemo(
    () => getLibraryScopeDisplayLabel(libraryScope, tree?.folders),
    [libraryScope, tree?.folders]
  )

  const allProjectCount = useMemo(() => {
    if (!tree?.folders) {
      return null
    }
    return totalProjectsInLibraryTree(tree.folders, tree.orphan_projects.length)
  }, [tree])

  const orphanCount = tree?.orphan_projects.length ?? null

  const openNewFolderFromMenu = () => {
    setFolderParentId(selectedFolderId)
    setFolderDialogOpen(true)
  }

  const openNewSubfolder = (parentId: number) => {
    setFolderParentId(parentId)
    setFolderDialogOpen(true)
  }

  const openRename = (folderId: number, currentName: string) => {
    setRenameFolderId(folderId)
    setRenameInput(currentName)
    setFormError(null)
    setRenameOpen(true)
  }

  const openDelete = (folderId: number, name: string) => {
    setDeleteFolderId(folderId)
    setDeleteFolderName(name)
    setDeleteOpen(true)
  }

  const openImportBundle = useCallback(
    (targetParentFolderId: number | null, targetLabel: string, initial?: FolderBundle | null) => {
      setImportBundleTargetId(targetParentFolderId)
      setImportBundleTargetLabel(targetLabel)
      setImportBundleInitial(initial ?? null)
      setImportBundleOpen(true)
    },
    []
  )

  const handleFileDropImport = useCallback(
    async (
      file: File,
      targetParentFolderId: number | null,
      targetLabel: string
    ) => {
      try {
        const text = await file.text()
        const bundle = parseFolderBundleFileText(text)
        openImportBundle(targetParentFolderId, targetLabel, bundle)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "无法读取包文件")
      }
    },
    [openImportBundle]
  )

  const handleExportFolder = useCallback(
    async (folderId: number, folderName: string) => {
      try {
        const result = await exportFolderBundle(libraryId, folderId, folderName)
        toast.success(`已导出「${result.filename}」`)
      } catch (e) {
        if (e instanceof SaveCancelledError) {
          return
        }
        toast.error(e instanceof Error ? e.message : "导出失败")
      }
    },
    [libraryId]
  )

  const confirmDelete = () => {
    if (deleteFolderId === null) {
      return
    }
    deleteFolderMutation.mutate(deleteFolderId, {
      onError: (err) => {
        setFormError(err instanceof Error ? err.message : "删除失败")
      },
    })
  }

  const presetActive = (kind: LibraryScope["kind"]) => libraryScope.kind === kind

  const handleBackToLibraries = () => {
    setLibraryScope(DEFAULT_LIBRARY_SCOPE)
    setBrowsePendingFolderId(null)
    setPreviewProject(null)
    navigate("/libraries")
  }

  const switchLibrary = (id: number) => {
    if (id === libraryId) {
      return
    }
    setLibraryScope(DEFAULT_LIBRARY_SCOPE)
    setBrowsePendingFolderId(null)
    setPreviewProject(null)
    navigate(`/libraries/${id}`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border shrink-0 border-b px-2 py-2">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label="返回项目库列表"
            title="返回项目库"
            onClick={handleBackToLibraries}
          >
            <ChevronLeft className="size-4 stroke-[2]" aria-hidden />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-foreground hover:bg-accent/50 flex min-w-0 flex-1 items-center gap-0.5 rounded-md px-1 py-0.5 text-left text-sm font-semibold"
              >
                <span className="truncate">{library?.name ?? "项目库"}</span>
                <ChevronDown className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
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
        <p className="text-muted-foreground truncate pl-8 text-[11px] leading-tight">
          当前：{selectedFolderLabel}
        </p>
      </div>

      <div className="border-border shrink-0 border-b px-2 pb-2 pt-1.5">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" aria-hidden />
          <Input
            type="search"
            value={treeSearch}
            onChange={(e) => setTreeSearch(e.target.value)}
            placeholder="搜索文件夹…"
            className="h-8 border-0 bg-muted/40 pl-8 text-sm shadow-none ring-0 ring-offset-0 focus-visible:ring-1 focus-visible:ring-ring/40"
            aria-label="搜索文件夹"
          />
        </div>
      </div>

      <div className="border-border shrink-0 space-y-0.5 border-b px-1 py-1.5" aria-label="资料库快捷视图">
        <button
          type="button"
          onClick={() => selectPresetScope({ kind: "all" })}
          className={cn(
            "flex min-h-[28px] w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors",
            presetActive("all")
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <LayoutGrid className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">全部</span>
          <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
            {allProjectCount !== null ? allProjectCount : "—"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => selectPresetScope({ kind: "uncategorized" })}
          className={cn(
            "flex min-h-[28px] w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors",
            presetActive("uncategorized")
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <PieChart className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">未分类</span>
          <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
            {orphanCount !== null ? orphanCount : "—"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => selectPresetScope({ kind: "no_tags" })}
          className={cn(
            "flex min-h-[28px] w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors",
            presetActive("no_tags")
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Tag className="size-3.5 shrink-0 opacity-80" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">无标签</span>
          <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
            {noTagsCountQuery.data !== undefined ? noTagsCountQuery.data : "—"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => selectPresetScope({ kind: "tag_manage" })}
          className={cn(
            "flex min-h-[28px] w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors",
            presetActive("tag_manage")
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Tags className="size-3.5 shrink-0 opacity-80" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">标签管理</span>
          <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">{tagsSidebarCountLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => selectPresetScope({ kind: "trash" })}
          className={cn(
            "flex min-h-[28px] w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors",
            presetActive("trash")
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Trash2 className="size-3.5 shrink-0 opacity-80" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">回收站</span>
          <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
            {trashCountQuery.data !== undefined ? trashCountQuery.data : "—"}
          </span>
        </button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {treeQuery.isLoading ? (
          <p className="text-muted-foreground px-2 py-4 text-center text-xs">加载目录树…</p>
        ) : treeQuery.isError ? (
          <p className="text-destructive px-2 py-4 text-center text-xs">
            {(treeQuery.error as Error).message || "加载失败"}
          </p>
        ) : tree ? (
          <LibraryFolderTree
            className="min-h-0"
            folderNestSlot={
              <FolderNestDropBar
                className="flex min-h-[28px] items-center justify-between gap-2 px-1.5 pb-px pt-2"
                onOpenImportToRoot={() => openImportBundle(null, "库根")}
                onFileDropToRoot={(file) => void handleFileDropImport(file, null, "库根")}
              >
                <button
                  type="button"
                  onClick={() => selectPresetScope({ kind: "folders_all" })}
                  className={cn(
                    "flex min-h-[28px] min-w-0 flex-1 items-center rounded-md px-1.5 py-1 text-left text-xs leading-snug transition-colors",
                    libraryScope.kind === "folders_all"
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/80"
                  )}
                >
                  <span className="truncate">文件夹</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      className="size-6 shrink-0 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                      aria-label="新建文件夹或项目"
                    >
                      <Plus className="size-3" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onSelect={openNewFolderFromMenu}>新建文件夹</DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setProjectFolderId(null)
                        setProjectDialogOpen(true)
                      }}
                    >
                      添加 GitHub 项目
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </FolderNestDropBar>
            }
            roots={filteredRoots}
            onOpenNewSubfolder={openNewSubfolder}
            onOpenAddGithubProject={(folderId) => {
              setProjectFolderId(folderId)
              setProjectDialogOpen(true)
              goLibraryIfNeeded()
            }}
            onOpenRename={openRename}
            onOpenDelete={openDelete}
            onOpenExport={(id, name) => void handleExportFolder(id, name)}
            onOpenImport={openImportBundle}
            onFileDropImport={(file, targetId, label) =>
              void handleFileDropImport(file, targetId, label)
            }
          />
        ) : null}
      </div>

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onSubmitFolder}>
            <DialogHeader>
              <DialogTitle>新建文件夹</DialogTitle>
              <DialogDescription>在当前库中创建文件夹；可选择父级文件夹。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-2">
                <Label htmlFor="folder-name">名称</Label>
                <Input
                  id="folder-name"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="例如：前端实验"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="folder-parent">父文件夹</Label>
                <FolderTreePicker
                  id="folder-parent"
                  entries={folderTreeEntries}
                  value={folderParentId === null ? "" : String(folderParentId)}
                  emptyValue=""
                  rootLabel="顶层（无父级）"
                  onChange={(v) =>
                    setFolderParentId(v === "" ? null : Number.parseInt(v, 10))
                  }
                  disabled={treeQuery.isLoading}
                />
              </div>
              {formError ? <p className="text-destructive text-xs">{formError}</p> : null}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setFolderDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createFolderMutation.isPending}>
                {createFolderMutation.isPending ? "创建中…" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onSubmitRename}>
            <DialogHeader>
              <DialogTitle>重命名文件夹</DialogTitle>
              <DialogDescription>将修改当前文件夹显示名称。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-2">
                <Label htmlFor="rename-input">新名称</Label>
                <Input
                  id="rename-input"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  autoComplete="off"
                />
              </div>
              {formError && renameOpen ? <p className="text-destructive text-xs">{formError}</p> : null}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={renameFolderMutation.isPending}>
                {renameFolderMutation.isPending ? "保存中…" : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除文件夹？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deleteFolderName}」及其所有子文件夹；子树内尚未在回收站的项目将一并移入回收站。文件夹删除后不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteFolderMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
            >
              {deleteFolderMutation.isPending ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
          {formError && deleteOpen ? (
            <p className="text-destructive px-6 pb-4 text-xs">{formError}</p>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={onSubmitProject}>
            <DialogHeader>
              <div className="flex items-start gap-2">
                <DialogTitle className="text-left">添加 GitHub 项目</DialogTitle>
                <HoverHelp className="mt-1">
                  <p>名称与 owner/repo 由链接自动解析；输入有效 URL 后会尝试从 GitHub 拉取仓库 Description 填入简介。</p>
                  <p className="text-muted-foreground mt-2">
                    项目将自动归入你打开对话框时所在的文件夹；在库根「文件夹」行新建则为未归类。
                  </p>
                </HoverHelp>
              </div>
              <DialogDescription>
                将创建在：<span className="text-foreground font-medium">{addProjectFolderLabel}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="p-gh">GitHub 仓库 URL</Label>
                  <HoverHelp>
                    <p>支持粘贴浏览器地址栏完整链接，也可输入 github.com/owner/repo（可不带 https://）。</p>
                  </HoverHelp>
                </div>
                <Input
                  id="p-gh"
                  value={gh}
                  onChange={(e) => setGh(e.target.value)}
                  onBlur={() => {
                    const parsed = parseGithubRepoUrl(gh)
                    if (parsed) {
                      setGh(parsed.normalizedUrl)
                    }
                  }}
                  placeholder="https://github.com/owner/repo"
                  required
                />
                {previewError ? <p className="text-destructive text-xs">{previewError}</p> : null}
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="p-intro">简介</Label>
                  <HoverHelp>
                    <p>默认尝试填入 GitHub 仓库 Description；可手动修改，用于资料库列表副标题。</p>
                  </HoverHelp>
                </div>
                {previewLoading ? (
                  <div
                    className="border-input flex min-h-[80px] w-full flex-col gap-2 rounded-md border px-3 py-3"
                    aria-busy="true"
                    aria-label="正在加载简介"
                  >
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-[92%]" />
                    <Skeleton className="h-3 w-[75%]" />
                  </div>
                ) : (
                  <Textarea
                    id="p-intro"
                    value={projIntro}
                    onChange={(e) => {
                      introEditedRef.current = true
                      setProjIntro(e.target.value)
                    }}
                    placeholder="一句话说明该项目用途或你为什么收藏它"
                    rows={3}
                    className="resize-y"
                  />
                )}
                {previewInfo ? <p className="text-muted-foreground text-xs">{previewInfo}</p> : null}
              </div>
              {formError && projectDialogOpen ? <p className="text-destructive text-xs">{formError}</p> : null}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setProjectDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createProjectMutation.isPending}>
                {createProjectMutation.isPending ? "提交中…" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImportFolderBundleDialog
        open={importBundleOpen}
        onOpenChange={setImportBundleOpen}
        libraryId={libraryId}
        targetParentFolderId={importBundleTargetId}
        targetLabel={importBundleTargetLabel}
        initialBundle={importBundleInitial}
      />
    </div>
  )
}
