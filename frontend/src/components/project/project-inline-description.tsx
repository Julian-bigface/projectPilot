import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Textarea } from "@/components/ui/textarea"
import { parseApiErrorMessage } from "@/lib/api-error"
import { invalidateProjectRelated } from "@/lib/invalidate-project-queries"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/project"

export type ProjectInlineDescriptionProps = {
  projectId: number
  description: string | null
  fallbackPlaceholder?: string
  variant?: "preview" | "detail"
  hideTitle?: boolean
  onSaved?: (project: Project) => void
}

export function ProjectInlineDescription({
  projectId,
  description,
  fallbackPlaceholder = "暂无简介。",
  variant = "preview",
  hideTitle = false,
  onSaved,
}: ProjectInlineDescriptionProps) {
  const queryClient = useQueryClient()
  const [descEditing, setDescEditing] = useState(false)
  const [draftDesc, setDraftDesc] = useState(description ?? "")
  const descTextareaRef = useRef<HTMLTextAreaElement>(null)
  const skipDescBlurSave = useRef(false)

  const measureText = useMemo(() => {
    if (draftDesc.trim()) {
      return draftDesc
    }
    if (!descEditing && fallbackPlaceholder.trim()) {
      return fallbackPlaceholder
    }
    return "\u00a0"
  }, [draftDesc, descEditing, fallbackPlaceholder])

  useEffect(() => {
    setDescEditing(false)
  }, [projectId])

  const descMutation = useMutation({
    mutationFn: async ({
      id,
      description: nextDescription,
    }: {
      id: number
      description: string | null
      previousDescription: string
    }) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: nextDescription }),
      })
      if (!res.ok) {
        throw new Error(await parseApiErrorMessage(res))
      }
      return res.json() as Promise<Project>
    },
    onSuccess: async (data, variables) => {
      toast.success("简介已更新")
      await invalidateProjectRelated(queryClient, variables.id)
      onSaved?.(data)
    },
    onError: (err, variables) => {
      toast.error((err as Error).message || "保存失败")
      setDraftDesc(variables.previousDescription)
    },
  })

  useEffect(() => {
    if (!descEditing && !descMutation.isPending) {
      setDraftDesc(description ?? "")
    }
  }, [descEditing, descMutation.isPending, description, projectId])

  const isDetail = variant === "detail"

  return (
    <div className={cn("space-y-2", isDetail && "mt-2 max-w-3xl")}>
      {isDetail && !hideTitle ? (
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">仓库简介</h3>
      ) : null}
      <div className="grid w-full [&_textarea]:col-start-1 [&_textarea]:row-start-1">
        <div
          aria-hidden
          className={cn(
            "invisible col-start-1 row-start-1 min-h-[1.5rem] w-full px-0 py-0 text-sm leading-relaxed break-words whitespace-pre-wrap",
            !descEditing && !draftDesc.trim() && "italic"
          )}
        >
          {measureText}
        </div>
        <Textarea
          ref={descTextareaRef}
          id={`inline-desc-${projectId}`}
          readOnly={!descEditing}
          value={draftDesc}
          onChange={(e) => setDraftDesc(e.target.value)}
          rows={1}
          spellCheck={false}
          title={descEditing ? undefined : "双击编辑"}
          placeholder={descEditing ? "简要描述该仓库…" : fallbackPlaceholder}
          className={cn(
            "col-start-1 row-start-1 h-full min-h-0 w-full resize-none overflow-hidden border-0 px-0 py-0 text-sm leading-relaxed whitespace-pre-wrap shadow-none transition-[box-shadow,background-color] [field-sizing:content]",
            "!min-h-0",
            descEditing
              ? "bg-muted/20 rounded-md ring-1 ring-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
              : cn(
                  "cursor-pointer ring-transparent hover:bg-muted/40 focus-visible:ring-0 focus-visible:ring-offset-0",
                  isDetail
                    ? "text-muted-foreground bg-transparent"
                    : "text-foreground bg-transparent"
                ),
            !descEditing && !draftDesc.trim() && "text-muted-foreground italic"
          )}
          onDoubleClick={() => {
            if (descMutation.isPending) return
            if (!descEditing) {
              descMutation.reset()
              setDescEditing(true)
            }
          }}
          onBlur={() => {
            if (skipDescBlurSave.current) {
              skipDescBlurSave.current = false
              return
            }
            if (!descEditing) return
            const trimmed = draftDesc.trim()
            const prev = (description ?? "").trim()
            if (trimmed === prev) {
              setDescEditing(false)
              return
            }
            descMutation.mutate({
              id: projectId,
              description: trimmed === "" ? null : trimmed,
              previousDescription: description ?? "",
            })
            setDescEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && descEditing) {
              e.preventDefault()
              skipDescBlurSave.current = true
              setDraftDesc(description ?? "")
              setDescEditing(false)
              descTextareaRef.current?.blur()
            }
          }}
        />
      </div>
      {descMutation.isPending && !descEditing ? (
        <p className="text-muted-foreground text-xs">保存中…</p>
      ) : null}
      {descMutation.isError ? (
        <p className="text-destructive text-sm">{(descMutation.error as Error).message || "保存失败"}</p>
      ) : null}
    </div>
  )
}
