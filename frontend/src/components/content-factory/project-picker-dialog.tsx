import { useQuery } from "@tanstack/react-query"
import { Loader2, Search } from "lucide-react"
import { useMemo, useState } from "react"

import {
  filterLibraryTreeForPicker,
  ProjectTreePickerList,
} from "@/components/content-factory/project-tree-picker-list"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { plApiPath } from "@/lib/pl-api"
import type { LibraryTreeResponse } from "@/types/library"

async function fetchLibraryTree(libraryId: number): Promise<LibraryTreeResponse> {
  const res = await fetch(plApiPath(libraryId, "/library/tree"))
  if (!res.ok) {
    throw new Error(res.statusText)
  }
  return res.json() as Promise<LibraryTreeResponse>
}

export type ProjectPickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryId: number
  loading?: boolean
  onSelect: (projectId: number) => void
}

export function ProjectPickerDialog({
  open,
  onOpenChange,
  libraryId,
  loading = false,
  onSelect,
}: ProjectPickerDialogProps) {
  const [query, setQuery] = useState("")

  const treeQuery = useQuery({
    queryKey: ["library", libraryId, "tree", "picker"],
    queryFn: () => fetchLibraryTree(libraryId),
    enabled: open && Number.isFinite(libraryId),
  })

  const filtered = useMemo(() => {
    if (!treeQuery.data) {
      return { folders: [], orphans: [] }
    }
    return filterLibraryTreeForPicker(treeQuery.data, query)
  }, [treeQuery.data, query])

  const isEmpty =
    !treeQuery.isLoading &&
    filtered.folders.length === 0 &&
    filtered.orphans.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>选择推荐项目</DialogTitle>
          <DialogDescription>从当前资料库中选择一个 GitHub 项目开始创作。</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" aria-hidden />
          <Input
            className="pl-8"
            placeholder="搜索项目名、仓库或文件夹…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-[50vh] min-h-[200px] overflow-y-auto rounded-md border">
          {treeQuery.isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              加载项目…
            </div>
          ) : treeQuery.isError ? (
            <p className="text-destructive px-4 py-8 text-center text-sm">加载文件夹结构失败</p>
          ) : isEmpty ? (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">没有匹配的项目</p>
          ) : (
            <ProjectTreePickerList
              folders={filtered.folders}
              orphans={filtered.orphans}
              disabled={loading}
              onSelect={onSelect}
            />
          )}
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
