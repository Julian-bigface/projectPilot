import { useQuery } from "@tanstack/react-query"
import { ExternalLink as ExternalLinkIcon, Loader2 } from "lucide-react"
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react"

import { ExternalLink } from "@/components/common/external-link"
import { MarkdownContent } from "@/components/project/detail/markdown-content"
import { ReadmeTocPanel } from "@/components/project/detail/readme-toc-panel"
import { GithubSettingsButton } from "@/components/common/github-settings-link"
import { Button } from "@/components/ui/button"
import { fetchDiscoveryRepoReadme } from "@/lib/discovery-repo-readme"
import { extractMarkdownHeadings, syncDomMarkdownHeadings, type MarkdownHeading } from "@/lib/markdown-toc"

export type DiscoveryRepoReadmeTabProps = {
  owner: string
  repo: string
  githubUrl: string
  enabled: boolean
}

export function DiscoveryRepoReadmeTab({
  owner,
  repo,
  githubUrl,
  enabled,
}: DiscoveryRepoReadmeTabProps) {
  const [readmePath, setReadmePath] = useState<string | null>(null)
  const [tocOpen, setTocOpen] = useState(true)
  const [tocEdgeHover, setTocEdgeHover] = useState(false)
  const [tocHeadings, setTocHeadings] = useState<MarkdownHeading[]>([])
  const readmeContentRef = useRef<HTMLDivElement>(null)
  const readmeLayoutRef = useRef<HTMLDivElement>(null)

  const isDefaultReadme = readmePath === null
  const readmeQueryKey = readmePath ?? "default"

  const query = useQuery({
    queryKey: ["discovery", owner, repo, "readme", readmeQueryKey],
    queryFn: () => fetchDiscoveryRepoReadme(owner, repo, { path: readmePath, fresh: false }),
    enabled: enabled && (isDefaultReadme || Boolean(readmePath)),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  })

  const readmeBasePath = readmePath ?? query.data?.path ?? null

  const handleReadmeNavigate = useCallback(
    (path: string) => {
      if (path === readmePath) {
        return
      }
      setReadmePath(path)
    },
    [readmePath]
  )

  const markdownNavProps = {
    githubUrl,
    readmeBasePath,
    onReadmeNavigate: handleReadmeNavigate,
    enableHtml: true,
  }

  const tocMarkdown = useMemo(() => {
    if (query.isLoading || query.isError) {
      return ""
    }
    return query.data?.content?.trim() ?? ""
  }, [query.isLoading, query.isError, query.data?.content])

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
  }, [tocMarkdown, readmePath])

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

  const content = query.data?.content?.trim()
  if (!content) {
    return (
      <p className="text-muted-foreground border-border rounded-xl border border-dashed px-6 py-10 text-center text-sm">
        该仓库暂无 README。
      </p>
    )
  }

  return (
    <div
      ref={readmeLayoutRef}
      className="group/readme-layout relative flex min-h-[12rem] items-start gap-0"
      onMouseMove={handleReadmeLayoutMouseMove}
      onMouseLeave={() => setTocEdgeHover(false)}
    >
      <div ref={readmeContentRef} className="min-w-0 flex-1 outline-none">
        <MarkdownContent content={content} {...markdownNavProps} />
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
  )
}
