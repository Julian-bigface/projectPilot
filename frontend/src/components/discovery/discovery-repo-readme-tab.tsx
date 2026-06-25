import { useQuery } from "@tanstack/react-query"
import { ExternalLink as ExternalLinkIcon, Loader2 } from "lucide-react"
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { toast } from "sonner"

import { ExternalLink } from "@/components/common/external-link"
import { MarkdownBlockSkeleton } from "@/components/project/detail/markdown-block-skeleton"
import { MarkdownContent } from "@/components/project/detail/markdown-content"
import { ReadmeTocPanel } from "@/components/project/detail/readme-toc-panel"
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
import { fetchDiscoveryRepoReadme } from "@/lib/discovery-repo-readme"
import {
  fetchEphemeralReadmeBlocks,
  joinReadmeBlocks,
  README_BLOCK_TRANSLATE_DELAY_MS,
  readmeBlockNeedsTranslation,
  translateEphemeralReadmeBlockWithRetry,
} from "@/lib/ephemeral-readme-translate"
import { extractMarkdownHeadings, syncDomMarkdownHeadings, type MarkdownHeading } from "@/lib/markdown-toc"

export type DiscoveryRepoReadmeTabProps = {
  owner: string
  repo: string
  githubUrl: string
  enabled: boolean
}

type ReadmeView = "source" | "translated"

type ReadmeBlockChunk = {
  source: string
  translated?: string
  status: "pending" | "loading" | "done" | "error"
  fallback?: boolean
}

