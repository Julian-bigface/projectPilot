import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { parseApiErrorMessage } from "@/lib/api-error"
import { invalidateProjectRelated } from "@/lib/invalidate-project-queries"
import type { Project } from "@/types/project"

export type ProjectNotesTabProps = {
  projectId: number
  initialNotes: string | null
}

export function ProjectNotesTab({ projectId, initialNotes }: ProjectNotesTabProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(initialNotes ?? "")
  const [dirty, setDirty] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(initialNotes ?? "")
    setDirty(false)
    setSaveError(null)
  }, [initialNotes, projectId])

  const saveMutation = useMutation({
    mutationFn: async (notes: string): Promise<Project> => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() || null }),
      })
      if (!res.ok) {
        throw new Error(await parseApiErrorMessage(res))
      }
      return res.json() as Promise<Project>
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(["projects", "detail", projectId], data)
      await invalidateProjectRelated(queryClient, projectId)
      setDraft(data.notes ?? "")
      setDirty(false)
      setSaveError(null)
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : "保存失败")
    },
  })

  const handleSave = useCallback(() => {
    saveMutation.mutate(draft)
  }, [draft, saveMutation])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        if (dirty && !saveMutation.isPending) {
          handleSave()
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [dirty, handleSave, saveMutation.isPending])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault()
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  return (
    <div className="flex min-h-[280px] flex-col">
      <p className="text-muted-foreground mb-3 text-sm">
        记录体验笔记、部署踩坑、是否值得归档等（仅保存在 Pilot，不会同步到 GitHub）。
      </p>
      <Textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          setDirty(true)
          setSaveError(null)
        }}
        placeholder="开始记录你的想法…"
        className="min-h-[240px] flex-1 resize-y text-sm leading-relaxed"
        spellCheck
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {dirty ? "有未保存的更改" : "已保存"}
          <span className="hidden sm:inline"> · Ctrl+S 保存</span>
        </p>
        <div className="flex items-center gap-2">
          {saveError ? <p className="text-destructive text-xs">{saveError}</p> : null}
          <Button
            type="button"
            size="sm"
            disabled={!dirty || saveMutation.isPending}
            onClick={handleSave}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                保存中…
              </>
            ) : (
              "保存"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
