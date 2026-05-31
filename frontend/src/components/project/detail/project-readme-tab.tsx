import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ExternalLink as ExternalLinkIcon, Loader2, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { toast } from "sonner"

import { ExternalLink } from "@/components/common/external-link"
import { MarkdownBlockSkeleton } from "@/components/project/detail/markdown-block-skeleton"
import { MarkdownContent } from "@/components/project/detail/markdown-content"
import { ReadmeTocPanel } from "@/components/project/detail/readme-toc-panel"
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
import { GithubSettingsButton } from "@/components/common/github-settings-link"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Textarea } from "@/components/ui/textarea"
import { parseApiErrorMessage } from "@/lib/api-error"
import { useProjectReadmeStatus } from "@/context/project-github-cache"
import { extractMarkdownHeadings, syncDomMarkdownHeadings, type MarkdownHeading } from "@/lib/markdown-toc"
import { invalidateProjectRelated } from "@/lib/invalidate-project-queries"
import { fetchProjectReadme } from "@/lib/project-readme"
import {
  detectFailedReadmeBlockIndices,
  fetchReadmeBlocks,
  joinReadmeBlocks,
  README_BLOCK_TRANSLATE_DELAY_MS,
  readmeBlockNeedsTranslation,
  splitReadmeTranslatedBlocks,
  translateReadmeBlockWithRetry,
} from "@/lib/project-translate"
import type { Project } from "@/types/project"

export type ProjectReadmeTabProps = {
  project: Project
  enabled: boolean
}

type ReadmeView = "source" | "translated"

type ReadmeBlockChunk = {
  source: string
  translated?: string
  status: "pending" | "loading" | "done" | "error"
  /** 重试后仍失败，已回退为原文 */
  fallback?: boolean
}

type ReadmeTranslateMode = "full" | "retry-failed"