export function DiscoveryRepoReadmeTab({
  owner,
  repo,
  githubUrl,
  enabled,
}: DiscoveryRepoReadmeTabProps) {
  const [readmePath, setReadmePath] = useState<string | null>(null)
  const [view, setView] = useState<ReadmeView>("source")
  const [translatedMarkdown, setTranslatedMarkdown] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const [progressiveChunks, setProgressiveChunks] = useState<ReadmeBlockChunk[] | null>(null)
  const [tocOpen, setTocOpen] = useState(true)
  const [tocEdgeHover, setTocEdgeHover] = useState(false)
  const [tocHeadings, setTocHeadings] = useState<MarkdownHeading[]>([])
  const readmeContentRef = useRef<HTMLDivElement>(null)
  const readmeLayoutRef = useRef<HTMLDivElement>(null)
  const translateRunRef = useRef(0)

  const isDefaultReadme = readmePath === null
  const readmeQueryKey = readmePath ?? "default"

  const query = useQuery({
    queryKey: ["discovery", owner, repo, "readme", readmeQueryKey],
    queryFn: () => fetchDiscoveryRepoReadme(owner, repo, { path: readmePath, fresh: false }),
    enabled: enabled && (isDefaultReadme || Boolean(readmePath)),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const readmeBasePath = readmePath ?? query.data?.path ?? null
  const sourceContent = query.data?.content?.trim() ?? ""
  const hasTranslated = Boolean(translatedMarkdown?.trim())
  const showProgressive = Boolean(progressiveChunks?.length)

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
      setTranslatedMarkdown(null)
      setProgressiveChunks(null)
      translateRunRef.current += 1
    },
    [readmePath, view]
  )

  const markdownNavProps = {
    githubUrl,
    readmeBasePath,
    onReadmeNavigate: handleReadmeNavigate,
    enableHtml: true,
  }

  const startProgressiveTranslate = useCallback(async () => {
    if (!isDefaultReadme) {
      toast.message("仅默认 README 支持机器翻译")
      return
    }
    const content = sourceContent
    if (!content) {
      toast.error("README 为空，无法翻译。")
      return
    }

    const runId = ++translateRunRef.current
    setTranslating(true)
    setView("translated")
    setProgressiveChunks(null)
    setTranslatedMarkdown(null)

    try {
      const sourceBlocks = await fetchEphemeralReadmeBlocks(content)
      if (runId !== translateRunRef.current) return
      if (sourceBlocks.length === 0) {
        throw new Error("README 为空，无法翻译。")
      }

      const initial: ReadmeBlockChunk[] = sourceBlocks.map((source) => {
        const needsTranslation = readmeBlockNeedsTranslation(source)
        return {
          source,
          status: needsTranslation ? "pending" : "done",
          translated: needsTranslation ? undefined : source,
        }
      })
      setProgressiveChunks(initial)

      const resultBlocks: string[] = []
      let translatedRequestCount = 0

      for (let i = 0; i < sourceBlocks.length; i += 1) {
        if (runId !== translateRunRef.current) return
        const source = sourceBlocks[i]!
        if (!readmeBlockNeedsTranslation(source)) {
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
          prev?.map((chunk, index) => (index === i ? { ...chunk, status: "loading" } : chunk)) ?? prev
        )

        try {
          const translated = await translateEphemeralReadmeBlockWithRetry(source)
          if (runId !== translateRunRef.current) return
          resultBlocks.push(translated)
          setProgressiveChunks((prev) =>
            prev?.map((chunk, index) =>
              index === i ? { ...chunk, status: "done", translated } : chunk
            ) ?? prev
          )
        } catch {
          if (runId !== translateRunRef.current) return
          resultBlocks.push(source)
          setProgressiveChunks((prev) =>
            prev?.map((chunk, index) =>
              index === i
                ? { ...chunk, status: "done", translated: source, fallback: true }
                : chunk
            ) ?? prev
          )
        }
      }

      if (runId !== translateRunRef.current) return
      setTranslatedMarkdown(joinReadmeBlocks(resultBlocks))
      setProgressiveChunks(null)
    } catch (err) {
      if (runId !== translateRunRef.current) return
      setView("source")
      toast.error((err as Error).message || "翻译失败")
    } finally {
      if (runId === translateRunRef.current) {
        setTranslating(false)
      }
    }
  }, [isDefaultReadme, sourceContent])

  const handleViewChange = useCallback(
    (next: string) => {
      if (next === "translated" && !isDefaultReadme) {
        toast.message("机器翻译仅适用于仓库默认 README")
        return
      }
      if (next === "source" || next === "translated") {
        setView(next)
      }
    },
    [isDefaultReadme]
  )

  const tocMarkdown = useMemo(() => {
    if (view === "translated") {
      if (showProgressive && progressiveChunks) {
        return joinReadmeBlocks(
          progressiveChunks
            .filter((chunk) => chunk.translated != null)
            .map((chunk) => chunk.translated!)
        )
      }
      return translatedMarkdown ?? ""
    }
    if (query.isLoading || query.isError) {
      return ""
    }
    return sourceContent
  }, [
    view,
    showProgressive,
    progressiveChunks,
    translatedMarkdown,
    query.isLoading,
    query.isError,
    sourceContent,
  ])

  useLayoutEffect(() => {
    const root = readmeContentRef.current
    if (!root || !tocMarkdown) {
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
  }, [tocMarkdown, readmePath, view, showProgressive, progressiveChunks, translating])

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
    if (query.isLoading) {
      return (
        <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          正在加载 README…
        </div>
      )
    }

    if (query.isError) {
      const msg = (query.error as Error).message || "加载失败"
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
              <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                重试
              </Button>
            )}
            <Button variant="ghost" size="sm" asChild>
              <ExternalLink href={githubUrl}>
                <ExternalLinkIcon className="size-4" aria-hidden />
                在 GitHub 查看
              </ExternalLink>
            </Button>
          </div>
        </div>
      )
    }

    if (!sourceContent) {
      return (
        <p className="text-muted-foreground border-border rounded-xl border border-dashed px-6 py-10 text-center text-sm">
          该仓库暂无 README。
        </p>
      )
    }

    return <MarkdownContent content={sourceContent} {...markdownNavProps} />
  }

  const renderTranslated = () => {
    if (showProgressive) {
      return renderProgressiveTranslation()
    }

    if (translating && !hasTranslated) {
      return (
        <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          正在分段翻译…
        </div>
      )
    }

    if (!hasTranslated) {
      return (
        <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
          右键选择「翻译 README」开始（译文不保存）。
        </div>
      )
    }

    return <MarkdownContent content={translatedMarkdown!} {...markdownNavProps} />
  }

  if (!enabled) {
    return null
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={readmeLayoutRef}
          className="group/readme-layout relative flex min-h-[12rem] items-start gap-0"
          onMouseMove={handleReadmeLayoutMouseMove}
          onMouseLeave={() => setTocEdgeHover(false)}
        >
          <div
            ref={readmeContentRef}
            className="min-w-0 flex-1 outline-none"
            data-readme-capture-root
            data-readme-full-name={`${owner}/${repo}`}
          >
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
          disabled={!isDefaultReadme || !sourceContent || translating}
          onSelect={() => void startProgressiveTranslate()}
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
  )
}
