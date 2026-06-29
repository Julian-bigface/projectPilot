import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Tags, Trash2, Wand2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { isScenarioReady } from "@/lib/ai-config-status"
import { fetchAiConfig } from "@/lib/settings-ai"
import {
  defaultSelected,
  formatTagPreview,
  groupProposals,
  proposalToEditable,
  proposalsToApplyItems,
  type EditableProposal,
  type TagSuggestionGroup,
} from "@/lib/tag-ai-suggest-groups"
import {
  postTagApplyCategorySuggestions,
  streamTagSuggestCategories,
} from "@/lib/tag-ai-suggest"
import type { TagCategory } from "@/types/tag"
import { cn } from "@/lib/utils"

export type TagAiSuggestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryPath: (suffix: string) => string
  categories: TagCategory[]
  uncategorizedCount: number
}

export function TagAiSuggestDialog({
  open,
  onOpenChange,
  libraryPath,
  categories,
  uncategorizedCount,
}: TagAiSuggestDialogProps) {
  const queryClient = useQueryClient()
  const cardsRef = useRef<HTMLDivElement>(null)
  const [includeNewCategories, setIncludeNewCategories] = useState(false)
  const [rows, setRows] = useState<EditableProposal[]>([])
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<Set<string>>(() => new Set())
  const [lastClickedGroupKey, setLastClickedGroupKey] = useState<string | null>(null)
  const [skippedIds, setSkippedIds] = useState<number[]>([])
  const [batches, setBatches] = useState(0)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestProgress, setSuggestProgress] = useState<{
    batchIndex: number
    totalBatches: number
    totalTags: number
    proposalCount: number
    activeBatch: number | null
  } | null>(null)
  const suggestAbortRef = useRef<AbortController | null>(null)

  const aiConfigQuery = useQuery({
    queryKey: ["settings", "ai", "config"],
    queryFn: fetchAiConfig,
    enabled: open,
  })

  const hasApiKey = aiConfigQuery.data
    ? isScenarioReady(aiConfigQuery.data, "tag_classification")
    : false

  const groups = useMemo(() => groupProposals(rows, categories), [rows, categories])
  const groupKeyOrder = useMemo(() => groups.map((g) => g.key), [groups])

  const resetState = useCallback(() => {
    setRows([])
    setSelectedGroupKeys(new Set())
    setLastClickedGroupKey(null)
    setSkippedIds([])
    setBatches(0)
    setIncludeNewCategories(false)
    setIsSuggesting(false)
    setSuggestProgress(null)
    suggestAbortRef.current?.abort()
    suggestAbortRef.current = null
  }, [])

  useEffect(() => {
    if (!open) {
      suggestAbortRef.current?.abort()
      suggestAbortRef.current = null
      resetState()
    }
  }, [open, resetState])

  useEffect(() => {
    if (!isSuggesting || groups.length === 0) return
    const el = cardsRef.current
    if (!el) return
    el.scrollTo({ left: el.scrollWidth, behavior: "smooth" })
  }, [groups.length, isSuggesting])

  const removeGroups = useCallback((keys: Iterable<string>) => {
    const keySet = new Set(keys)
    if (keySet.size === 0) return
    setRows((prev) => prev.filter((row) => !keySet.has(getRowGroupKey(row))))
    setSelectedGroupKeys((prev) => {
      const next = new Set(prev)
      for (const key of keySet) next.delete(key)
      return next
    })
  }, [])

  function getRowGroupKey(row: EditableProposal): string {
    if (row.selectedCategoryId != null) return `cat:${row.selectedCategoryId}`
    const newName = row.selectedNewCategoryName?.trim()
    if (newName) return `new:${newName.toLowerCase()}`
    return `unknown:${row.tag_id}`
  }

  const runSuggestStream = useCallback(async () => {
    suggestAbortRef.current?.abort()
    const controller = new AbortController()
    suggestAbortRef.current = controller

    setRows([])
    setSelectedGroupKeys(new Set())
    setLastClickedGroupKey(null)
    setSkippedIds([])
    setBatches(0)
    setSuggestProgress(null)
    setIsSuggesting(true)

    try {
      await streamTagSuggestCategories(
        libraryPath,
        { include_new_categories: includeNewCategories },
        {
          signal: controller.signal,
          onEvent: (event) => {
            if (event.event === "start") {
              setSuggestProgress({
                batchIndex: 0,
                totalBatches: event.total_batches,
                totalTags: event.total_tags,
                proposalCount: 0,
                activeBatch: null,
              })
              return
            }
            if (event.event === "batch_start") {
              setSuggestProgress((prev) => ({
                batchIndex: prev?.batchIndex ?? 0,
                totalBatches: event.total_batches,
                totalTags: prev?.totalTags ?? 0,
                proposalCount: prev?.proposalCount ?? 0,
                activeBatch: event.batch_index,
              }))
              return
            }
            if (event.event === "batch") {
              const editable = event.proposals.map(proposalToEditable)
              setRows((prev) => [...prev, ...editable])
              setSuggestProgress((prev) => ({
                batchIndex: event.batch_index,
                totalBatches: event.total_batches,
                totalTags: prev?.totalTags ?? 0,
                proposalCount: (prev?.proposalCount ?? 0) + event.proposals.length,
                activeBatch: null,
              }))
              return
            }
            if (event.event === "error") {
              toast.error(event.detail || "AI 建议失败")
              return
            }
            if (event.event === "done") {
              setSkippedIds(event.skipped_tag_ids)
              setBatches(event.batches)
              setSuggestProgress((prev) =>
                prev
                  ? {
                      ...prev,
                      batchIndex: event.batches,
                      proposalCount: event.proposal_count,
                      activeBatch: null,
                    }
                  : null
              )
              if (event.proposal_count === 0 && event.skipped_tag_ids.length === 0) {
                toast.info("没有需要整理的未分类标签")
              } else if (event.proposal_count === 0) {
                toast.warning("AI 未能生成建议，请稍后重试或检查分类设置")
              }
            }
          },
        }
      )
    } catch (err) {
      if (controller.signal.aborted) return
      toast.error(err instanceof Error ? err.message : "AI 建议失败")
    } finally {
      if (suggestAbortRef.current === controller) {
        suggestAbortRef.current = null
      }
      setIsSuggesting(false)
    }
  }, [includeNewCategories, libraryPath])

  const applyMutation = useMutation({
    mutationFn: (targetRows: EditableProposal[]) =>
      postTagApplyCategorySuggestions(libraryPath, proposalsToApplyItems(targetRows)),
    onSuccess: async (data, targetRows) => {
      await queryClient.invalidateQueries({ queryKey: ["tags"] })
      await queryClient.invalidateQueries({ queryKey: ["tag-categories"] })
      const appliedKeys = new Set(targetRows.map((r) => getRowGroupKey(r)))
      setRows((prev) => prev.filter((r) => !appliedKeys.has(getRowGroupKey(r))))
      setSelectedGroupKeys((prev) => {
        const next = new Set(prev)
        for (const key of appliedKeys) next.delete(key)
        return next
      })
      const msg = `已应用 ${data.applied} 个标签${
        data.categories_created > 0 ? `，新建 ${data.categories_created} 个分类` : ""
      }${data.skipped > 0 ? `；跳过 ${data.skipped} 个` : ""}`
      toast.success(msg)
      if (data.errors.length > 0) {
        toast.error(data.errors.slice(0, 3).join("；"))
      }
    },
    onError: (err: Error) => toast.error(err.message || "应用失败"),
  })

  const handleOpenSuggest = () => {
    if (!hasApiKey) {
      toast.error("请先在 AI 工作室配置 API Key", {
        action: {
          label: "去配置",
          onClick: () => {
            window.location.href = "/settings/ai"
          },
        },
      })
      return
    }
    runSuggestStream()
  }

  const handleGroupClick = (group: TagSuggestionGroup, event: React.MouseEvent) => {
    const { key } = group
    if (event.shiftKey && lastClickedGroupKey) {
      const start = groupKeyOrder.indexOf(lastClickedGroupKey)
      const end = groupKeyOrder.indexOf(key)
      if (start >= 0 && end >= 0) {
        const [from, to] = start < end ? [start, end] : [end, start]
        const rangeKeys = groupKeyOrder.slice(from, to + 1)
        setSelectedGroupKeys((prev) => {
          const next = event.ctrlKey || event.metaKey ? new Set(prev) : new Set<string>()
          for (const k of rangeKeys) next.add(k)
          return next
        })
        setLastClickedGroupKey(key)
        return
      }
    }

    if (event.ctrlKey || event.metaKey) {
      setSelectedGroupKeys((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
      setLastClickedGroupKey(key)
      return
    }

    setSelectedGroupKeys(new Set([key]))
    setLastClickedGroupKey(key)
  }

  const acceptGroup = (group: TagSuggestionGroup) => {
    if (group.tags.length === 0) return
    applyMutation.mutate(group.tags)
  }

  const acceptAllGroups = () => {
    if (rows.length === 0) return
    applyMutation.mutate(rows)
  }

  const deleteSelectedGroups = useCallback(() => {
    if (selectedGroupKeys.size === 0) return
    removeGroups(selectedGroupKeys)
    setLastClickedGroupKey(null)
  }, [removeGroups, selectedGroupKeys])

  useEffect(() => {
    if (!open || groups.length === 0) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return
      const target = e.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return
      }
      if (selectedGroupKeys.size === 0) return
      e.preventDefault()
      deleteSelectedGroups()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [deleteSelectedGroups, groups.length, open, selectedGroupKeys.size])

  const showPreview = rows.length > 0 || skippedIds.length > 0 || isSuggesting
  const progressPercent =
    suggestProgress && suggestProgress.totalBatches > 0
      ? Math.round(
          ((suggestProgress.batchIndex +
            (suggestProgress.activeBatch != null &&
            suggestProgress.activeBatch > suggestProgress.batchIndex
              ? 0.4
              : 0)) /
            suggestProgress.totalBatches) *
            100
        )
      : 0
  const displayBatchIndex =
    suggestProgress?.activeBatch ?? suggestProgress?.batchIndex ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,860px)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-border space-y-2 border-b px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="text-primary size-5" aria-hidden />
            AI 整理未分类标签
          </DialogTitle>
          <DialogDescription>
            当前库约有 {uncategorizedCount} 个未分类标签。AI 按粗粒度领域分组推荐，需您确认后才会写入。
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {!hasApiKey && !aiConfigQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">
              尚未配置 AI API Key。请前往{" "}
              <Link to="/settings/ai" className="text-primary underline-offset-4 hover:underline">
                AI 工作室
              </Link>{" "}
              保存 Key 后再试。
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={includeNewCategories}
                onCheckedChange={(v) => setIncludeNewCategories(v === true)}
                disabled={isSuggesting}
              />
              允许建议新建分类（粗粒度，如 AI、前端）
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!hasApiKey || isSuggesting || aiConfigQuery.isLoading}
              onClick={handleOpenSuggest}
            >
              {isSuggesting ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <Wand2 className="mr-2 size-4" aria-hidden />
              )}
              {showPreview && !isSuggesting ? "重新生成建议" : "生成建议"}
            </Button>
            {batches > 0 ? (
              <span className="text-muted-foreground text-xs">共 {batches} 批请求</span>
            ) : suggestProgress && suggestProgress.totalBatches > 0 ? (
              <span className="text-muted-foreground text-xs">
                第 {displayBatchIndex}/{suggestProgress.totalBatches} 批
                {suggestProgress.activeBatch != null ? " · 请求中" : ""}
              </span>
            ) : null}
          </div>

          {isSuggesting && suggestProgress ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {suggestProgress.activeBatch != null
                    ? `正在请求 AI 分析第 ${suggestProgress.activeBatch}/${suggestProgress.totalBatches} 批…`
                    : `正在分析 ${suggestProgress.totalTags} 个标签…`}
                  {suggestProgress.proposalCount > 0
                    ? ` 已生成 ${suggestProgress.proposalCount} 条建议`
                    : ""}
                </span>
                <span className="text-muted-foreground tabular-nums">{progressPercent}%</span>
              </div>
              <div
                className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.max(progressPercent, suggestProgress.batchIndex > 0 ? 8 : 4)}%` }}
                />
              </div>
            </div>
          ) : null}

          {skippedIds.length > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-200">
              {skippedIds.length} 个标签未能获得有效建议（可稍后重试）。
            </p>
          ) : null}

          {showPreview && groups.length > 0 ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-medium">
                      <Tags className="size-4" aria-hidden />
                      AI 智能推荐
                      {isSuggesting ? (
                        <Loader2 className="text-muted-foreground size-3.5 animate-spin" aria-hidden />
                      ) : null}
                    </h3>
                    <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                      Beta
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    相同推荐分类的标签已聚合。点击卡片选择；按住 Ctrl 多选、Shift 范围选；Delete 删除选中块。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedGroupKeys.size > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={deleteSelectedGroups}
                    >
                      <Trash2 className="mr-1.5 size-3.5" aria-hidden />
                      删除选中（{selectedGroupKeys.size}）
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={applyMutation.isPending || rows.length === 0 || isSuggesting}
                    onClick={acceptAllGroups}
                  >
                    一键接受全部推荐
                  </Button>
                </div>
              </div>

              <div
                ref={cardsRef}
                className="flex gap-3 overflow-x-auto pb-2"
                role="listbox"
                aria-label="AI 推荐分类块"
                aria-multiselectable="true"
              >
                {groups.map((group) => {
                  const selected = selectedGroupKeys.has(group.key)
                  const preview = formatTagPreview(group.tags)
                  const highConfidence = group.tags.every((t) => defaultSelected(t.confidence))

                  return (
                    <div
                      key={group.key}
                      role="option"
                      aria-selected={selected}
                      tabIndex={0}
                      onClick={(e) => handleGroupClick(group, e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleGroupClick(group, e as unknown as React.MouseEvent)
                        }
                      }}
                      className={cn(
                        "border-border bg-card/60 hover:bg-muted/30 flex min-w-[240px] max-w-[280px] shrink-0 cursor-pointer flex-col rounded-xl border p-4 shadow-sm transition-colors",
                        selected && "border-primary ring-primary/30 ring-2",
                        !highConfidence && "border-amber-500/30"
                      )}
                    >
                      <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                        {preview}
                      </p>
                      <p className="mt-3 text-sm">
                        推荐分类：
                        <span className="text-primary font-medium">{group.displayName}</span>
                      </p>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                        <span className="text-muted-foreground text-[11px]">
                          {group.tags.length} 个标签
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 px-2.5 text-xs"
                          disabled={applyMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation()
                            acceptGroup(group)
                          }}
                        >
                          {applyMutation.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            "接受"
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ) : showPreview && rows.length === 0 && !isSuggesting ? (
            <p className="text-muted-foreground text-sm">所有推荐块已处理完毕。</p>
          ) : isSuggesting && groups.length === 0 ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {suggestProgress?.activeBatch
                ? `正在等待第 ${suggestProgress.activeBatch} 批 AI 返回（约 25 个标签）…`
                : "正在连接 AI 服务…"}
            </p>
          ) : null}

          {showPreview && groups.length > 0 ? (
            <details className="text-muted-foreground text-xs">
              <summary className="hover:text-foreground cursor-pointer select-none">
                查看逐条明细（{rows.length}）
              </summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto rounded-md border p-3">
                {rows.map((row) => (
                  <li key={row.tag_id}>
                    {row.tag_name} →{" "}
                    {row.selectedCategoryId != null
                      ? categories.find((c) => c.id === row.selectedCategoryId)?.name
                      : row.selectedNewCategoryName ?? "—"}
                    <span className="ml-2 opacity-70">({row.confidence})</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        <DialogFooter className="border-border border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          {selectedGroupKeys.size > 0 ? (
            <Button type="button" variant="outline" onClick={deleteSelectedGroups}>
              删除选中块
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
