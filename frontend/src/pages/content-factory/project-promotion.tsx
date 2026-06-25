import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { toast } from "sonner"

import {
  PromotionCopyPanel,
  type PromotionCopyPanelHandle,
} from "@/components/content-factory/promotion-copy-panel"
import { PromotionAnalysisStart } from "@/components/content-factory/promotion-analysis-start"
import { PromotionHighlightTags } from "@/components/content-factory/promotion-highlight-tags"
import {
  ReadmeCoverCaptureHost,
  type ReadmeCoverCaptureHostHandle,
} from "@/components/content-factory/readme-cover-capture-host"
import { ReadmeCoverCaptureErrorBoundary } from "@/components/content-factory/readme-cover-capture-error-boundary"
import { CoverStyleManageDialog } from "@/components/content-factory/cover-style-manage-dialog"
import { PromotionImagePanel } from "@/components/content-factory/promotion-image-panel"
import { PromotionProjectHeader } from "@/components/content-factory/promotion-project-header"
import { PromotionStepper } from "@/components/content-factory/promotion-stepper"
import { ProjectPickerDialog } from "@/components/content-factory/project-picker-dialog"
import { Button } from "@/components/ui/button"
import { defaultReadmeQueryKey } from "@/context/project-github-cache"
import { useCoverStyleDisplayOrder } from "@/hooks/use-cover-style-display-order"
import {
  contentFactoryCoverUrl,
  createContentFactoryDraft,
  fetchContentFactoryCoverStyles,
  fetchContentFactoryDraft,
  generateContentFactoryAiCover,
  generateContentFactoryCopy,
  optimizeContentFactorySelection,
  patchContentFactoryDraft,
  revealContentFactoryCover,
  uploadContentFactoryCover,
} from "@/lib/content-factory-api"
import { getCoverVariant, hasCoverVariant } from "@/lib/content-factory-cover-variants"
import { isRecommendImageReady } from "@/lib/recommend-image-ready"
import { fetchAiConfig } from "@/lib/settings-ai"
import { fetchProjectReadme } from "@/lib/project-readme"
import {
  runProjectPromotionAnalysis,
  type AnalysisStepState,
} from "@/lib/run-project-promotion-analysis"
import { getCoverOutputSize, readStoredCoverSizePresetId, storeCoverSizePresetId } from "@/lib/readme-cover-presets"
import {
  getCaptureImageCacheSize,
  isCaptureIncompleteError,
  isCaptureEmptyBlobError,
  isCaptureTimeoutError,
  README_CAPTURE_MAX_ATTEMPTS,
} from "@/lib/readme-cover-capture"
import { createCoverProgressReporter } from "@/lib/readme-cover-progress"
import {
  draftHasWorkbenchContent,
  isPlatformView,
  migrateCopyJson,
  platformVariantNeedsLayout,
  readViewContent,
  writeViewContent,
  type ViewContent,
} from "@/lib/content-factory-views"
import type {
  ContentFactoryCopyJson,
  ContentFactoryDraft,
  ContentFactoryView,
  CoverStyleOption,
  RecommendPlatform,
} from "@/types/content-factory"
import { NATIVE_README_TEMPLATE } from "@/types/content-factory"
import type { ProjectReadme } from "@/types/project-github"

const coverReadmeQueryOptions = {
  staleTime: Number.POSITIVE_INFINITY,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
} as const

function contentFactoryDraftQueryKey(libraryId: number, draftId: number) {
  return ["content-factory", libraryId, "draft", draftId] as const
}

async function ensureCoverDraft(
  queryClient: QueryClient,
  libraryId: number,
  draftId: number
): Promise<ContentFactoryDraft> {
  const cached = queryClient.getQueryData<ContentFactoryDraft>(
    contentFactoryDraftQueryKey(libraryId, draftId)
  )
  if (cached) {
    return cached
  }
  return fetchContentFactoryDraft(libraryId, draftId)
}

async function ensureCoverReadme(
  queryClient: QueryClient,
  projectId: number,
  fresh = false
): Promise<ProjectReadme> {
  const queryKey = defaultReadmeQueryKey(projectId)
  if (fresh) {
    const readme = await fetchProjectReadme(projectId, null, { fresh: true })
    queryClient.setQueryData(queryKey, readme)
    return readme
  }
  return queryClient.fetchQuery({
    queryKey,
    queryFn: () => fetchProjectReadme(projectId, null, { fresh: false }),
    ...coverReadmeQueryOptions,
  })
}

function throwIfCoverAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("封面截图已取消", "AbortError")
  }
}

function isCoverAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") {
    return true
  }
  return err instanceof Error && err.name === "AbortError"
}

function acquireCoverMutex(
  tailRef: { current: Promise<void> }
): Promise<() => void> {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const prev = tailRef.current
  tailRef.current = prev.then(() => gate)
  return prev.then(() => release)
}

function EmptyPromotionState({ libraryId }: { libraryId: number }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-muted-foreground max-w-md text-sm">
        从左侧草稿库点击 <strong>+</strong> 新建推荐稿，或选择已有草稿开始编辑。
      </p>
      <Button type="button" variant="outline" size="sm" asChild>
        <Link to={`/libraries/${libraryId}`}>返回资料库</Link>
      </Button>
    </div>
  )
}

export function ProjectPromotionPage() {
  const { libraryId: libraryIdParam, draftId: draftIdParam } = useParams()
  const libraryId = Number(libraryIdParam)
  const draftId = draftIdParam ? Number(draftIdParam) : null
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const prefillProjectId = Number(searchParams.get("projectId"))

  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [copyJson, setCopyJson] = useState<ContentFactoryCopyJson | null>(null)
  const [contentView, setContentView] = useState<ContentFactoryView>("xiaohongshu")
  const [imageTemplate, setImageTemplate] = useState("minimal-tech")
  const [coverCacheBust, setCoverCacheBust] = useState<string | null>(null)
  const [coverSizePresetId, setCoverSizePresetId] = useState(readStoredCoverSizePresetId)
  const [optimizingRange, setOptimizingRange] = useState<{
    start: number
    end: number
  } | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [styleManageOpen, setStyleManageOpen] = useState(false)
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStepState[]>([])
  const saveBodyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyPanelRef = useRef<PromotionCopyPanelHandle>(null)
  const didPrefillRef = useRef(false)
  const hydratedDraftIdRef = useRef<number | null>(null)
  const activeDraftIdRef = useRef(draftId)
  const coverAbortRef = useRef<AbortController | null>(null)
  const coverCaptureHostRef = useRef<ReadmeCoverCaptureHostHandle>(null)
  const coverProgressSetterRef = useRef<((label: string | null) => void) | null>(null)
  const coverRunSeqRef = useRef(0)
  const coverMutexTailRef = useRef<Promise<void>>(Promise.resolve())

  activeDraftIdRef.current = draftId

  const scrollBodyToEnd = useCallback((panelRef: RefObject<PromotionCopyPanelHandle | null>) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panelRef.current?.scrollBodyToEnd()
      })
    })
  }, [])

  const draftQuery = useQuery({
    queryKey: contentFactoryDraftQueryKey(libraryId, draftId!),
    queryFn: () => fetchContentFactoryDraft(libraryId, draftId!),
    enabled: draftId != null && Number.isFinite(draftId) && draftId > 0,
  })

  const aiConfigQuery = useQuery({
    queryKey: ["settings", "ai", "config"],
    queryFn: fetchAiConfig,
  })

  const coverStylesQuery = useQuery({
    queryKey: ["cover-styles", "global"],
    queryFn: () => fetchContentFactoryCoverStyles(libraryId),
    enabled: Number.isFinite(libraryId) && libraryId > 0,
  })

  const { sortByDisplayOrder } = useCoverStyleDisplayOrder()

  const styleOptions: CoverStyleOption[] = useMemo(() => {
    const apiItems = (coverStylesQuery.data?.items ?? []).map((s) => ({
      id: s.id,
      label: s.label,
      source: s.source,
      example_image_url: s.example_image_url,
    }))
    return [NATIVE_README_TEMPLATE, ...sortByDisplayOrder(apiItems)]
  }, [coverStylesQuery.data?.items, sortByDisplayOrder])

  const recommendImageReady = isRecommendImageReady(aiConfigQuery.data)

  const draft = draftQuery.data

  useEffect(() => {
    const projectId = draft?.project.id
    if (!projectId) {
      return
    }
    void queryClient.prefetchQuery({
      queryKey: defaultReadmeQueryKey(projectId),
      queryFn: () => fetchProjectReadme(projectId, null, { fresh: false }),
      ...coverReadmeQueryOptions,
    })
  }, [draft?.project.id, queryClient])

  useEffect(() => {
    coverAbortRef.current?.abort()
    coverAbortRef.current = null
    hydratedDraftIdRef.current = null
    setTitle("")
    setBody("")
    setCopyJson(null)
    setCoverCacheBust(null)
    setImageTemplate("minimal-tech")
    setOptimizingRange(null)
    setAnalysisSteps([])
  }, [draftId])

  useEffect(() => {
    if (!draft) {
      return
    }
    if (hydratedDraftIdRef.current === draft.id) {
      return
    }
    hydratedDraftIdRef.current = draft.id
    const migrated = migrateCopyJson(draft.body_json, {
      title: draft.title,
      body: draft.body,
      platform: draft.platform,
    })
    const content = readViewContent(migrated, draft.platform)
    setContentView(draft.platform)
    setTitle(content.title)
    setBody(content.body)
    setCopyJson(migrated)
    if (migrated.image_template) {
      setImageTemplate(migrated.image_template)
    }
  }, [draft])

  useEffect(() => {
    if (
      didPrefillRef.current ||
      draftId != null ||
      !Number.isFinite(prefillProjectId) ||
      prefillProjectId <= 0
    ) {
      return
    }
    didPrefillRef.current = true
    void createContentFactoryDraft(libraryId, { project_id: prefillProjectId })
      .then((created) => {
        navigate(
          `/libraries/${libraryId}/content-factory/project-promotion/${created.id}`,
          { replace: true }
        )
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "创建草稿失败")
      })
  }, [draftId, libraryId, navigate, prefillProjectId])

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["content-factory", libraryId, "drafts"] })
    if (draftId) {
      void queryClient.invalidateQueries({
        queryKey: ["content-factory", libraryId, "draft", draftId],
      })
    }
  }, [draftId, libraryId, queryClient])

  const patchMutation = useMutation({
    mutationFn: (payload: Parameters<typeof patchContentFactoryDraft>[2]) =>
      patchContentFactoryDraft(libraryId, draftId!, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => {
      toast.error(err.message || "保存草稿失败")
    },
  })

  const handleLlmError = useCallback((err: Error) => {
    const msg = err.message
    if (msg.includes("API Key")) {
      toast.error(msg, {
        action: {
          label: "去配置",
          onClick: () => {
            window.location.href = "/settings/ai"
          },
        },
      })
    } else {
      toast.error(msg)
    }
  }, [])

  const applyGeneratedDraft = useCallback(
    (res: Awaited<ReturnType<typeof generateContentFactoryCopy>>, message: string) => {
      if (!res.draft) {
        return
      }
      const view = res.draft.platform
      const migrated = migrateCopyJson(res.draft.body_json, {
        title: res.draft.title,
        body: res.draft.body,
        platform: res.draft.platform,
      })
      const content = readViewContent(migrated, view)
      setCopyJson(migrated)
      setContentView(view)
      setTitle(content.title)
      setBody(content.body)
      invalidate()
      toast.success(message)
    },
    [invalidate]
  )

  const coverMutation = useMutation({
    mutationFn: async (opts: {
      force?: boolean
      freshReadme?: boolean
      draftId: number
      coverSizePresetId: string
    }) => {
      const runId = ++coverRunSeqRef.current
      const releaseMutex = await acquireCoverMutex(coverMutexTailRef)
      try {
        if (runId !== coverRunSeqRef.current) {
          throw new DOMException("封面截图已取消", "AbortError")
        }

        const targetDraftId = opts.draftId
        const outputSize = getCoverOutputSize(opts.coverSizePresetId)
        coverAbortRef.current?.abort()
        const abort = new AbortController()
        coverAbortRef.current = abort
        const { signal } = abort

        const targetDraft = await ensureCoverDraft(queryClient, libraryId, targetDraftId)
        throwIfCoverAborted(signal)
        if (runId !== coverRunSeqRef.current) {
          throw new DOMException("封面截图已取消", "AbortError")
        }

        const readme = await ensureCoverReadme(
          queryClient,
          targetDraft.project.id,
          opts.freshReadme ?? false
        )
        throwIfCoverAborted(signal)
        if (runId !== coverRunSeqRef.current) {
          throw new DOMException("封面截图已取消", "AbortError")
        }

        const sha = readme.github_sha ?? "unknown"
        const storedCopy = targetDraft.body_json as ContentFactoryCopyJson | null
        const readmeVariant = getCoverVariant(
          storedCopy,
          "native-readme",
          opts.coverSizePresetId
        )
        if (
          !opts.force &&
          readmeVariant?.cover_readme_sha === sha &&
          readmeVariant.cover_image_path
        ) {
          return {
            targetDraftId,
            cached: true as const,
            cover_url: contentFactoryCoverUrl(libraryId, targetDraftId, {
              styleId: "native-readme",
              sizePresetId: opts.coverSizePresetId,
              cacheBust: targetDraft.updated_at ?? Date.now(),
            }),
            draft: targetDraft,
            runId,
          }
        }
        const captureHost = coverCaptureHostRef.current
        if (!captureHost) {
          throw new Error("封面截图组件未就绪，请稍后重试。")
        }

        let lastRetryableError: unknown = null
        for (let attempt = 1; attempt <= README_CAPTURE_MAX_ATTEMPTS; attempt += 1) {
          throwIfCoverAborted(signal)
          if (runId !== coverRunSeqRef.current) {
            throw new DOMException("封面截图已取消", "AbortError")
          }
          const reportProgress = createCoverProgressReporter(
            (label) => coverProgressSetterRef.current?.(label),
            attempt,
            README_CAPTURE_MAX_ATTEMPTS
          )
          reportProgress({ phase: "layout", loaded: 0, total: 0 })
          try {
            const captured = await captureHost.capture(
              {
                content: readme.content,
                fullName: targetDraft.project.full_name,
                readmePath: readme.path,
                outputSize,
                onProgress: reportProgress,
              },
              signal
            )
            throwIfCoverAborted(signal)
            if (runId !== coverRunSeqRef.current) {
              throw new DOMException("封面截图已取消", "AbortError")
            }
            coverProgressSetterRef.current?.("正在保存封面…")
            const uploaded = await uploadContentFactoryCover(libraryId, targetDraftId, {
              file: captured.blob,
              readme_sha: sha,
              size_preset_id: opts.coverSizePresetId,
              force: opts.force,
            })
            return { ...uploaded, targetDraftId, runId }
          } catch (err) {
            throwIfCoverAborted(signal)
            if (runId !== coverRunSeqRef.current) {
              throw new DOMException("封面截图已取消", "AbortError")
            }
            const retryable =
              isCaptureTimeoutError(err) ||
              isCaptureIncompleteError(err) ||
              isCaptureEmptyBlobError(err)
            if (retryable && attempt < README_CAPTURE_MAX_ATTEMPTS) {
              lastRetryableError = err
              if (isCaptureIncompleteError(err)) {
              coverProgressSetterRef.current?.(
                `图片未就绪 ${err.stats.loaded}/${err.stats.total}，自动续载（第 ${attempt + 1}/${README_CAPTURE_MAX_ATTEMPTS} 轮）…`
              )
              } else if (isCaptureEmptyBlobError(err)) {
                coverProgressSetterRef.current?.(
                  `截图内容为空，自动重试（第 ${attempt + 1}/${README_CAPTURE_MAX_ATTEMPTS} 轮）…`
                )
              } else {
                const cached = getCaptureImageCacheSize()
              coverProgressSetterRef.current?.(
                cached > 0
                  ? `已从缓存续载 ${cached} 张，继续生成（第 ${attempt + 1}/${README_CAPTURE_MAX_ATTEMPTS} 轮）…`
                  : `加载较慢，自动重试（第 ${attempt + 1}/${README_CAPTURE_MAX_ATTEMPTS} 轮）…`
              )
              }
              await new Promise((resolve) => window.setTimeout(resolve, 200))
              continue
            }
            throw err
          }
        }

        throw (
          lastRetryableError ??
          new Error("封面生成未完成，请检查网络后点击「重新生成」。")
        )
      } finally {
        releaseMutex()
      }
    },
    onSuccess: (res) => {
      if (res.targetDraftId !== activeDraftIdRef.current) {
        return
      }
      if (res.draft.body_json) {
        setCopyJson(res.draft.body_json)
      }
      setImageTemplate("native-readme")
      const bust = res.cover_url.includes("?t=")
        ? res.cover_url.split("?t=")[1]
        : String(Date.now())
      setCoverCacheBust(bust)
      invalidate()
      if (res.runId === coverRunSeqRef.current) {
        toast.success(res.cached ? "已使用缓存封面" : "README 封面已生成")
      }
    },
    onError: (err: unknown) => {
      if (isCoverAbortError(err)) {
        return
      }
      const message =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : typeof err === "string" && err.trim()
            ? err.trim()
            : "封面生成未完成，请检查网络后点击「重新生成」。"
      toast.error(message)
    },
    onSettled: () => {
      if (!coverMutation.isPending) {
        coverProgressSetterRef.current?.(null)
      }
    },
  })

  const aiCoverMutation = useMutation({
    mutationFn: (opts: {
      force?: boolean
      draftId: number
      styleId: string
      sizePresetId: string
    }) =>
      generateContentFactoryAiCover(libraryId, opts.draftId, {
        style_id: opts.styleId,
        size_preset_id: opts.sizePresetId,
        force: opts.force ?? false,
      }),
    onSuccess: (res) => {
      if (res.draft.body_json) {
        setCopyJson(res.draft.body_json as ContentFactoryCopyJson)
      }
      if (res.draft.body_json?.image_template) {
        setImageTemplate(res.draft.body_json.image_template as string)
      }
      const bust = res.cover_url.includes("?t=")
        ? res.cover_url.split("?t=")[1]
        : String(Date.now())
      setCoverCacheBust(bust)
      invalidate()
      toast.success(res.cached ? "已使用缓存封面" : "AI 封面已生成")
    },
    onError: handleLlmError,
  })

  const generateMutation = useMutation({
    mutationFn: (opts: {
      regenerate?: boolean
      platform?: RecommendPlatform
      from_source?: boolean
    } = {}) =>
      generateContentFactoryCopy(libraryId, draftId!, {
        preview_only: false,
        regenerate: opts.regenerate,
        platform: opts.platform,
        from_source: opts.from_source,
      }),
    onSuccess: (res, opts) => {
      applyGeneratedDraft(
        res,
        opts.from_source ? "平台排版已生成" : "全文已重新生成"
      )
    },
    onError: handleLlmError,
  })

  const startAnalysisMutation = useMutation({
    mutationFn: () =>
      runProjectPromotionAnalysis({
        libraryId,
        draftId: draftId!,
        project: draft!.project,
        onStepsChange: setAnalysisSteps,
      }),
    onSuccess: (res) => {
      applyGeneratedDraft(res, "项目分析完成，推荐文案已生成")
    },
    onError: handleLlmError,
  })

  const suggestTitlesMutation = useMutation({
    mutationFn: async () => {
      if (!isPlatformView(contentView)) {
        throw new Error("请在平台排版下使用智能标题")
      }
      if (contentView !== draft!.platform) {
        await patchContentFactoryDraft(libraryId, draftId!, { platform: contentView })
      }
      return generateContentFactoryCopy(libraryId, draftId!, {
        preview_only: true,
        regenerate: true,
      })
    },
    onSuccess: (res) => {
      if (!isPlatformView(contentView)) {
        return
      }
      const options = res.generated_copy.title_options ?? []
      if (options.length === 0) {
        toast.error("未生成标题候选")
        return
      }
      const current = readViewContent(copyJson, contentView)
      const nextJson = writeViewContent(copyJson, contentView, {
        ...current,
        titleOptions: options,
      })
      setCopyJson(nextJson)
      patchMutation.mutate({ body_json: nextJson })
      toast.success(`已生成 ${options.length} 个标题候选`)
    },
    onError: handleLlmError,
  })

  const currentViewContent = useCallback(
    (): ViewContent => ({
      title,
      body,
      titleOptions: isPlatformView(contentView)
        ? (copyJson?.platform_variants?.[contentView]?.title_options ??
          copyJson?.title_options ??
          [])
        : [],
      highlightTags: isPlatformView(contentView)
        ? (copyJson?.platform_variants?.[contentView]?.highlight_tags ??
          copyJson?.highlight_tags ??
          [])
        : [],
    }),
    [body, contentView, copyJson, title]
  )

  const resolveDraftSnapshot = useCallback(
    (
      content: ViewContent,
      nextJson: ContentFactoryCopyJson
    ): { title: string | null; body: string | null } => {
      const bodyText =
        content.body.trim() ||
        nextJson.source_body?.trim() ||
        draft?.body?.trim() ||
        null
      const titleText = content.title.trim() || nextJson.source_title?.trim() || draft?.title || null
      return {
        title: titleText,
        body: bodyText,
      }
    },
    [draft?.body, draft?.title]
  )

  const persistViewContent = useCallback(
    (view: ContentFactoryView, content: ViewContent) => {
      const nextJson = writeViewContent(copyJson, view, content)
      setCopyJson(nextJson)
      if (!draftId) {
        return nextJson
      }
      const snapshot = resolveDraftSnapshot(content, nextJson)
      patchMutation.mutate({
        title: snapshot.title,
        body: snapshot.body,
        body_json: nextJson,
        ...(isPlatformView(view) ? { platform: view } : {}),
        step: 3,
      })
      return nextJson
    },
    [copyJson, draftId, patchMutation, resolveDraftSnapshot]
  )

  const scheduleSaveBody = useCallback(
    (nextBody: string) => {
      setBody(nextBody)
      if (!draftId) {
        return
      }
      if (saveBodyTimerRef.current) {
        clearTimeout(saveBodyTimerRef.current)
      }
      saveBodyTimerRef.current = setTimeout(() => {
        persistViewContent(contentView, { ...currentViewContent(), body: nextBody })
      }, 800)
    },
    [contentView, currentViewContent, draftId, persistViewContent]
  )

  const optimizeSelectionMutation = useMutation({
    mutationFn: (payload: { text: string; start: number; end: number; fullBody: string }) =>
      optimizeContentFactorySelection(libraryId, draftId!, {
        selected_text: payload.text,
        full_body: payload.fullBody,
      }).then((res) => ({ ...res, ...payload })),
    onMutate: (payload) => {
      setOptimizingRange({ start: payload.start, end: payload.end })
    },
    onSettled: () => {
      setOptimizingRange(null)
    },
    onSuccess: (res) => {
      const next =
        res.fullBody.slice(0, res.start) +
        res.optimized_text +
        res.fullBody.slice(res.end)
      scheduleSaveBody(next)
      toast.success("选中内容已优化")
    },
    onError: handleLlmError,
  })

  const scheduleSaveTitle = useCallback(
    (nextTitle: string) => {
      setTitle(nextTitle)
      if (!draftId) {
        return
      }
      if (saveTitleTimerRef.current) {
        clearTimeout(saveTitleTimerRef.current)
      }
      saveTitleTimerRef.current = setTimeout(() => {
        persistViewContent(contentView, { ...currentViewContent(), title: nextTitle })
      }, 800)
    },
    [contentView, currentViewContent, draftId, persistViewContent]
  )

  useEffect(() => {
    const onBeforeUnload = () => {
      if (saveBodyTimerRef.current) {
        clearTimeout(saveBodyTimerRef.current)
        saveBodyTimerRef.current = null
      }
      if (saveTitleTimerRef.current) {
        clearTimeout(saveTitleTimerRef.current)
        saveTitleTimerRef.current = null
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      if (saveBodyTimerRef.current) {
        clearTimeout(saveBodyTimerRef.current)
      }
      if (saveTitleTimerRef.current) {
        clearTimeout(saveTitleTimerRef.current)
      }
    }
  }, [])

  const handleViewChange = (nextView: ContentFactoryView) => {
    if (nextView === contentView) {
      return
    }
    const nextJson = writeViewContent(copyJson, contentView, currentViewContent())
    const nextContent = readViewContent(nextJson, nextView)
    setCopyJson(nextJson)
    setContentView(nextView)
    setTitle(nextContent.title)
    setBody(nextContent.body)

    if (!draftId) {
      return
    }

    const snapshot = resolveDraftSnapshot(nextContent, nextJson)
    const needsLayout = isPlatformView(nextView) && platformVariantNeedsLayout(nextJson, nextView)

    if (needsLayout) {
      patchMutation.mutate(
        {
          body_json: nextJson,
          title: snapshot.title,
          body: snapshot.body,
          step: Math.max(draft?.step ?? 1, 3),
        },
        {
          onSuccess: () => {
            generateMutation.mutate({ platform: nextView, from_source: true })
          },
        }
      )
      return
    }

    patchMutation.mutate({
      body_json: nextJson,
      title: snapshot.title,
      body: snapshot.body,
      ...(isPlatformView(nextView)
        ? { platform: nextView, step: Math.max(draft?.step ?? 1, 3) }
        : {}),
    })
  }

  const handleCoverSizePresetChange = useCallback(
    (presetId: string) => {
      if (presetId === coverSizePresetId) {
        return
      }
      setCoverSizePresetId(presetId)
      storeCoverSizePresetId(presetId)
      if (!draftId || imageTemplate !== "native-readme") {
        return
      }
      // 延后一帧再截图，避免与 Popover 关闭同 tick 同步重排导致白屏
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          coverMutation.mutate({ force: true, draftId, coverSizePresetId: presetId })
        })
      })
    },
    [coverMutation, coverSizePresetId, draftId, imageTemplate]
  )

  const handleTemplateChange = (tpl: string) => {
    setImageTemplate(tpl)
    if (!draftId) {
      return
    }
    const nextJson = {
      ...(copyJson ?? {}),
      image_template: tpl,
    }
    setCopyJson(nextJson)
    patchMutation.mutate({ body_json: nextJson })
    if (tpl === "native-readme" && !hasCoverVariant(copyJson, tpl, coverSizePresetId)) {
      coverMutation.mutate({ force: false, draftId, coverSizePresetId })
    }
  }

  const runAiCoverGeneration = useCallback(
    (force: boolean) => {
      if (!draftId) {
        return
      }
      if (!recommendImageReady) {
        toast.error("请先在设置 → AI 配置推荐配图 API Key", {
          action: {
            label: "去配置",
            onClick: () => {
              window.location.href = "/settings/ai"
            },
          },
        })
        return
      }
      aiCoverMutation.mutate({
        force,
        draftId,
        styleId: imageTemplate,
        sizePresetId: coverSizePresetId,
      })
    },
    [
      aiCoverMutation,
      coverSizePresetId,
      draftId,
      imageTemplate,
      recommendImageReady,
    ]
  )

  const activeCoverVariant = useMemo(
    () => getCoverVariant(copyJson, imageTemplate, coverSizePresetId),
    [copyJson, coverSizePresetId, imageTemplate]
  )

  const handleDownloadCover = () => {
    if (!draftId || !activeCoverVariant?.cover_image_path) {
      return
    }
    const url = contentFactoryCoverUrl(libraryId, draftId, {
      styleId: imageTemplate,
      sizePresetId: coverSizePresetId,
      cacheBust: coverCacheBust ?? draft?.updated_at ?? Date.now(),
    })
    const anchor = document.createElement("a")
    anchor.href = url
    const suffix =
      imageTemplate === "native-readme" ? "readme" : imageTemplate || "ai"
    anchor.download = `${draft?.project.name ?? "cover"}-${suffix}.png`
    anchor.click()
  }

  const handleRevealCoverInFolder = useCallback(async () => {
    if (!draftId || !activeCoverVariant?.cover_image_path) {
      return
    }
    try {
      await revealContentFactoryCover(libraryId, draftId, {
        styleId: imageTemplate,
        sizePresetId: coverSizePresetId,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "无法打开文件所在位置")
    }
  }, [
    activeCoverVariant?.cover_image_path,
    coverSizePresetId,
    draftId,
    imageTemplate,
    libraryId,
  ])

  const coverPreviewUrl = useMemo(() => {
    if (!draftId) {
      return null
    }
    if (!activeCoverVariant?.cover_image_path) {
      return null
    }
    return contentFactoryCoverUrl(libraryId, draftId, {
      styleId: imageTemplate,
      sizePresetId: coverSizePresetId,
      cacheBust: coverCacheBust ?? draft?.updated_at ?? undefined,
    })
  }, [
    activeCoverVariant?.cover_image_path,
    coverCacheBust,
    coverSizePresetId,
    draft?.updated_at,
    draftId,
    imageTemplate,
    libraryId,
  ])

  const handleCoverImageLoaded = useCallback(() => {
    if (activeCoverVariant?.cover_image_path) {
      return
    }
    if (imageTemplate === "native-readme") {
      return
    }
    invalidate()
  }, [activeCoverVariant?.cover_image_path, imageTemplate, invalidate])

  const activeTitleOptions = isPlatformView(contentView)
    ? (copyJson?.platform_variants?.[contentView]?.title_options ?? copyJson?.title_options ?? [])
    : []

  const activeHighlightTags = isPlatformView(contentView)
    ? (copyJson?.platform_variants?.[contentView]?.highlight_tags ?? copyJson?.highlight_tags ?? [])
    : []

  const handleTagClick = (tag: string) => {
    const hashtag = `#${tag.replace(/^#/, "").trim()}`
    if (!hashtag || hashtag === "#") {
      return
    }
    if (body.includes(hashtag)) {
      toast.info("正文中已包含该话题标签")
      return
    }
    const trimmed = body.trimEnd()
    const next = trimmed ? `${trimmed} ${hashtag}` : hashtag
    scheduleSaveBody(next)
    scrollBodyToEnd(copyPanelRef)
    toast.success("已添加到正文")
  }

  const createFromPicker = useMutation({
    mutationFn: (projectId: number) =>
      createContentFactoryDraft(libraryId, { project_id: projectId }),
    onSuccess: (created) => {
      invalidate()
      navigate(`/libraries/${libraryId}/content-factory/project-promotion/${created.id}`)
      setPickerOpen(false)
    },
  })

  if (!draftId || !Number.isFinite(draftId)) {
    return <EmptyPromotionState libraryId={libraryId} />
  }

  if (draftQuery.isLoading) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">加载草稿…</p>
    )
  }

  if (draftQuery.isError || !draft) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground text-sm">草稿不存在或已删除</p>
        <Button type="button" variant="link" size="sm" className="mt-2" asChild>
          <Link to={`/libraries/${libraryId}/content-factory/project-promotion`}>
            返回列表
          </Link>
        </Button>
      </div>
    )
  }

  const hasWorkbench = draftHasWorkbenchContent(draft, copyJson)
  const currentStep = draft.step >= 4 ? 4 : hasWorkbench ? Math.max(draft.step, 3) : draft.step
  const showInitialGenerate = currentStep <= 2 && !hasWorkbench

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <PromotionProjectHeader project={draft.project} />

      <PromotionStepper currentStep={currentStep} />

      {showInitialGenerate ? (
        <PromotionAnalysisStart
          running={startAnalysisMutation.isPending}
          steps={analysisSteps}
          onStart={() => startAnalysisMutation.mutate()}
        />
      ) : (
        <div className="grid min-h-[480px] gap-4 lg:grid-cols-2">
          <div className="flex min-h-0 flex-col gap-3">
            <PromotionCopyPanel
              ref={copyPanelRef}
              contentView={contentView}
              title={title}
              titleOptions={activeTitleOptions}
              body={body}
              regenerating={generateMutation.isPending}
              optimizing={optimizeSelectionMutation.isPending}
              optimizingRange={optimizingRange}
              suggestingTitles={suggestTitlesMutation.isPending}
              onViewChange={handleViewChange}
              onTitleChange={scheduleSaveTitle}
              onSuggestTitles={() => suggestTitlesMutation.mutate()}
              onBodyChange={scheduleSaveBody}
              onRegenerate={() => {
                if (!isPlatformView(contentView)) {
                  toast.error("请切换到平台排版后再重新生成")
                  return
                }
                generateMutation.mutate({
                  regenerate: true,
                  platform: contentView,
                  from_source: Boolean(copyJson?.source_body?.trim()),
                })
              }}
              onOptimizeSelection={(selection) =>
                optimizeSelectionMutation.mutate({ ...selection, fullBody: body })
              }
              exportDraft={{ ...draft, title: title || null, body }}
            />
            {isPlatformView(contentView) ? (
              <PromotionHighlightTags tags={activeHighlightTags} onTagClick={handleTagClick} />
            ) : null}
          </div>
          <PromotionImagePanel
            project={draft.project}
            copy={copyJson}
            selectedTemplate={imageTemplate}
            styleOptions={styleOptions}
            coverUrl={coverPreviewUrl}
            onCoverImageLoad={handleCoverImageLoaded}
            recommendImageReady={recommendImageReady}
            coverGenerating={
              coverMutation.isPending &&
              coverMutation.variables?.draftId === draftId
            }
            aiCoverGenerating={
              aiCoverMutation.isPending &&
              aiCoverMutation.variables?.draftId === draftId
            }
            coverProgressSetterRef={coverProgressSetterRef}
            coverSizePresetId={coverSizePresetId}
            onCoverSizePresetChange={handleCoverSizePresetChange}
            onTemplateChange={handleTemplateChange}
            onRegenerateCover={() => {
              if (imageTemplate === "native-readme") {
                coverMutation.mutate({
                  force: true,
                  freshReadme: true,
                  draftId,
                  coverSizePresetId,
                })
                return
              }
              runAiCoverGeneration(true)
            }}
            onGenerateAiCover={() => runAiCoverGeneration(false)}
            onDownloadCover={handleDownloadCover}
            onRevealCoverInFolder={handleRevealCoverInFolder}
            onOpenStyleManage={() => setStyleManageOpen(true)}
          />
        </div>
      )}

      <CoverStyleManageDialog
        open={styleManageOpen}
        onOpenChange={setStyleManageOpen}
        libraryId={libraryId}
      />

      <ProjectPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        libraryId={libraryId}
        loading={createFromPicker.isPending}
        onSelect={(id) => createFromPicker.mutate(id)}
      />

      <ReadmeCoverCaptureErrorBoundary>
        <ReadmeCoverCaptureHost ref={coverCaptureHostRef} />
      </ReadmeCoverCaptureErrorBoundary>
    </div>
  )
}
