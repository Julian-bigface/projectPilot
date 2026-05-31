import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Sparkles } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { parseApiErrorMessage } from "@/lib/api-error"
import { invalidateProjectRelated } from "@/lib/invalidate-project-queries"
import { translateProject } from "@/lib/project-translate"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/project"

export type ProjectInlineDescriptionProps = {
  projectId: number
  description: string | null
  fallbackPlaceholder?: string
  variant?: "preview" | "detail"
  /** 区块标题（如「仓库简介」）；与 showTranslate 配合时在标题右侧显示翻译按钮 */
  sectionTitle?: string
  showTranslate?: boolean
  hideTitle?: boolean
  onSaved?: (project: Project) => void
}

export function ProjectInlineDescription({
  projectId,
  description,
  fallbackPlaceholder = "暂无简介。",
  variant = "preview",
  sectionTitle,
  showTranslate = false,
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
      value,
    }: {
      id: number
      value: string | null
      previousValue: string
    }) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: value }),
      })
      if (!res.ok) {
        throw new Error(await parseApiErrorMessage(res))
      }
      return res.json() as Promise<Project>
    },
    onSuccess: async (data, variables) => {
      toast.success("简介已更新")
      setDraftDesc(data.description ?? "")
      onSaved?.(data)
      await invalidateProjectRelated(queryClient, variables.id, data)
    },
    onError: (err, variables) => {
      toast.error((err as Error).message || "保存失败")
      setDraftDesc(variables.previousValue)
    },
  })

  const translateMutation = useMutation({
    mutationFn: () => translateProject(projectId, ["description"]),
    onSuccess: async (data) => {
      toast.success("简介已翻译")
      setDraftDesc(data.description ?? "")
      setDescEditing(false)
      onSaved?.(data)
      await invalidateProjectRelated(queryClient, projectId, data)
    },
    onError: (err: Error) => {
      toast.error(err.message || "翻译失败")
    },
  })

  // 仅随服务端 description / 切换项目同步；isPending 只作守卫，不列入 deps，避免翻译结束后用未刷新的 prop 盖掉译文
  useEffect(() => {
    if (descEditing || descMutation.isPending || translateMutation.isPending) {
      return
    }
    setDraftDesc(description ?? "")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 见上
  }, [description, projectId])

  const isDetail = variant === "detail"
  const showSectionHeader = Boolean(sectionTitle) && !hideTitle
  const canTranslate = Boolean(description?.trim())
  const translating = translateMutation.isPending
  const saving = descMutation.isPending

  const descriptionBody = (
    <div className="grid w-full [&_textarea]:col-start-1 [&_textarea]:row-start-1">
      {/* 隐形测量层：与 textarea 同格叠放，高度随简介文本变化；翻译时保留以稳定布局 */}
      <div
        aria-hidden
        className={cn(
          "invisible col-start-1 row-start-1 min-h-[1.5rem] w-full px-0 py-0 text-sm leading-relaxed break-words whitespace-pre-wrap",
          !descEditing && !draftDesc.trim() && "italic"
        )}
      >
        {measureText}
      </div>
      {translating ? (
        <Skeleton
          className="col-start-1 row-start-1 h-full min-h-[1.5rem] w-full rounded-md"
          aria-busy="true"
          aria-label="正在翻译简介"
        />
      ) : (
        <Textarea
          ref={descTextareaRef}
          id={`inline-desc-description-${projectId}`}
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
                  isDetail ? "text-muted-foreground bg-transparent" : "text-foreground bg-transparent"
                ),
            !descEditing && !draftDesc.trim() && "text-muted-foreground italic"
          )}
          onDoubleClick={() => {
            if (saving || translating) return
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
              value: trimmed === "" ? null : trimmed,
              previousValue: description ?? "",
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
      )}
    </div>
  )

  const content = (
    <>
      {showSectionHeader ? (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-foreground min-w-0 text-sm font-semibold tracking-tight">
            {sectionTitle}
          </h3>
          {showTranslate ? (
            <div className="flex shrink-0 items-center gap-1.5">
              {translating ? (
                <span className="text-muted-foreground text-xs whitespace-nowrap">正在翻译</span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground size-7 shrink-0"
                aria-label="翻译简介"
                title="翻译简介"
                disabled={!canTranslate || translating || saving}
                onClick={() => translateMutation.mutate()}
              >
                <Sparkles className="size-4" aria-hidden />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {descriptionBody}
      {saving && !descEditing ? (
        <p className="text-muted-foreground text-xs">保存中…</p>
      ) : null}
      {descMutation.isError ? (
        <p className="text-destructive text-sm">{(descMutation.error as Error).message || "保存失败"}</p>
      ) : null}
    </>
  )

  if (sectionTitle && variant === "preview") {
    return (
      <section className="space-y-2">
        <div className="text-muted-foreground text-sm leading-relaxed">{content}</div>
      </section>
    )
  }

  return <div className={cn("space-y-2", isDetail && "mt-2 max-w-3xl")}>{content}</div>
}
