import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
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
import { importFolderBundle, parseFolderBundleFileText } from "@/lib/folder-bundle"
import type { FolderBundle, FolderBundleImportResult } from "@/types/folder-bundle"

export type ImportFolderBundleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryId: number
  targetParentFolderId: number | null
  targetLabel: string
  /** 拖放预填的包；无则打开后需选择文件 */
  initialBundle?: FolderBundle | null
  onImported?: (result: FolderBundleImportResult) => void
}

export function ImportFolderBundleDialog({
  open,
  onOpenChange,
  libraryId,
  targetParentFolderId,
  targetLabel,
  initialBundle = null,
  onImported,
}: ImportFolderBundleDialogProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [bundle, setBundle] = useState<FolderBundle | null>(initialBundle)
  const [skipDuplicate, setSkipDuplicate] = useState(false)
  const [fileLabel, setFileLabel] = useState<string | null>(
    initialBundle ? initialBundle.source.root_folder_name : null
  )

  useEffect(() => {
    if (open) {
      setBundle(initialBundle ?? null)
      setFileLabel(initialBundle ? initialBundle.source.root_folder_name : null)
      setSkipDuplicate(false)
    }
  }, [open, initialBundle])

  const importMutation = useMutation({
    mutationFn: () => {
      if (!bundle) {
        throw new Error("请先选择 .ppb.json 文件")
      }
      return importFolderBundle(libraryId, targetParentFolderId, bundle, {
        skipDuplicateGithubUrl: skipDuplicate,
      })
    },
    onSuccess: (result) => {
      const parts = [
        `文件夹 ${result.created_folders} 个`,
        `项目 ${result.created_projects} 个`,
      ]
      if (result.skipped_projects > 0) {
        parts.push(`跳过 ${result.skipped_projects} 个`)
      }
      toast.success(`导入完成：${parts.join("，")}`)
      if (result.errors.length > 0) {
        toast.warning(result.errors.join("；"))
      }
      void queryClient.invalidateQueries({ queryKey: ["library", libraryId] })
      void queryClient.invalidateQueries({ queryKey: ["folders"] })
      onImported?.(result)
      onOpenChange(false)
    },
    onError: (e: Error) => {
      toast.error(e.message || "导入失败")
    },
  })

  const onPickFile = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = parseFolderBundleFileText(text)
      setBundle(parsed)
      setFileLabel(file.name)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "无法读取文件")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导入文件夹包</DialogTitle>
          <DialogDescription>
            将便携包导入到「{targetLabel}」下；包内根文件夹会作为该落点的新子节点。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="text-sm">
            <span className="text-muted-foreground">导入落点：</span>
            <span className="font-medium">{targetLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              选择文件…
            </Button>
            {fileLabel ? (
              <span className="text-muted-foreground truncate text-xs">{fileLabel}</span>
            ) : (
              <span className="text-muted-foreground text-xs">未选择文件</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.ppb.json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  void onPickFile(f)
                }
                e.target.value = ""
              }}
            />
          </div>
          {bundle ? (
            <p className="text-muted-foreground text-xs">
              包内：{bundle.folders.length} 个文件夹，{bundle.projects.length} 个项目
              {bundle.source?.root_folder_name
                ? `（来源：${bundle.source.root_folder_name}）`
                : null}
            </p>
          ) : null}
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={skipDuplicate}
              onChange={(e) => setSkipDuplicate(e.target.checked)}
            />
            <span>已存在相同 GitHub 链接时跳过（默认会新建项目）</span>
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={!bundle || importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending ? "导入中…" : "导入"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
