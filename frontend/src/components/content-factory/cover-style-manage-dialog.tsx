import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowUpToLine,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Wand2,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"

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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { CoverStyleAiRefineButton } from "@/components/content-factory/cover-style-ai-refine-button"
import { CoverStyleRevisionRail } from "@/components/content-factory/cover-style-revision-rail"
import { CoverStyleDesignAnalysisEditor } from "@/components/content-factory/cover-style-design-analysis-editor"
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
import { useAutoScrollbarVisible } from "@/hooks/use-auto-scrollbar-visible"
import { useCoverStyleDisplayOrder } from "@/hooks/use-cover-style-display-order"
import {
  createContentFactoryCoverStyle,
  createContentFactoryCoverStyleRevision,
  deleteContentFactoryCoverStyle,
  deleteContentFactoryCoverStyleRevision,
  fetchContentFactoryCoverStyleRevision,
  fetchContentFactoryCoverStyleRevisions,
  fetchContentFactoryCoverStyles,
  forkContentFactoryCoverStyle,
  patchContentFactoryCoverStyle,
  previewContentFactoryCoverStyle,
  refineContentFactoryCoverStyle,
  saveParsedContentFactoryCoverStyle,
  streamContentFactoryCoverStyleGenerate,
  uploadCoverStyleReference,
} from "@/lib/content-factory-api"
import { normalizeCoverStyleDesignAnalysis } from "@/lib/cover-style-design-analysis"
import { joinPromptCapsules, splitPromptCapsules } from "@/lib/prompt-capsules"
import { fetchAiConfig } from "@/lib/settings-ai"
import {
  isRecommendCoverStyleReady,
  isRecommendCoverStyleVisionReady,
  getRecommendCoverStyleBinding,
  isRecommendImageReady,
} from "@/lib/recommend-image-ready"
import { cn } from "@/lib/utils"
import { topicPillClass } from "@/lib/topic-pill-palette"
import type {
  ContentFactoryCoverStyle,
  CoverStyleDesignAnalysis,
  CoverStyleRevisionSummary,
} from "@/types/content-factory"

const PROMPT_FIELDS = ["prompt_prefix", "prompt_template", "negative_prompt"] as const
type PromptField = (typeof PROMPT_FIELDS)[number]

/** 详情与 AI 解析区展示顺序：模板在上，前缀与负向为胶囊 */
const PROMPT_FIELD_ORDER: PromptField[] = ["prompt_template", "prompt_prefix", "negative_prompt"]
const CAPSULE_PROMPT_FIELDS = new Set<PromptField>(["prompt_prefix", "negative_prompt"])

const PROMPT_FIELD_LABELS: Record<PromptField, string> = {
  prompt_prefix: "画面前缀",
  prompt_template: "提示词模板",
  negative_prompt: "负向提示词",
}

function coverStyleDraftDiffersFromSaved(
  saved: ContentFactoryCoverStyle,
  draft: Partial<ContentFactoryCoverStyle> | undefined
): boolean {
  if (!draft) {
    return false
  }
  if (draft.label !== undefined && draft.label !== saved.label) {
    return true
  }
  if (draft.prompt_prefix !== undefined && draft.prompt_prefix !== saved.prompt_prefix) {
    return true
  }
  if (draft.prompt_template !== undefined && draft.prompt_template !== saved.prompt_template) {
    return true
  }
  if (draft.negative_prompt !== undefined && draft.negative_prompt !== saved.negative_prompt) {
    return true
  }
  if (
    draft.style_report !== undefined &&
    (draft.style_report ?? "") !== (saved.style_report ?? "")
  ) {
    return true
  }
  if (draft.design_analysis !== undefined) {
    const left = JSON.stringify(normalizeCoverStyleDesignAnalysis(draft.design_analysis))
    const right = JSON.stringify(normalizeCoverStyleDesignAnalysis(saved.design_analysis))
    if (left !== right) {
      return true
    }
  }
  if (
    draft.color_tokens !== undefined &&
    JSON.stringify(draft.color_tokens) !== JSON.stringify(saved.color_tokens)
  ) {
    return true
  }
  if (
    draft.font_tokens !== undefined &&
    JSON.stringify(draft.font_tokens) !== JSON.stringify(saved.font_tokens)
  ) {
    return true
  }
  return false
}

function revisionDraftFromRead(
  rev: Awaited<ReturnType<typeof fetchContentFactoryCoverStyleRevision>>
): Partial<ContentFactoryCoverStyle> {
  return {
    prompt_prefix: rev.prompt_prefix,
    prompt_template: rev.prompt_template,
    negative_prompt: rev.negative_prompt,
    style_report: rev.style_report ?? undefined,
    design_analysis: rev.design_analysis ?? undefined,
    color_tokens: rev.color_tokens,
    font_tokens: rev.font_tokens,
  }
}

function draftFromSavedStyle(style: ContentFactoryCoverStyle): Partial<ContentFactoryCoverStyle> {
  return {
    label: style.label,
    prompt_prefix: style.prompt_prefix,
    prompt_template: style.prompt_template,
    negative_prompt: style.negative_prompt,
    style_report: style.style_report,
    design_analysis: style.design_analysis,
    color_tokens: style.color_tokens,
    font_tokens: style.font_tokens,
  }
}

function nearestRevisionAfterDelete(
  revisions: CoverStyleRevisionSummary[],
  deletedId: number
): CoverStyleRevisionSummary | null {
  return (
    revisions
      .filter((r) => r.id !== deletedId)
      .sort((a, b) => b.revision_index - a.revision_index)[0] ?? null
  )
}

function promptCapsulePillClass(index: number): string {
  return cn(
    "group/capsule inline-flex max-w-full min-w-0 items-center rounded-full py-px pr-0.5 pl-2 text-[11px] font-medium leading-none",
    topicPillClass(index)
  )
}

