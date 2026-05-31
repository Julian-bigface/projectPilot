import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FolderTreePicker } from "@/components/library/folder-tree-picker"
import { Label } from "@/components/ui/label"
import { parseApiErrorMessage } from "@/lib/api-error"
import { invalidateProjectRelated } from "@/lib/invalidate-project-queries"
import { collectFolderFilterEntries } from "@/lib/library-tree"
import { plApiPath } from "@/lib/pl-api"
import type { LibraryTreeResponse } from "@/types/library"
import type { DiscoveryRepo } from "@/types/discovery"
import type { Project } from "@/types/project"
import type { ProjectLibrary } from "@/types/project-library"

export type ImportToLibraryDialogProps = {
  repo: DiscoveryRepo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: (project: Project) => void
}

async function fetchLibraries(): Promise<ProjectLibrary[]> {
  const res = await fetch("/api/project-libraries")
  if (!res.ok) {
    throw new Error(await parseApiErrorMessage(res))
  }
  return res.json() as Promise<ProjectLibrary[]>
}

async function fetchLibraryTree(libraryId: number): Promise<LibraryTreeResponse> {
  const res = await fetch(plApiPath(libraryId, "/library/tree"))
  if (!res.ok) {
    throw new Error(await parseApiErrorMessage(res))
  }
  return res.json() as Promise<LibraryTreeResponse>
}

async function checkDuplicate(libraryId: number, fullName: string): Promise<Project | null> {
  const params = new URLSearchParams({ full_name: fullName, _start: "0", _end: "1" })
  const res = await fetch(`${plApiPath(libraryId, "/projects")}?${params}`)
  if (!res.ok) {
    return null
  }
  const rows = (await res.json()) as Project[]
  return rows[0] ?? null
}

export function ImportToLibraryDialog({
  repo,
  open,
  onOpenChange,
  onImported,
}: ImportToLibraryDialogProps) {
  const queryClient = useQueryClient()
  const [libraryId, setLibraryId] = useState<number | null>(null)
  const [folderId, setFolderId] = useState<string>("none")

  const librariesQuery = useQuery({
    queryKey: ["project-libraries"],
    queryFn: fetchLibraries,
    enabled: open,
  })

  const libraries = librariesQuery.data ?? []

  useEffect(() => {
    if (!open || libraries.length === 0) return
    if (libraryId != null && libraries.some((l) => l.id === libraryId)) return
    const pinned = libraries.find((l) => l.is_pinned)
    setLibraryId(pinned?.id ?? libraries[0]?.id ?? null)
  }, [open, libraries, libraryId])

  const foldersQuery = useQuery({
    queryKey: ["discovery-import-folders", libraryId],
    queryFn: () => fetchLibraryTree(libraryId!),
    enabled: open && libraryId != null,
  })

  const folderOptions = useMemo(() => {
    const tree = foldersQuery.data
    if (!tree?.folders) return []
    return collectFolderFilterEntries(tree.folders)
  }, [foldersQuery.data])

  useEffect(() => {
    if (!open) {
      setFolderId("none")
    }
  }, [open])

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!repo || libraryId == null) {
        throw new Error("请选择项目库")
      }
      const existing = await checkDuplicate(libraryId, repo.full_name)
      if (existing) {
        throw new Error(`该库已收录 ${repo.full_name}`)
      }
      const body: Record<string, unknown> = {
        github_url: repo.github_url,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        stars: repo.stars,
        forks: repo.forks,
        language: repo.language,
        state: "未体验",
      }
      if (folderId !== "none") {
        body.folder_id = Number(folderId)
      }
      const res = await fetch(plApiPath(libraryId, "/projects"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        throw new Error(await parseApiErrorMessage(res))
      }
      return (await res.json()) as Project
    },
    onSuccess: async (project) => {
      toast.success("已加入资料库", {
        description: project.full_name,
      })
      await invalidateProjectRelated(queryClient, project.id, project)
      void queryClient.invalidateQueries({ queryKey: ["discovery-imported-map"] })
      onImported?.(project)
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "导入失败")
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>加入资料库</DialogTitle>
          <DialogDescription>
            {repo ? (
              <>
                将 <span className="font-mono">{repo.full_name}</span> 收录到所选项目库。
              </>
            ) : (
              "选择目标项目库与文件夹。"
            )}
          </DialogDescription>
        </DialogHeader>

        {librariesQuery.isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            加载项目库…
          </div>
        ) : libraries.length === 0 ? (
          <div className="py-4 text-sm">
            <p className="text-muted-foreground">尚无项目库，请先创建。</p>
            <Button variant="link" className="mt-2 h-auto p-0" asChild>
              <Link to="/libraries">前往项目库</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-library">项目库</Label>
              <select
                id="import-library"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={libraryId ?? ""}
                onChange={(e) => {
                  setLibraryId(Number(e.target.value))
                  setFolderId("none")
                }}
              >
                {libraries.map((lib) => (
                  <option key={lib.id} value={lib.id}>
                    {lib.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="import-folder">文件夹（可选）</Label>
              <FolderTreePicker
                id="import-folder"
                entries={folderOptions}
                value={folderId}
                onChange={setFolderId}
                disabled={libraryId == null || foldersQuery.isLoading}
                rootLabel="根目录"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={!repo || libraryId == null || libraries.length === 0 || importMutation.isPending}
            onClick={() => void importMutation.mutate()}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                导入中…
              </>
            ) : (
              "确认加入"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