export function ProjectReadmeTab({ project, enabled }: ProjectReadmeTabProps) {
  const queryClient = useQueryClient()
  const { syncState: readmeSyncState, defaultReadmeQuery, syncFromGithub } =
    useProjectReadmeStatus()
  const [view, setView] = useState<ReadmeView>("source")
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(project.readme_translated ?? "")
  const [dirty, setDirty] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [retranslateOpen, setRetranslateOpen] = useState(false)
  const [retryFailedCount, setRetryFailedCount] = useState(0)
  const [translating, setTranslating] = useState(false)
  const [progressiveChunks, setProgressiveChunks] = useState<ReadmeBlockChunk[] | null>(null)
  const [readmePath, setReadmePath] = useState<string | null>(null)
  const [tocOpen, setTocOpen] = useState(true)
  const [tocEdgeHover, setTocEdgeHover] = useState(false)
  const [tocHeadings, setTocHeadings] = useState<MarkdownHeading[]>([])
  const translateRunRef = useRef(0)
  const autoTranslateTriggeredRef = useRef(false)
  const readmeContentRef = useRef<HTMLDivElement>(null)
  const readmeLayoutRef = useRef<HTMLDivElement>(null)

  const isDefaultReadme = readmePath === null
  const readmeQueryKey = readmePath ?? "default"

  const subPathQuery = useQuery({
    queryKey: ["projects", project.id, "readme", readmeQueryKey],
    queryFn: () => fetchProjectReadme(project.id, readmePath, { fresh: false }),
    enabled: enabled && !isDefaultReadme,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })

  const sourceQuery = isDefaultReadme ? defaultReadmeQuery : subPathQuery

  const readmeBasePath = readmePath ?? sourceQuery.data?.path ?? null

  const handleReadmeNavigate = useCallback(
    (path: string) => {
      if (path === readmePath) {
        return
      }
      if (view === "translated") {
        setView("source")
        toast.message("已切换文稿", {
          description: "此文稿仅显示 GitHub 原文；机器翻译针对仓库默认 README。",
        })
      }
      setReadmePath(path)
      setEditing(false)
      setSaveError(null)
      setProgressiveChunks(null)
      translateRunRef.current += 1
    },
    [readmePath, view]
  )

  useEffect(() => {
    setView("source")
    setReadmePath(null)
    setEditing(false)
    setDraft(project.readme_translated ?? "")
    setDirty(false)
    setSaveError(null)
    setTranslating(false)
    setProgressiveChunks(null)
    translateRunRef.current += 1
    autoTranslateTriggeredRef.current = false
  }, [project.id])

  useEffect(() => {
    if (!isDefaultReadme && view === "translated") {
      setView("source")
    }
  }, [isDefaultReadme, view])

  useEffect(() => {
    if (!editing && !dirty && !translating) {
      setDraft(project.readme_translated ?? "")
    }
  }, [project.readme_translated, editing, dirty, translating])

  const saveMutation = useMutation({
    mutationFn: async (readmeTranslated: string): Promise<Project> => {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readme_translated: readmeTranslated.trim() || null }),
      })
      if (!res.ok) {
        throw new Error(await parseApiErrorMessage(res))
      }
      return res.json() as Promise<Project>
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(["projects", "detail", project.id], data)
      await invalidateProjectRelated(queryClient, project.id)
      setDraft(data.readme_translated ?? "")
      setDirty(false)
      setSaveError(null)
      setEditing(false)
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : "保存失败")
    },
  })

  const startProgressiveTranslate = useCallback(
    async (mode: ReadmeTranslateMode = "full") => {
      if (!isDefaultReadme) {
        toast.message("仅默认 README 支持机器翻译")
        return
      }
      const runId = ++translateRunRef.current
      setTranslating(true)
      setView("translated")
      setEditing(false)
      setRetranslateOpen(false)
      setProgressiveChunks(null)

      try {
        const sourceBlocks = await fetchReadmeBlocks(project.id)
        if (runId !== translateRunRef.current) return
        if (sourceBlocks.length === 0) {
          throw new Error("README 为空，无法翻译。")
        }

        let resultBlocks: string[]
        let indicesToTranslate: number[]

        if (mode === "retry-failed") {
          const saved = project.readme_translated?.trim()
          if (!saved) {
            throw new Error("尚无译文，无法重试失败段落。")
          }
          const parts = splitReadmeTranslatedBlocks(saved, sourceBlocks.length)
          if (!parts) {
            throw new Error("译文结构与分段不一致，请使用「全文重新翻译」。")
          }
          indicesToTranslate = detectFailedReadmeBlockIndices(sourceBlocks, parts)
          if (indicesToTranslate.length === 0) {
            toast.info("没有检测到失败段落。")
            return
          }
          resultBlocks = [...parts]
        } else {
          resultBlocks = []
          indicesToTranslate = []
        }

        const initial: ReadmeBlockChunk[] = sourceBlocks.map((source, index) => {
          if (mode === "retry-failed") {
            const needsRetry = indicesToTranslate.includes(index)
            return {
              source,
              status: needsRetry ? "pending" : "done",
              translated: resultBlocks[index],
              fallback: needsRetry,
            }
          }
          const needsTranslation = readmeBlockNeedsTranslation(source)
          return {
            source,
            status: needsTranslation ? "pending" : "done",
            translated: needsTranslation ? undefined : source,
          }
        })
        setProgressiveChunks(initial)

        let failedBlockCount = 0
        let translatedRequestCount = 0

        for (let i = 0; i < sourceBlocks.length; i += 1) {
          if (runId !== translateRunRef.current) return
          const source = sourceBlocks[i]!

          if (mode === "retry-failed") {
            if (!indicesToTranslate.includes(i)) continue
          } else if (!readmeBlockNeedsTranslation(source)) {
            resultBlocks.push(source)
            continue
          }

          if (translatedRequestCount > 0) {
            await new Promise((resolve) => {
              window.setTimeout(resolve, README_BLOCK_TRANSLATE_DELAY_MS)
            })
            if (runId !== translateRunRef.current) return
          }
          translatedRequestCount += 1

          setProgressiveChunks((prev) =>
            prev?.map((chunk, index) =>
              index === i ? { ...chunk, status: "loading" } : chunk
            ) ?? prev
          )

          try {
            const translated = await translateReadmeBlockWithRetry(project.id, source)
            if (runId !== translateRunRef.current) return
            if (mode === "retry-failed") {
              resultBlocks[i] = translated
            } else {
              resultBlocks.push(translated)
            }
            setProgressiveChunks((prev) =>
              prev?.map((chunk, index) =>
                index === i ? { ...chunk, status: "done", translated, fallback: false } : chunk
              ) ?? prev
            )
          } catch {
            if (runId !== translateRunRef.current) return
            failedBlockCount += 1
            if (mode === "retry-failed") {
              resultBlocks[i] = source
            } else {
              resultBlocks.push(source)
            }
            setProgressiveChunks((prev) =>
              prev?.map((chunk, index) =>
                index === i
                  ? { ...chunk, status: "done", translated: source, fallback: true }
                  : chunk
              ) ?? prev
            )
          }
        }

        const full = joinReadmeBlocks(resultBlocks)
        const saved = await saveMutation.mutateAsync(full)
        if (runId !== translateRunRef.current) return
        queryClient.setQueryData(["projects", "detail", project.id], saved)
        await invalidateProjectRelated(queryClient, project.id)
        setDraft(saved.readme_translated ?? "")
        setView("translated")
        setProgressiveChunks(null)
        if (mode === "retry-failed") {
          if (failedBlockCount > 0) {
            toast.warning(`仍有 ${failedBlockCount} 段失败，已保留原文。`)
          } else {
            toast.success("失败段落已重新翻译")
          }
        } else if (failedBlockCount > 0) {
          toast.warning(`有 ${failedBlockCount} 段翻译失败，已保留原文；可稍后重试失败段落。`)
        } else {
          toast.success("README 翻译已完成")
        }
      } catch (err) {
        if (runId !== translateRunRef.current) return
        toast.error(err instanceof Error ? err.message : "翻译失败")
      } finally {
        if (runId === translateRunRef.current) {
          setTranslating(false)
        }
      }
    },
    [isDefaultReadme, project.id, project.readme_translated, queryClient, saveMutation]
  )

  const openRetranslateDialog = useCallback(async () => {
    if (!project.readme_translated?.trim()) {
      setRetryFailedCount(0)
      setRetranslateOpen(true)
      return
    }
    try {
      const sourceBlocks = await fetchReadmeBlocks(project.id)
      const parts = splitReadmeTranslatedBlocks(
        project.readme_translated.trim(),
        sourceBlocks.length
      )
      setRetryFailedCount(
        parts ? detectFailedReadmeBlockIndices(sourceBlocks, parts).length : 0
      )
    } catch {
      setRetryFailedCount(0)
    }
    setRetranslateOpen(true)
  }, [project.id, project.readme_translated])

  const handleSave = useCallback(() => {
    saveMutation.mutate(draft)
  }, [draft, saveMutation])

  const hasTranslated = isDefaultReadme && Boolean(project.readme_translated?.trim())
  const showProgressive = Boolean(progressiveChunks?.length)
  const sourceReady = !sourceQuery.isLoading && !sourceQuery.isError

  const markdownNavProps = {
    githubUrl: project.github_url,
    readmeBasePath,
    onReadmeNavigate: handleReadmeNavigate,
    enableHtml: true,
  }

  const tocMarkdown = useMemo(() => {
    if (editing) return ""
    if (view === "source") {
      if (sourceQuery.isLoading || sourceQuery.isError) return ""
      return sourceQuery.data?.content?.trim() ?? ""
    }
    if (showProgressive && progressiveChunks?.length) {
      return progressiveChunks
        .map((chunk) =>
          chunk.status === "done" && chunk.translated !== undefined ? chunk.translated : chunk.source
        )
        .join("\n\n")
    }
    if (translating && !hasTranslated) {
      return sourceQuery.data?.content?.trim() ?? ""
    }
    return project.readme_translated?.trim() ?? ""
  }, [
    editing,
    view,
    sourceQuery.isLoading,
    sourceQuery.isError,
    sourceQuery.data?.content,
    showProgressive,
    progressiveChunks,
    translating,
    hasTranslated,
    project.readme_translated,
  ])

  useLayoutEffect(() => {
    const root = readmeContentRef.current
    if (!root || editing || !tocMarkdown) {
      setTocHeadings([])
      return
    }

    const sync = () => {
      const synced = syncDomMarkdownHeadings(root)
      setTocHeadings(synced.length > 0 ? synced : extractMarkdownHeadings(tocMarkdown))
    }

    sync()
    const raf = window.requestAnimationFrame(sync)
    return () => window.cancelAnimationFrame(raf)
  }, [tocMarkdown, editing, view, readmePath, showProgressive, progressiveChunks, translating])

  const showToc = tocHeadings.length > 0

  const handleReadmeLayoutMouseMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!showToc) {
        setTocEdgeHover(false)
        return
      }
      const rect = readmeLayoutRef.current?.getBoundingClientRect()
      if (!rect) return
      const tocPanelWidth = window.matchMedia("(min-width: 640px)").matches ? 224 : 208
      const boundaryX = tocOpen ? rect.right - tocPanelWidth : rect.right
      setTocEdgeHover(Math.abs(event.clientX - boundaryX) <= 48)
    },
    [showToc, tocOpen]
  )

  const handleViewChange = useCallback((next: string) => {
    if (next === "translated" && !isDefaultReadme) {
      toast.message("机器翻译仅适用于仓库默认 README")
      return
    }
    if (next === "source" || next === "translated") {
      setView(next)
      setEditing(false)
      setSaveError(null)
    }
  }, [isDefaultReadme])

  useEffect(() => {
    if (view !== "translated") {
      autoTranslateTriggeredRef.current = false
      return
    }
    if (
      !isDefaultReadme ||
      hasTranslated ||
      translating ||
      showProgressive ||
      !sourceReady ||
      autoTranslateTriggeredRef.current
    ) {
      return
    }
    if (!sourceQuery.data?.content?.trim()) return
    autoTranslateTriggeredRef.current = true
    void startProgressiveTranslate("full")
  }, [
    view,
    isDefaultReadme,
    hasTranslated,
    translating,
    showProgressive,
    sourceReady,
    sourceQuery.data?.content,
    startProgressiveTranslate,
  ])

  const handleStartTranslate = useCallback(() => {
    if (!hasTranslated) {
      void startProgressiveTranslate("full")
      return
    }
    void openRetranslateDialog()
  }, [hasTranslated, openRetranslateDialog, startProgressiveTranslate])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s" && view === "translated" && editing) {
        e.preventDefault()
        if (dirty && !saveMutation.isPending) {
          handleSave()
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [dirty, editing, handleSave, saveMutation.isPending, view])

  const renderProgressiveTranslation = () => {
    if (!progressiveChunks?.length) return null
    return (
      <div className="space-y-6">
        {progressiveChunks.map((chunk, index) => (
          <div key={`${index}-${chunk.source.slice(0, 24)}`}>
            {chunk.status === "done" && chunk.translated !== undefined ? (
              chunk.fallback ? (
                <div className="space-y-1">
                  <MarkdownContent content={chunk.translated} {...markdownNavProps} />
                  <p className="text-muted-foreground text-xs">本段翻译失败，已保留原文</p>
                </div>
              ) : (
                <MarkdownContent content={chunk.translated} {...markdownNavProps} />
              )
            ) : chunk.status === "error" ? (
              <p className="text-destructive text-sm">本段翻译失败</p>
            ) : (
              <MarkdownBlockSkeleton source={chunk.source} />
            )}
          </div>
        ))}
      </div>
    )
  }

  const renderSource = () => {
    if (sourceQuery.isLoading) {
      return (
        <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          正在加载 README…
        </div>
      )
    }

    if (sourceQuery.isError) {
      const msg = (sourceQuery.error as Error).message || "加载失败"
      const is424 = msg.includes("Token") || msg.includes("GitHub")
      return (
        <div className="text-muted-foreground border-border rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-destructive text-sm">{msg}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {is424 ? (
              <GithubSettingsButton variant="outline" size="sm">
                配置 GitHub Token
              </GithubSettingsButton>
            ) : (
              <Button variant="outline" size="sm" onClick={() => void sourceQuery.refetch()}>
                重试
              </Button>
            )}
            <Button variant="ghost" size="sm" asChild>
              <ExternalLink href={project.github_url}>
                <ExternalLinkIcon className="size-4" aria-hidden />
                在 GitHub 查看
              </ExternalLink>
            </Button>
          </div>
        </div>
      )
    }

    const content = sourceQuery.data?.content?.trim()
    if (!content) {
      return (
        <p className="text-muted-foreground border-border rounded-xl border border-dashed px-6 py-10 text-center text-sm">
          该仓库暂无 README。
        </p>
      )
    }

    return <MarkdownContent content={content} {...markdownNavProps} />
  }

  const renderTranslated = () => {
    if (showProgressive) {
      return renderProgressiveTranslation()
    }

    if (!hasTranslated && !translating) {
      if (!sourceReady) {
        return (
          <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            正在准备翻译…
          </div>
        )
      }
      if (!sourceQuery.data?.content?.trim()) {
        return (
          <p className="text-muted-foreground border-border rounded-xl border border-dashed px-6 py-10 text-center text-sm">
            该仓库暂无 README，无法翻译。
          </p>
        )
      }
      return (
        <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          正在开始翻译…
        </div>
      )
    }

    if (translating && !hasTranslated && !showProgressive) {
      return (
        <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          正在准备分段翻译…
        </div>
      )
    }

    if (editing) {
      return (
        <div className="flex min-h-[280px] flex-col">
          <Textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setDirty(true)
              setSaveError(null)
            }}
            className="min-h-[320px] flex-1 resize-y font-mono text-sm leading-relaxed"
            spellCheck={false}
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
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft(project.readme_translated ?? "")
                  setDirty(false)
                  setEditing(false)
                  setSaveError(null)
                }}
              >
                取消
              </Button>
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

    return <MarkdownContent content={project.readme_translated!.trim()} {...markdownNavProps} />
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={readmeLayoutRef}
            className="group/readme-layout relative flex min-h-[12rem] items-start gap-0"
            onMouseMove={handleReadmeLayoutMouseMove}
            onMouseLeave={() => setTocEdgeHover(false)}
          >
            <div ref={readmeContentRef} className="min-w-0 flex-1 outline-none">
              {view === "source" ? renderSource() : renderTranslated()}
            </div>
            {showToc ? (
              <ReadmeTocPanel
                headings={tocHeadings}
                open={tocOpen}
                onOpenChange={setTocOpen}
                scrollContainerRef={readmeContentRef}
                pillVisible={tocEdgeHover}
              />
            ) : null}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuRadioGroup value={view} onValueChange={handleViewChange}>
            <ContextMenuRadioItem value="source">显示原文</ContextMenuRadioItem>
            <ContextMenuRadioItem value="translated" disabled={!isDefaultReadme}>
              显示译文
            </ContextMenuRadioItem>
          </ContextMenuRadioGroup>
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={!isDefaultReadme || sourceQuery.isLoading || readmeSyncState === "syncing"}
            onSelect={() => void syncFromGithub({ manual: true })}
          >
            <span className="flex items-center gap-2">
              <RefreshCw className="size-3.5" aria-hidden />
              从 GitHub 刷新
            </span>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!isDefaultReadme || !hasTranslated || translating || showProgressive}
            onSelect={() => {
              setView("translated")
              setEditing(true)
              setSaveError(null)
            }}
          >
            编辑译文
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!isDefaultReadme || !sourceReady || translating}
            onSelect={handleStartTranslate}
          >
            {translating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                翻译中…
              </span>
            ) : hasTranslated ? (
              "重新翻译"
            ) : (
              "翻译 README"
            )}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={retranslateOpen} onOpenChange={setRetranslateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重新翻译 README</AlertDialogTitle>
            <AlertDialogDescription>
              {retryFailedCount > 0
                ? `检测到 ${retryFailedCount} 段仍为原文（翻译失败或未译）。可仅重试这些段落，或全文重新翻译（会覆盖手动编辑）。`
                : "将逐段重新翻译并覆盖当前保存的 README 译文（含手动编辑内容）。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel>取消</AlertDialogCancel>
            {retryFailedCount > 0 ? (
              <AlertDialogAction onClick={() => void startProgressiveTranslate("retry-failed")}>
                重试失败段落（{retryFailedCount}）
              </AlertDialogAction>
            ) : null}
            <AlertDialogAction onClick={() => void startProgressiveTranslate("full")}>
              全文重新翻译
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
