import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, Folder, Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { FolderDomainTagsDialog } from "@/components/library/folder-domain-tags-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { usePlApi } from "@/hooks/use-pl-api"
import { findFolderNode, countProjectsInSubtree } from "@/lib/library-tree"
import { domainTagPillClass } from "@/lib/topic-pill-palette"
import { cn } from "@/lib/utils"
import type { FolderRow, LibraryTreeResponse } from "@/types/library"

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

function formatFolderCreated(iso: string | undefined): string {
  if (!iso?.trim()) {
    return "—"
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

type LibraryFolderInfoPanelProps = {
  folderId: number
}

export function LibraryFolderInfoPanel({ folderId }: LibraryFolderInfoPanelProps) {
  const queryClient = useQueryClient()
  const plApi = usePlApi()
  const [metaOpen, setMetaOpen] = useState(true)
  const [draftName, setDraftName] = useState("")
  const [draftDescription, setDraftDescription] = useState("")
  const [tagDialogOpen, setTagDialogOpen] = useState(false)

  const treeQuery = useQuery({
    queryKey: ["library", plApi.libraryId, "tree"],
    queryFn: async (): Promise<LibraryTreeResponse> => {
      const res = await fetch(plApi.path("/library/tree"))
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<LibraryTreeResponse>
    },
  })

  const foldersFlatQuery = useQuery({
    queryKey: ["folders", plApi.libraryId, "flat"],
    queryFn: async (): Promise<FolderRow[]> => {
      const res = await fetch(plApi.path("/folders"))
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<FolderRow[]>
    },
  })

  const tree = treeQuery.data
  const node = tree ? findFolderNode(tree.folders, folderId) : null
  const folderRow = useMemo(
    () => foldersFlatQuery.data?.find((r) => r.id === folderId),
    [foldersFlatQuery.data, folderId],
  )

  const folderTags = folderRow?.tags ?? []
  const initialTagIds = useMemo(() => folderTags.map((t) => t.id), [folderTags])
  const tagIdsKey = useMemo(
    () => [...initialTagIds].sort((a, b) => a - b).join(","),
    [initialTagIds],
  )

  useEffect(() => {
    setDraftName(node?.name?.trim() ?? "")
  }, [node?.name, folderId])

  useEffect(() => {
    setDraftDescription(folderRow?.description ?? "")
  }, [folderRow?.description, folderId])

  const patchFolderMutation = useMutation({
    mutationFn: async (body: {
      id: number
      name?: string
      description?: string | null
    }) => {
      const payload: { name?: string; description?: string | null } = {}
      if (body.name !== undefined) {
        payload.name = body.name
      }
      if (body.description !== undefined) {
        payload.description = body.description
      }
      const res = await fetch(plApi.path(`/folders/${body.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<FolderRow>
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["library", plApi.libraryId, "tree"] })
      await queryClient.invalidateQueries({ queryKey: ["folders", plApi.libraryId, "flat"] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "更新失败")
    },
  })

  const projectCount = node ? countProjectsInSubtree(node) : null
  const loading = treeQuery.isLoading || foldersFlatQuery.isLoading
  const treeError = treeQuery.isError ? (treeQuery.error as Error)?.message : null

  const commitName = () => {
    if (!node) {
      return
    }
    const next = draftName.trim()
    if (next === "" || next === node.name.trim()) {
      setDraftName(node.name.trim())
      return
    }
    patchFolderMutation.mutate(
      { id: folderId, name: next },
      {
        onSuccess: () => toast.success("文件夹名称已更新"),
      },
    )
  }

  const commitDescription = () => {
    const prev = (folderRow?.description ?? "").trim()
    const next = draftDescription.trim()
    if (next === prev) {
      return
    }
    patchFolderMutation.mutate(
      { id: folderId, description: next === "" ? null : next },
      {
        onSuccess: () => toast.success("文件夹描述已更新"),
      },
    )
  }

  if (treeError) {
    return (
      <div className="text-destructive p-3 text-sm">
        <p>{treeError}</p>
      </div>
    )
  }

  if (!loading && !node) {
    return (
      <div className="text-muted-foreground p-3 text-sm">
        <p>未找到该文件夹（可能已被删除）。</p>
      </div>
    )
  }

  return (
    <>
      <FolderDomainTagsDialog
        folderId={folderId}
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        initialTagIds={initialTagIds}
        tagIdsKey={tagIdsKey}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <div className="bg-muted/40 flex aspect-[4/3] max-h-36 items-center justify-center rounded-lg border border-dashed">
          <Folder className="text-muted-foreground size-14 stroke-[1.25]" aria-hidden />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`folder-name-${folderId}`} className="text-xs">
            名称
          </Label>
          <Input
            id={`folder-name-${folderId}`}
            value={draftName}
            disabled={!node || patchFolderMutation.isPending}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => commitName()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            className="text-sm"
            placeholder={loading ? "加载中…" : "文件夹名称"}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`folder-desc-${folderId}`} className="text-xs">
            描述
          </Label>
          <Textarea
            id={`folder-desc-${folderId}`}
            value={draftDescription}
            disabled={!folderRow || patchFolderMutation.isPending}
            onChange={(e) => setDraftDescription(e.target.value)}
            onBlur={() => commitDescription()}
            rows={4}
            placeholder="添加文件夹描述…"
            className="resize-y text-sm"
          />
        </div>

        <div className="grid gap-2">
          <Label className="text-xs">标签</Label>
          <div className="group/labels flex flex-wrap items-center gap-1.5">
            {folderTags.length === 0 ? (
              <p className="text-muted-foreground text-sm">暂无标签。</p>
            ) : (
              folderTags.map((t) => (
                <span key={t.id} className={domainTagPillClass(t.id)}>
                  <span className="truncate">{t.name}</span>
                </span>
              ))
            )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="text-muted-foreground size-6 shrink-0 opacity-0 transition-opacity group-hover/labels:opacity-100 focus-visible:opacity-100"
                      aria-label="管理标签"
                      title="管理标签"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        setTagDialogOpen(true)
                      }}
                    >
              <Plus className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="border-border rounded-md border">
          <Button
            type="button"
            variant="ghost"
            className="text-foreground hover:bg-muted/50 flex h-10 w-full items-center justify-between rounded-none px-3 text-sm font-medium"
            onClick={() => setMetaOpen((o) => !o)}
            aria-expanded={metaOpen}
          >
            <span>文件夹信息</span>
            <ChevronDown
              className={cn("text-muted-foreground size-4 shrink-0 transition-transform", metaOpen && "rotate-180")}
              aria-hidden
            />
          </Button>
          {metaOpen ? (
            <div className="border-border space-y-0 border-t px-3 py-2 text-sm">
              <div className="text-muted-foreground flex items-center justify-between gap-3 py-1.5">
                <span>文件数量</span>
                <span className="text-foreground tabular-nums">
                  {projectCount === null ? (loading ? "…" : "—") : projectCount.toLocaleString("zh-CN")}
                </span>
              </div>
              <div className="text-muted-foreground flex items-start justify-between gap-3 py-1.5">
                <span className="shrink-0">文件大小</span>
                <span className="text-foreground min-w-0 text-right">
                  <span className="tabular-nums">—</span>
                  <span className="text-muted-foreground mt-0.5 block text-xs font-normal">未统计</span>
                </span>
              </div>
              <div className="text-muted-foreground flex items-center justify-between gap-3 py-1.5">
                <span>创建时间</span>
                <span className="text-foreground text-right text-xs leading-snug">
                  {formatFolderCreated(folderRow?.created_at)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