function PromptCapsuleField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [addDraft, setAddDraft] = useState("")
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const segments = useMemo(() => splitPromptCapsules(value), [value])

  const commitSegments = (next: string[]) => {
    onChange(joinPromptCapsules(next))
  }

  const handleAdd = () => {
    const text = addDraft.trim()
    if (!text) return
    commitSegments([...segments, text])
    setAddDraft("")
  }

  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {segments.length === 0 ? (
          <span className="text-muted-foreground text-[11px]">暂无条目</span>
        ) : null}
        {segments.map((segment, index) => (
          <span key={`${index}-${segment.slice(0, 16)}`} className={promptCapsulePillClass(index)}>
            {editingIndex === index ? (
              <input
                className="min-w-[2ch] max-w-[min(100%,240px)] border-0 bg-transparent p-0 font-medium outline-none"
                value={segment}
                autoFocus
                size={Math.max(segment.length, 2)}
                aria-label={`${label} ${index + 1}`}
                onChange={(e) => {
                  const next = [...segments]
                  next[index] = e.target.value
                  commitSegments(next)
                }}
                onBlur={() => setEditingIndex(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    setEditingIndex(null)
                  }
                  if (e.key === "Escape") {
                    e.preventDefault()
                    setEditingIndex(null)
                  }
                }}
              />
            ) : (
              <span
                className="max-w-[240px] truncate"
                title={segment}
                onDoubleClick={() => setEditingIndex(index)}
              >
                {segment}
              </span>
            )}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground ml-0.5 shrink-0 rounded-full p-0.5 opacity-0 transition-opacity group-hover/capsule:opacity-100 focus-visible:opacity-100"
              onClick={() => {
                commitSegments(segments.filter((_, i) => i !== index))
                if (editingIndex === index) setEditingIndex(null)
              }}
              aria-label={`移除${label} ${index + 1}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          className="placeholder:text-muted-foreground h-5 min-w-[8ch] max-w-full border-0 bg-transparent px-1 text-[11px] outline-none"
          placeholder="输入后回车添加"
          value={addDraft}
          onChange={(e) => setAddDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleAdd()
            }
          }}
          onBlur={() => {
            if (addDraft.trim()) handleAdd()
          }}
        />
      </div>
    </div>
  )
}

function renderPromptField(
  field: PromptField,
  value: string,
  onChange: (value: string) => void,
  fieldKey?: string
) {
  const label = PROMPT_FIELD_LABELS[field]
  const key = fieldKey ?? field
  if (CAPSULE_PROMPT_FIELDS.has(field)) {
    return (
      <PromptCapsuleField key={key} label={label} value={value} onChange={onChange} />
    )
  }
  return (
    <div key={key}>
      <Label className="text-sm font-medium">{label}</Label>
      <Textarea
        className={STYLE_DETAIL_TEXTAREA_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

type AiParseDraft = {
  name: string
  style_report: string
  design_analysis: CoverStyleDesignAnalysis | null
  prompt_prefix: string
  prompt_template: string
  negative_prompt: string
}

const STYLE_DETAIL_TEXTAREA_CLASS =
  "mt-1.5 min-h-[126px] resize-none rounded-md border border-border/50 bg-background px-3 py-2 font-mono text-xs shadow-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0"

const STYLE_LIBRARY_DIALOG_CLASS =
  "flex h-[min(calc(70vh*1.25),630px)] max-h-[min(calc(92vh*1.25),968px)] w-[min(96vw,72rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0"

function sourceLabel(source: ContentFactoryCoverStyle["source"]): string {
  switch (source) {
    case "builtin":
      return "内置"
    case "ai_generated":
      return "AI"
    case "manual":
      return "手工"
    default:
      return source
  }
}

const DEFAULT_MANUAL_FORM = {
  label: "",
  prompt_prefix:
    "1242x1660, 3:4 vertical portrait cover, strict margins, premium social poster aesthetic.",
  prompt_template:
    "主视觉：{project_name} 开源项目推广，简介 {project_description}。" +
    "主标题「{headline}」；副文案「{cover_texts}」；标签 {highlight_tags}；" +
    "语言 {project_language}；Star {project_stars}。",
  negative_prompt:
    "cheap gradient, garbled text, watermark, cluttered layout, low resolution",
}

export function CoverStyleManageDialog({
  open,
  onOpenChange,
  libraryId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryId: number
}) {
  const queryClient = useQueryClient()
  const [mainTab, setMainTab] = useState<"list" | "create">("list")
  const [createTab, setCreateTab] = useState<"ai" | "manual" | "fork">("ai")
  const [detailStyleId, setDetailStyleId] = useState<string | null>(null)
  const [detailImageView, setDetailImageView] = useState<"reference" | "example">("example")
  const [referenceId, setReferenceId] = useState<string | null>(null)
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(null)
  const [aiParseDraft, setAiParseDraft] = useState<AiParseDraft | null>(null)
  const [isAiParsing, setIsAiParsing] = useState(false)
  const aiParseAbortRef = useRef<AbortController | null>(null)
  const [forkSourceId, setForkSourceId] = useState("")
  const [forkLabel, setForkLabel] = useState("")
  const [forkHideSource, setForkHideSource] = useState(false)
  const [manualForm, setManualForm] = useState(DEFAULT_MANUAL_FORM)
  const [editDrafts, setEditDrafts] = useState<
    Record<string, Partial<ContentFactoryCoverStyle>>
  >({})
  const [showHiddenStyles, setShowHiddenStyles] = useState(false)
  const [deleteStyleOpen, setDeleteStyleOpen] = useState(false)
  const [deleteStyleTarget, setDeleteStyleTarget] = useState<ContentFactoryCoverStyle | null>(
    null
  )
  const [activeRevisionId, setActiveRevisionId] = useState<number | null>(null)
  const [revisionPreviewUrl, setRevisionPreviewUrl] = useState<string | null>(null)
  const [revisionDraftCache, setRevisionDraftCache] = useState<
    Record<number, Partial<ContentFactoryCoverStyle>>
  >({})
  /** 风格库卡片示例图：跟随详情内选中的版本 */
  const [styleExampleOverride, setStyleExampleOverride] = useState<Record<string, string>>(
    {}
  )
  /** AI 调整后的最新编辑态；查看历史版本时不覆盖，用于「回到最新」 */
  const liveLatestDraftRef = useRef<
    Record<string, Partial<ContentFactoryCoverStyle>>
  >({})

  const stylesQuery = useQuery({
    queryKey: ["cover-styles", "global", { includeHidden: showHiddenStyles }],
    queryFn: () =>
      fetchContentFactoryCoverStyles(libraryId, { includeHidden: showHiddenStyles }),
    enabled: open && Number.isFinite(libraryId),
  })

  const aiConfigQuery = useQuery({
    queryKey: ["settings", "ai", "config"],
    queryFn: fetchAiConfig,
    enabled: open,
  })

  const styles = stylesQuery.data?.items ?? []
  const { pinToFront, sortByDisplayOrder } = useCoverStyleDisplayOrder()
  const sortedStyles = useMemo(() => sortByDisplayOrder(styles), [sortByDisplayOrder, styles])
  const detailStyle = useMemo(
    () => styles.find((s) => s.id === detailStyleId) ?? null,
    [detailStyleId, styles]
  )
  const detailHasReference = Boolean(detailStyle?.reference_image_url)
  const detailHasExample = Boolean(detailStyle?.example_image_url)
  const detailShowImageToggle = detailHasReference && detailHasExample

  const revisionsQuery = useQuery({
    queryKey: ["cover-styles", detailStyleId, "revisions"],
    queryFn: () => fetchContentFactoryCoverStyleRevisions(libraryId, detailStyleId!),
    enabled: open && detailStyleId !== null && Number.isFinite(libraryId),
  })
  const styleRevisions = revisionsQuery.data?.items ?? []
  const panelStyle = useMemo((): ContentFactoryCoverStyle | null => {
    if (!detailStyle) {
      return null
    }
    if (activeRevisionId !== null) {
      const cached = revisionDraftCache[activeRevisionId]
      if (cached) {
        return { ...detailStyle, ...cached }
      }
      return detailStyle
    }
    const live = liveLatestDraftRef.current[detailStyle.id] ?? {}
    const edits = editDrafts[detailStyle.id] ?? {}
    return { ...detailStyle, ...live, ...edits }
  }, [activeRevisionId, detailStyle, editDrafts, revisionDraftCache])
  const detailExamplePreviewUrl =
    revisionPreviewUrl ?? detailStyle?.example_image_url ?? null
  const detailShowExamplePreview = Boolean(
    detailExamplePreviewUrl && (detailImageView === "example" || !detailHasReference)
  )

  useEffect(() => {
    if (!detailStyle) {
      return
    }
    if (detailStyle.reference_image_url && !detailStyle.example_image_url) {
      setDetailImageView("reference")
    } else {
      setDetailImageView("example")
    }
  }, [detailStyleId, detailStyle?.example_image_url, detailStyle?.reference_image_url])

  const prevDetailStyleIdRef = useRef<string | null>(null)

  useEffect(() => {
    setActiveRevisionId(null)
    setRevisionPreviewUrl(null)
    setRevisionDraftCache({})
    if (!detailStyle || detailStyle.id !== detailStyleId) {
      return
    }
    if (prevDetailStyleIdRef.current !== detailStyleId) {
      prevDetailStyleIdRef.current = detailStyleId
      liveLatestDraftRef.current[detailStyle.id] = {
        label: detailStyle.label,
        prompt_prefix: detailStyle.prompt_prefix,
        prompt_template: detailStyle.prompt_template,
        negative_prompt: detailStyle.negative_prompt,
        style_report: detailStyle.style_report,
        design_analysis: detailStyle.design_analysis,
        color_tokens: detailStyle.color_tokens,
        font_tokens: detailStyle.font_tokens,
      }
    }
  }, [detailStyleId, detailStyle])

  const coverStyleReady = isRecommendCoverStyleReady(aiConfigQuery.data)
  const coverStyleVisionReady = isRecommendCoverStyleVisionReady(aiConfigQuery.data)
  const coverStyleBinding = getRecommendCoverStyleBinding(aiConfigQuery.data)
  const imageReady = isRecommendImageReady(aiConfigQuery.data)
  const detailScroll = useAutoScrollbarVisible()

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["cover-styles"] })
  }, [queryClient])

  useEffect(() => {
    if (!open) {
      setMainTab("list")
      setCreateTab("ai")
      setDetailStyleId(null)
      setActiveRevisionId(null)
      setRevisionPreviewUrl(null)
      setEditDrafts({})
      setShowHiddenStyles(false)
      setDeleteStyleOpen(false)
      setDeleteStyleTarget(null)
      setReferenceId(null)
      setReferencePreviewUrl(null)
      setAiParseDraft(null)
      setIsAiParsing(false)
      aiParseAbortRef.current?.abort()
      aiParseAbortRef.current = null
    }
  }, [open])

  const openStyleDetail = (styleId: string) => {
    setDetailStyleId(styleId)
  }

  const canParseAiStyle =
    coverStyleReady && Boolean(referenceId) && coverStyleVisionReady

  const aiSaveMutation = useMutation({
    mutationFn: () =>
      saveParsedContentFactoryCoverStyle(libraryId, {
        name: aiParseDraft!.name.trim(),
        prompt_prefix: aiParseDraft!.prompt_prefix.trim(),
        prompt_template: aiParseDraft!.prompt_template.trim(),
        negative_prompt: aiParseDraft!.negative_prompt.trim(),
        style_report: aiParseDraft!.style_report.trim() || null,
        design_analysis: aiParseDraft!.design_analysis,
        reference_id: referenceId,
        fork_from_style_id: null,
        generate_example: imageReady,
      }),
    onSuccess: (style) => {
      toast.success(`已保存风格「${style.label}」`)
      setReferenceId(null)
      setReferencePreviewUrl(null)
      setAiParseDraft(null)
      invalidate()
      setMainTab("list")
      setDetailStyleId(style.id)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const runAiParse = useCallback(async () => {
    if (!canParseAiStyle) {
      return
    }
    aiParseAbortRef.current?.abort()
    const controller = new AbortController()
    aiParseAbortRef.current = controller
    setAiParseDraft(null)
    setIsAiParsing(true)
    try {
      await streamContentFactoryCoverStyleGenerate(
        libraryId,
        {
          generation_brief: null,
          reference_id: referenceId,
          fork_from_style_id: null,
        },
        {
          signal: controller.signal,
          onEvent: (event) => {
            if (event.event === "error") {
              toast.error(event.detail || "风格解析失败")
            }
            if (event.event === "done") {
              setAiParseDraft({
                name: event.payload.name,
                style_report: event.payload.style_report ?? "",
                design_analysis: event.payload.design_analysis ?? null,
                prompt_prefix: event.payload.prompt_prefix,
                prompt_template: event.payload.prompt_template,
                negative_prompt: event.payload.negative_prompt,
              })
            }
          },
        }
      )
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error((err as Error).message)
      }
    } finally {
      setIsAiParsing(false)
      aiParseAbortRef.current = null
    }
  }, [canParseAiStyle, libraryId, referenceId])

  const referenceUploadMutation = useMutation({
    mutationFn: (file: File) => uploadCoverStyleReference(libraryId, file),
    onSuccess: (data) => {
      setReferenceId(data.reference_id)
      setReferencePreviewUrl(data.preview_url)
      setAiParseDraft(null)
      toast.success("参考图已上传")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const clearReference = () => {
    setReferenceId(null)
    setReferencePreviewUrl(null)
    setAiParseDraft(null)
  }

  const setAiParseField = <K extends keyof AiParseDraft>(field: K, value: AiParseDraft[K]) => {
    setAiParseDraft((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const handleReferenceFile = (file: File | undefined) => {
    if (!file) {
      return
    }
    if (!coverStyleVisionReady) {
      toast.error("上传参考图需配置支持视觉的模型")
      return
    }
    referenceUploadMutation.mutate(file)
  }

  const manualCreateMutation = useMutation({
    mutationFn: () =>
      createContentFactoryCoverStyle(libraryId, {
        label: manualForm.label.trim(),
        prompt_prefix: manualForm.prompt_prefix.trim(),
        prompt_template: manualForm.prompt_template.trim(),
        negative_prompt: manualForm.negative_prompt.trim(),
      }),
    onSuccess: (style) => {
      toast.success(`已创建风格「${style.label}」`)
      setManualForm(DEFAULT_MANUAL_FORM)
      invalidate()
      setMainTab("list")
      setDetailStyleId(style.id)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const forkMutation = useMutation({
    mutationFn: () =>
      forkContentFactoryCoverStyle(libraryId, forkSourceId, {
        label: forkLabel.trim() || undefined,
        hidden_source: forkHideSource,
      }),
    onSuccess: (style) => {
      toast.success(`已 Fork 风格「${style.label}」`)
      invalidate()
      setMainTab("list")
      setDetailStyleId(style.id)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (styleId: string) => deleteContentFactoryCoverStyle(libraryId, styleId),
    onSuccess: () => {
      toast.success("已删除风格")
      setDeleteStyleOpen(false)
      setDeleteStyleTarget(null)
      setDetailStyleId(null)
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const hideStyleMutation = useMutation({
    mutationFn: ({ styleId, hidden }: { styleId: string; hidden: boolean }) =>
      patchContentFactoryCoverStyle(libraryId, styleId, { hidden }),
    onSuccess: (_, { hidden }) => {
      toast.success(hidden ? "已隐藏风格" : "已取消隐藏")
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const getStyleCardExampleUrl = useCallback(
    (style: ContentFactoryCoverStyle): string | null => {
      if (detailStyleId === style.id) {
        return detailExamplePreviewUrl ?? style.example_image_url ?? null
      }
      const overridden = styleExampleOverride[style.id]
      if (overridden) {
        return overridden
      }
      return style.example_image_url ?? null
    },
    [detailExamplePreviewUrl, detailStyleId, styleExampleOverride]
  )

  const buildPreviewPromptOverride = useCallback(
    (styleId: string) => {
      if (detailStyleId !== styleId || !panelStyle) {
        return {}
      }
      return {
        prompt_prefix: panelStyle.prompt_prefix,
        prompt_template: panelStyle.prompt_template,
        negative_prompt: panelStyle.negative_prompt,
        design_analysis: panelStyle.design_analysis ?? null,
        color_tokens: panelStyle.color_tokens,
        font_tokens: panelStyle.font_tokens,
      }
    },
    [detailStyleId, panelStyle]
  )

  const previewMutation = useMutation({
    mutationFn: ({ styleId }: { styleId: string }) =>
      previewContentFactoryCoverStyle(libraryId, styleId, {
        force: true,
        ...buildPreviewPromptOverride(styleId),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData<{ items: ContentFactoryCoverStyle[] }>(
        ["cover-styles", "global"],
        (prev) => {
          if (!prev) {
            return prev
          }
          return {
            items: prev.items.map((item) =>
              item.id === data.style_id
                ? { ...item, example_image_url: data.example_image_url }
                : item
            ),
          }
        }
      )
      if (detailStyleId === data.style_id) {
        setRevisionPreviewUrl(data.example_image_url)
      }
      setStyleExampleOverride((prev) => ({
        ...prev,
        [data.style_id]: data.example_image_url,
      }))
      toast.success("示例图已更新")
      void queryClient.invalidateQueries({ queryKey: ["cover-styles"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const saveEditsMutation = useMutation({
    mutationFn: async (style: ContentFactoryCoverStyle) => {
      const draft = editDrafts[style.id]
      if (!draft) {
        throw new Error("无修改内容")
      }
      const body = {
        label: draft.label,
        prompt_prefix: draft.prompt_prefix,
        prompt_template: draft.prompt_template,
        negative_prompt: draft.negative_prompt,
        style_report: draft.style_report ?? undefined,
        design_analysis: draft.design_analysis ?? undefined,
        color_tokens: draft.color_tokens,
        font_tokens: draft.font_tokens,
      }
      if (style.source === "builtin") {
        const forked = await forkContentFactoryCoverStyle(libraryId, style.id, {
          label: `${style.label}（副本）`,
        })
        return patchContentFactoryCoverStyle(libraryId, forked.id, body)
      }
      return patchContentFactoryCoverStyle(libraryId, style.id, body)
    },
    onSuccess: (saved, style) => {
      toast.success(
        style.source === "builtin"
          ? `已 Fork 并保存为「${saved.label}」`
          : "已保存修改"
      )
      setEditDrafts((prev) => {
        const next = { ...prev }
        delete next[style.id]
        return next
      })
      if (style.source === "builtin") {
        setDetailStyleId(saved.id)
      }
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const detailPreviewing =
    detailStyle !== null &&
    previewMutation.isPending &&
    previewMutation.variables?.styleId === detailStyle.id

  const startForkStyle = (style: ContentFactoryCoverStyle) => {
    setForkSourceId(style.id)
    setForkLabel(`${style.label}（副本）`)
    setMainTab("create")
    setCreateTab("fork")
  }

  const requestDeleteStyle = (style: ContentFactoryCoverStyle) => {
    setDeleteStyleTarget(style)
    setDeleteStyleOpen(true)
  }

  const renderStyleListCard = (style: ContentFactoryCoverStyle) => {
    const previewingThisStyle =
      previewMutation.isPending && previewMutation.variables?.styleId === style.id
    const cardExampleUrl = getStyleCardExampleUrl(style)

    return (
      <ContextMenu key={style.id}>
        <ContextMenuTrigger asChild>
          <li className="border-border flex flex-col overflow-hidden rounded-lg border bg-card">
            <button
              type="button"
              className={cn(
                "hover:bg-muted/40 flex flex-col text-left transition-colors",
                style.hidden && "opacity-60"
              )}
              onDoubleClick={() => openStyleDetail(style.id)}
            >
              <div className="bg-muted/30 relative aspect-[3/4] max-h-52 w-full overflow-hidden">
                {cardExampleUrl ? (
                  <img
                    key={cardExampleUrl}
                    src={cardExampleUrl}
                    alt={`${style.label} 示例图`}
                    title="双击查看详情"
                    className="size-full cursor-zoom-in object-contain object-center"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      openStyleDetail(style.id)
                    }}
                  />
                ) : (
                  <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
                    无示例图 · 双击查看详情
                  </div>
                )}
              </div>
              <div className="flex items-start justify-between gap-2 p-3">
                <div>
                  <p className="text-sm font-medium">{style.label}</p>
                  <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">{style.id}</p>
                </div>
                <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[10px]">
                  {style.hidden ? "已隐藏" : sourceLabel(style.source)}
                </span>
              </div>
            </button>
          </li>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={() => openStyleDetail(style.id)}>
            <Eye className="mr-2 size-3.5" aria-hidden />
            查看详情
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              pinToFront(style.id)
              toast.success(`「${style.label}」已置于最前`)
            }}
          >
            <ArrowUpToLine className="mr-2 size-3.5" aria-hidden />
            置于最前
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => startForkStyle(style)}>
            <Copy className="mr-2 size-3.5" aria-hidden />
            Fork
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!imageReady || previewMutation.isPending}
            onSelect={() => previewMutation.mutate({ styleId: style.id })}
          >
            {previewingThisStyle ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-2 size-3.5" aria-hidden />
            )}
            生成示例图
          </ContextMenuItem>
          {!style.hidden ? (
            <ContextMenuItem
              disabled={hideStyleMutation.isPending}
              onSelect={() => hideStyleMutation.mutate({ styleId: style.id, hidden: true })}
            >
              <EyeOff className="mr-2 size-3.5" aria-hidden />
              隐藏
            </ContextMenuItem>
          ) : (
            <ContextMenuItem
              disabled={hideStyleMutation.isPending}
              onSelect={() => hideStyleMutation.mutate({ styleId: style.id, hidden: false })}
            >
              <Eye className="mr-2 size-3.5" aria-hidden />
              取消隐藏
            </ContextMenuItem>
          )}
          {style.is_deletable ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="text-destructive focus:text-destructive"
                disabled={deleteMutation.isPending}
                onSelect={() => requestDeleteStyle(style)}
              >
                <Trash2 className="mr-2 size-3.5" aria-hidden />
                删除
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  const forkOptions = useMemo(
    () => styles.filter((s) => s.id !== "native-readme"),
    [styles]
  )

  const getLiveLatestSnapshot = (style: ContentFactoryCoverStyle): ContentFactoryCoverStyle => {
    const live = liveLatestDraftRef.current[style.id] ?? {}
    return {
      ...style,
      label: live.label ?? style.label,
      prompt_prefix: live.prompt_prefix ?? style.prompt_prefix,
      prompt_template: live.prompt_template ?? style.prompt_template,
      negative_prompt: live.negative_prompt ?? style.negative_prompt,
      style_report: live.style_report ?? style.style_report,
      color_tokens: live.color_tokens ?? style.color_tokens,
      font_tokens: live.font_tokens ?? style.font_tokens,
      design_analysis: normalizeCoverStyleDesignAnalysis(
        live.design_analysis ?? style.design_analysis
      ),
    }
  }

  const getStyleEditSnapshot = (style: ContentFactoryCoverStyle): ContentFactoryCoverStyle =>
    getLiveLatestSnapshot(style)

  const patchPanelDraft = (
    styleId: string,
    patch: Partial<ContentFactoryCoverStyle>
  ) => {
    if (activeRevisionId !== null) {
      setRevisionDraftCache((prev) => ({
        ...prev,
        [activeRevisionId]: { ...prev[activeRevisionId], ...patch },
      }))
      return
    }
    liveLatestDraftRef.current[styleId] = {
      ...liveLatestDraftRef.current[styleId],
      ...patch,
    }
    setEditDrafts((prev) => ({
      ...prev,
      [styleId]: { ...prev[styleId], ...patch },
    }))
  }

  const setEditValue = (styleId: string, field: string, value: string) => {
    patchPanelDraft(styleId, { [field]: value })
  }

  const setEditDesignAnalysis = (styleId: string, value: CoverStyleDesignAnalysis) => {
    patchPanelDraft(styleId, { design_analysis: value })
  }

  const createRevisionMutation = useMutation({
    mutationFn: (opts: {
      styleId: string
      instruction: string
      snapshot: ContentFactoryCoverStyle
    }) =>
      createContentFactoryCoverStyleRevision(libraryId, opts.styleId, {
        instruction: opts.instruction,
        design_analysis: opts.snapshot.design_analysis ?? null,
        prompt_prefix: opts.snapshot.prompt_prefix,
        prompt_template: opts.snapshot.prompt_template,
        negative_prompt: opts.snapshot.negative_prompt,
        color_tokens: opts.snapshot.color_tokens,
        font_tokens: opts.snapshot.font_tokens,
        style_report: opts.snapshot.style_report ?? null,
      }),
    onSuccess: (_rev, { styleId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["cover-styles", styleId, "revisions"],
      })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const applyStyleRefine = (
    styleId: string,
    result: Awaited<ReturnType<typeof refineContentFactoryCoverStyle>>,
    instruction: string,
    beforeSnapshot: ContentFactoryCoverStyle
  ) => {
    createRevisionMutation.mutate({
      styleId,
      instruction,
      snapshot: beforeSnapshot,
    })
    const nextDraft: Partial<ContentFactoryCoverStyle> = {
      prompt_prefix: result.prompt_prefix,
      prompt_template: result.prompt_template,
      negative_prompt: result.negative_prompt,
      style_report: result.style_report,
      design_analysis: result.design_analysis,
      color_tokens: result.color_tokens,
      font_tokens: result.font_tokens,
    }
    liveLatestDraftRef.current[styleId] = {
      ...liveLatestDraftRef.current[styleId],
      ...nextDraft,
    }
    setEditDrafts((prev) => ({
      ...prev,
      [styleId]: {
        ...prev[styleId],
        ...nextDraft,
      },
    }))
    setActiveRevisionId(null)
    setRevisionPreviewUrl(null)
  }

  const handleSelectLatest = useCallback(() => {
    if (!detailStyle || activeRevisionId === null) {
      return
    }
    const draft = liveLatestDraftRef.current[detailStyle.id]
    if (!draft) {
      return
    }
    setActiveRevisionId(null)
    setRevisionPreviewUrl(null)
    setDetailImageView("example")
    setStyleExampleOverride((prev) => {
      const next = { ...prev }
      delete next[detailStyle.id]
      return next
    })
    setEditDrafts((prev) => ({
      ...prev,
      [detailStyle.id]: {
        ...prev[detailStyle.id],
        ...draft,
      },
    }))
  }, [activeRevisionId, detailStyle])

  const handleSelectRevision = useCallback(
    async (revisionId: number) => {
      if (!detailStyle) {
        return
      }
      try {
        const rev = await fetchContentFactoryCoverStyleRevision(
          libraryId,
          detailStyle.id,
          revisionId
        )
        const draft = revisionDraftFromRead(rev)
        setRevisionDraftCache((prev) => ({ ...prev, [revisionId]: draft }))
        setActiveRevisionId(revisionId)
        setRevisionPreviewUrl(rev.example_image_url ?? null)
        setDetailImageView("example")
        const exampleUrl = rev.example_image_url ?? detailStyle.example_image_url
        if (exampleUrl) {
          setStyleExampleOverride((prev) => ({
            ...prev,
            [detailStyle.id]: exampleUrl,
          }))
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "无法加载版本")
      }
    },
    [detailStyle, libraryId]
  )

  const restoreLiveFromDraft = useCallback(
    (
      draft: Partial<ContentFactoryCoverStyle>,
      exampleUrl: string | null | undefined
    ) => {
      if (!detailStyle) {
        return
      }
      liveLatestDraftRef.current[detailStyle.id] = draft
      setEditDrafts((prev) => ({
        ...prev,
        [detailStyle.id]: { ...draft },
      }))
      setActiveRevisionId(null)
      setRevisionPreviewUrl(exampleUrl ?? null)
      setDetailImageView("example")
      if (exampleUrl) {
        setStyleExampleOverride((prev) => ({
          ...prev,
          [detailStyle.id]: exampleUrl,
        }))
      } else {
        setStyleExampleOverride((prev) => {
          const next = { ...prev }
          delete next[detailStyle.id]
          return next
        })
      }
    },
    [detailStyle]
  )

  const handleDiscardLiveLatest = useCallback(async () => {
    if (!detailStyle || activeRevisionId !== null) {
      return
    }
    const newest = [...styleRevisions].sort(
      (a, b) => b.revision_index - a.revision_index
    )[0]
    if (!newest) {
      restoreLiveFromDraft(
        draftFromSavedStyle(detailStyle),
        detailStyle.example_image_url
      )
      toast.success("已回退到风格库已保存内容")
      return
    }
    try {
      const rev = await fetchContentFactoryCoverStyleRevision(
        libraryId,
        detailStyle.id,
        newest.id
      )
      await deleteContentFactoryCoverStyleRevision(
        libraryId,
        detailStyle.id,
        newest.id
      )
      setRevisionDraftCache((prev) => {
        const next = { ...prev }
        delete next[newest.id]
        return next
      })
      restoreLiveFromDraft(
        revisionDraftFromRead(rev),
        rev.example_image_url ?? detailStyle.example_image_url
      )
      await queryClient.invalidateQueries({
        queryKey: ["cover-styles", detailStyle.id, "revisions"],
      })
      toast.success("已撤销最后一次 AI 调整")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "无法删除当前最新")
    }
  }, [
    activeRevisionId,
    detailStyle,
    libraryId,
    queryClient,
    restoreLiveFromDraft,
    styleRevisions,
  ])

  const handleDeleteRevision = useCallback(
    async (revisionId: number) => {
      if (!detailStyle) {
        return
      }
      const wasViewingDeleted = activeRevisionId === revisionId

      try {
        await deleteContentFactoryCoverStyleRevision(
          libraryId,
          detailStyle.id,
          revisionId
        )
        setRevisionDraftCache((prev) => {
          const next = { ...prev }
          delete next[revisionId]
          return next
        })

        const nearest = nearestRevisionAfterDelete(styleRevisions, revisionId)

        await queryClient.invalidateQueries({
          queryKey: ["cover-styles", detailStyle.id, "revisions"],
        })

        if (wasViewingDeleted) {
          if (nearest) {
            await handleSelectRevision(nearest.id)
          } else {
            handleSelectLatest()
          }
        }

        toast.success("已删除版本")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "无法删除版本")
      }
    },
    [
      activeRevisionId,
      detailStyle,
      handleSelectLatest,
      handleSelectRevision,
      libraryId,
      queryClient,
      styleRevisions,
    ]
  )

  const saveEdits = (style: ContentFactoryCoverStyle) => {
    saveEditsMutation.mutate(style)
  }

  const renderStyleDetailPanel = (style: ContentFactoryCoverStyle) => {
    const display = panelStyle ?? style
    const draft = editDrafts[style.id]
    const hasEdits =
      activeRevisionId === null && coverStyleDraftDiffersFromSaved(style, draft)
    const styleReport = display.style_report ?? ""
    const panelRevisionKey = activeRevisionId ?? "live"
    const previewingThisStyle =
      previewMutation.isPending && previewMutation.variables?.styleId === style.id

    return (
      <>
        <div
          key={`${style.id}-${panelRevisionKey}`}
          className={cn(
            "main-auto-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4",
            detailScroll.scrollbarVisible && "main-auto-scrollbar--visible"
          )}
          onScroll={detailScroll.onScroll}
        >
          {styleReport ? (
            <p className="text-muted-foreground text-xs leading-relaxed">{styleReport}</p>
          ) : null}
          <CoverStyleDesignAnalysisEditor
            key={`da-${panelRevisionKey}`}
            analysis={normalizeCoverStyleDesignAnalysis(display.design_analysis)}
            onChange={(value) => setEditDesignAnalysis(style.id, value)}
          />
          {PROMPT_FIELD_ORDER.map((field) =>
            renderPromptField(
              field,
              (display[field] as string | undefined) ?? "",
              (value) => setEditValue(style.id, field, value),
              `${field}-${panelRevisionKey}`
            )
          )}
        </div>
        <div className="border-border flex shrink-0 flex-wrap gap-2 border-t p-4">
          {hasEdits ? (
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={saveEditsMutation.isPending}
              onClick={() => saveEdits(style)}
            >
              {saveEditsMutation.isPending ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : null}
              {style.source === "builtin" ? "Fork 并保存" : "保存修改"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={!imageReady || previewMutation.isPending}
            onClick={() => previewMutation.mutate({ styleId: style.id })}
          >
            {previewingThisStyle ? (
              <Loader2 className="mr-1 size-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 size-3" />
            )}
            生成示例图
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => startForkStyle(style)}
          >
            <Copy className="mr-1 size-3" />
            Fork
          </Button>
          {style.is_deletable ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8 text-xs"
              disabled={deleteMutation.isPending}
              onClick={() => requestDeleteStyle(style)}
            >
              <Trash2 className="mr-1 size-3" />
              删除
            </Button>
          ) : null}
        </div>
      </>
    )
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={STYLE_LIBRARY_DIALOG_CLASS}>
        <DialogHeader className="border-border shrink-0 border-b px-6 py-4">
          <DialogTitle>风格库</DialogTitle>
          <DialogDescription>
            全库共享一份 AI 风格：陈列示例图与 prompt，支持 AI 生成、手工创建与 Fork；任意资料库的内容工厂共用。
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mainTab}
          onValueChange={(v) => setMainTab(v as "list" | "create")}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="border-border shrink-0 border-b px-6 pt-2">
            <TabsList className="h-9">
              <TabsTrigger value="list" className="text-xs">
                全部风格
              </TabsTrigger>
              <TabsTrigger value="create" className="gap-1 text-xs">
                <Plus className="size-3.5" aria-hidden />
                新增
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="list" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex items-center justify-end">
              <Button
                type="button"
                variant={showHiddenStyles ? "secondary" : "outline"}
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setShowHiddenStyles((v) => !v)}
              >
                <EyeOff className="size-3.5" aria-hidden />
                {showHiddenStyles ? "隐藏已隐藏项" : "显示已隐藏"}
              </Button>
            </div>
            {stylesQuery.isLoading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                加载风格…
              </div>
            ) : styles.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center text-sm">暂无风格</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {sortedStyles.map((style) => renderStyleListCard(style))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="create" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden p-4">
            <Tabs
              value={createTab}
              onValueChange={(v) => setCreateTab(v as typeof createTab)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList className="mb-4 h-8 shrink-0">
                <TabsTrigger value="ai" className="text-xs">
                  AI 生成
                </TabsTrigger>
                <TabsTrigger value="manual" className="text-xs">
                  手工创建
                </TabsTrigger>
                <TabsTrigger value="fork" className="text-xs">
                  Fork
                </TabsTrigger>
              </TabsList>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <TabsContent
                value="ai"
                className="mt-0 flex min-h-0 flex-1 flex-col gap-3 data-[state=inactive]:hidden"
              >
                {!coverStyleReady ? (
                  <p className="text-muted-foreground shrink-0 text-xs">
                    请先在{" "}
                    <Link
                      to="/settings/ai"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      AI 工作室
                    </Link>{" "}
                    配置「封面风格生成」场景。
                  </p>
                ) : null}
                <div className="border-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border md:flex-row">
                  <div className="bg-muted/40 flex min-h-[220px] flex-1 flex-col p-4 md:min-h-0 md:basis-[40%]">
                    {!coverStyleVisionReady ? (
                      <p className="text-muted-foreground mb-2 shrink-0 text-[10px] leading-relaxed">
                        {coverStyleBinding ? (
                          <>
                            当前绑定{" "}
                            <span className="text-foreground font-medium">
                              {coverStyleBinding.model}
                            </span>
                            ，不支持参考图。请改用 MiniMax-M3 等视觉模型。
                          </>
                        ) : (
                          <>上传参考图需 vision 模型。</>
                        )}{" "}
                        <Link to="/settings/ai" className="text-primary underline-offset-2 hover:underline">
                          设置 → AI
                        </Link>
                      </p>
                    ) : null}
                    <div
                      className={cn(
                        "relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-md",
                        !coverStyleVisionReady && !referencePreviewUrl && "pointer-events-none opacity-50"
                      )}
                    >
                      {referencePreviewUrl ? (
                        <>
                          <img
                            src={referencePreviewUrl}
                            alt="灵感参考图"
                            className={cn(
                              "max-h-full w-full object-contain object-center transition-opacity",
                              isAiParsing && "animate-pulse opacity-70"
                            )}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute top-1 right-1 size-7"
                            onClick={clearReference}
                            disabled={
                              referenceUploadMutation.isPending ||
                              isAiParsing ||
                              aiSaveMutation.isPending
                            }
                          >
                            <X className="size-3.5" />
                          </Button>
                        </>
                      ) : (
                        <label className="border-border text-muted-foreground flex size-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed p-4 text-center text-xs">
                          {referenceUploadMutation.isPending ? (
                            <Loader2 className="size-6 animate-spin" />
                          ) : (
                            <ImagePlus className="size-6" aria-hidden />
                          )}
                          <span>点击上传灵感参考图</span>
                          <span className="text-[10px]">PNG / JPEG / WebP，≤4MB</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            disabled={
                              !coverStyleVisionReady ||
                              referenceUploadMutation.isPending ||
                              isAiParsing
                            }
                            onChange={(e) => {
                              handleReferenceFile(e.target.files?.[0])
                              e.target.value = ""
                            }}
                          />
                        </label>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="absolute right-2 bottom-2 z-10 h-8 gap-1.5 px-2.5 text-xs shadow-md"
                        disabled={!canParseAiStyle || isAiParsing || aiSaveMutation.isPending}
                        onClick={() => void runAiParse()}
                      >
                        {isAiParsing ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="size-3.5" />
                        )}
                        {isAiParsing ? "解析中…" : "解析风格"}
                      </Button>
                    </div>
                  </div>
                  <div className="border-border flex min-h-0 flex-1 flex-col md:basis-[60%] md:border-l">
                    <div className="main-auto-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                      {isAiParsing ? (
                        <>
                          <Skeleton className="h-14 w-full" />
                          {PROMPT_FIELD_ORDER.map((field) => (
                            <div key={field}>
                              <Skeleton className="mb-1.5 h-3 w-16" />
                              <Skeleton
                                className={cn(
                                  "w-full",
                                  CAPSULE_PROMPT_FIELDS.has(field) ? "h-16" : "h-20"
                                )}
                              />
                            </div>
                          ))}
                        </>
                      ) : aiParseDraft ? (
                        <>
                          {aiParseDraft.style_report ? (
                            <p className="text-muted-foreground text-xs leading-relaxed">
                              {aiParseDraft.style_report}
                            </p>
                          ) : null}
                          <CoverStyleDesignAnalysisEditor
                            analysis={aiParseDraft.design_analysis}
                            onChange={(value) => setAiParseField("design_analysis", value)}
                          />
                          <div>
                            <Label htmlFor="ai-parse-name" className="text-sm font-medium">
                              风格名称
                            </Label>
                            <Input
                              id="ai-parse-name"
                              className="mt-1.5 h-8 text-sm"
                              value={aiParseDraft.name}
                              onChange={(e) => setAiParseField("name", e.target.value)}
                            />
                          </div>
                          {PROMPT_FIELD_ORDER.map((field) =>
                            renderPromptField(field, aiParseDraft[field], (value) =>
                              setAiParseField(field, value)
                            )
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground py-8 text-center text-xs leading-relaxed">
                          上传参考图后点击右下角「解析风格」，AI 将在此展示配色、构图与 prompt 分析结果。
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="border-border shrink-0 space-y-3 border-t pt-3">
                  {!imageReady ? (
                    <p className="text-muted-foreground text-[10px]">
                      未配置「推荐配图」时将跳过示例图生成，可稍后在列表中补生成。
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    disabled={
                      !aiParseDraft?.name.trim() ||
                      !aiParseDraft?.prompt_prefix.trim() ||
                      !aiParseDraft?.prompt_template.trim() ||
                      aiSaveMutation.isPending ||
                      isAiParsing
                    }
                    onClick={() => aiSaveMutation.mutate()}
                  >
                    {aiSaveMutation.isPending ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : (
                      <Plus className="mr-1.5 size-4" />
                    )}
                    保存风格
                  </Button>
                </div>
              </TabsContent>

              <TabsContent
                value="manual"
                className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
              >
                <div className="space-y-3">
                <div>
                  <Label htmlFor="manual-label">风格名称</Label>
                  <Input
                    id="manual-label"
                    className="mt-1.5"
                    value={manualForm.label}
                    onChange={(e) =>
                      setManualForm((f) => ({ ...f, label: e.target.value }))
                    }
                  />
                </div>
                {(["prompt_prefix", "prompt_template", "negative_prompt"] as const).map(
                  (field) => (
                    <div key={field}>
                      <Label htmlFor={`manual-${field}`}>{field}</Label>
                      <Textarea
                        id={`manual-${field}`}
                        className="mt-1.5 min-h-[72px] font-mono text-xs"
                        value={manualForm[field]}
                        onChange={(e) =>
                          setManualForm((f) => ({ ...f, [field]: e.target.value }))
                        }
                      />
                    </div>
                  )
                )}
                <Button
                  type="button"
                  disabled={
                    !manualForm.label.trim() ||
                    !manualForm.prompt_prefix.trim() ||
                    !manualForm.prompt_template.trim() ||
                    manualCreateMutation.isPending
                  }
                  onClick={() => manualCreateMutation.mutate()}
                >
                  {manualCreateMutation.isPending ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Plus className="mr-1.5 size-4" />
                  )}
                  保存风格
                </Button>
                </div>
              </TabsContent>

              <TabsContent
                value="fork"
                className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
              >
                <div className="space-y-3">
                <div>
                  <Label htmlFor="fork-source">源风格</Label>
                  <select
                    id="fork-source"
                    className="border-input bg-background mt-1.5 flex h-9 w-full rounded-md border px-2 text-sm"
                    value={forkSourceId}
                    onChange={(e) => setForkSourceId(e.target.value)}
                  >
                    <option value="">请选择</option>
                    {forkOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="fork-label">新名称（可选）</Label>
                  <Input
                    id="fork-label"
                    className="mt-1.5"
                    value={forkLabel}
                    onChange={(e) => setForkLabel(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={forkHideSource}
                    onChange={(e) => setForkHideSource(e.target.checked)}
                  />
                  Fork 内置风格时隐藏原内置项
                </label>
                <Button
                  type="button"
                  disabled={!forkSourceId || forkMutation.isPending}
                  onClick={() => forkMutation.mutate()}
                >
                  {forkMutation.isPending ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Copy className="mr-1.5 size-4" />
                  )}
                  Fork 并保存
                </Button>
                </div>
              </TabsContent>
              </div>
            </Tabs>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    <Dialog
      open={detailStyle !== null}
      onOpenChange={(next) => {
        if (!next) {
          setDetailStyleId(null)
          setActiveRevisionId(null)
          setRevisionPreviewUrl(null)
        }
      }}
    >
      <DialogContent className="flex max-h-[min(92vh,860px)] w-[min(96vw,72rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        {detailStyle ? (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <div className="bg-muted/40 relative flex min-h-[240px] min-w-0 flex-1 flex-col overflow-hidden p-4 md:min-h-0 md:basis-[58%]">
              {detailShowImageToggle ? (
                <div
                  className="border-border bg-background/80 mb-3 flex shrink-0 gap-1 self-start rounded-md border p-0.5"
                  role="tablist"
                  aria-label="详情图片视图"
                >
                  <Button
                    type="button"
                    role="tab"
                    aria-selected={detailImageView === "reference"}
                    variant={detailImageView === "reference" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setDetailImageView("reference")}
                  >
                    灵感参考
                  </Button>
                  <Button
                    type="button"
                    role="tab"
                    aria-selected={detailImageView === "example"}
                    variant={detailImageView === "example" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setDetailImageView("example")}
                  >
                    风格示例
                  </Button>
                </div>
              ) : detailHasReference || detailHasExample || revisionPreviewUrl ? (
                <p className="text-muted-foreground mb-2 shrink-0 text-xs font-medium">
                  {detailHasReference && detailImageView === "reference"
                    ? "灵感参考"
                    : "风格示例"}
                </p>
              ) : null}
              <div className="relative flex min-h-0 flex-1 flex-row items-stretch gap-2 overflow-hidden">
                {styleRevisions.length > 0 ? (
                  <CoverStyleRevisionRail
                    items={styleRevisions}
                    activeRevisionId={activeRevisionId}
                    onSelect={(id) => void handleSelectRevision(id)}
                    onSelectLatest={() => handleSelectLatest()}
                    onDeleteRevision={(id) => void handleDeleteRevision(id)}
                    onDiscardLiveLatest={() => void handleDiscardLiveLatest()}
                  />
                ) : null}
                <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden">
                {detailImageView === "reference" && detailHasReference ? (
                  <img
                    key={detailStyle.reference_image_url}
                    src={detailStyle.reference_image_url!}
                    alt={`${detailStyle.label} 灵感参考图`}
                    className="max-h-full max-w-full object-contain object-center"
                  />
                ) : detailShowExamplePreview ? (
                  <img
                    key={detailExamplePreviewUrl}
                    src={detailExamplePreviewUrl!}
                    alt={`${detailStyle.label} 示例图`}
                    className={cn(
                      "max-h-full max-w-full object-contain object-center transition-opacity",
                      detailPreviewing && "opacity-35"
                    )}
                  />
                ) : !detailPreviewing ? (
                  <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 text-sm">
                    <p>暂无示例图</p>
                    <p className="text-xs">可在右侧生成示例图预览效果</p>
                  </div>
                ) : null}
                {detailPreviewing && detailImageView === "example" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                    <Loader2 className="text-primary size-9 animate-spin" aria-hidden />
                    <p className="text-foreground text-sm font-medium">正在生成示例图…</p>
                    <p className="text-muted-foreground text-xs">AI 配图生成中，请稍候</p>
                  </div>
                ) : null}
                </div>
              </div>
            </div>
            <div className="border-border flex min-h-0 w-full flex-col border-t md:w-[42%] md:max-w-xl md:border-t-0 md:border-l">
              <div className="border-border shrink-0 space-y-1 border-b px-4 py-3">
                <DialogTitle className="text-base leading-snug">{detailStyle.label}</DialogTitle>
                <div className="flex items-start justify-between gap-2">
                  <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <span className="font-mono">{detailStyle.id}</span>
                    <span aria-hidden>·</span>
                    <span>{sourceLabel(detailStyle.source)}</span>
                  </DialogDescription>
                  <CoverStyleAiRefineButton
                    libraryId={libraryId}
                    enabled={coverStyleReady}
                    snapshot={getLiveLatestSnapshot(detailStyle)}
                    onApply={(result, instruction) =>
                      applyStyleRefine(
                        detailStyle.id,
                        result,
                        instruction,
                        getStyleEditSnapshot(detailStyle)
                      )
                    }
                  />
                </div>
              </div>
              {renderStyleDetailPanel(detailStyle)}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>

    <AlertDialog
      open={deleteStyleOpen}
      onOpenChange={(nextOpen) => {
        setDeleteStyleOpen(nextOpen)
        if (!nextOpen) {
          setDeleteStyleTarget(null)
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除风格？</AlertDialogTitle>
          <AlertDialogDescription>
            将永久删除「{deleteStyleTarget?.label ?? ""}」（{deleteStyleTarget?.id ?? ""}），此操作不可撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>取消</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteMutation.isPending || deleteStyleTarget == null}
            onClick={(e) => {
              e.preventDefault()
              if (deleteStyleTarget) {
                deleteMutation.mutate(deleteStyleTarget.id)
              }
            }}
          >
            {deleteMutation.isPending ? "删除中…" : "删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
