import { useQuery } from "@tanstack/react-query"
import { ChevronDown, Download, ExternalLink as ExternalLinkIcon, Loader2 } from "lucide-react"
import { useState } from "react"

import { ExternalLink } from "@/components/common/external-link"
import { MarkdownContent } from "@/components/project/detail/markdown-content"
import { ProjectRepoAvatar } from "@/components/project/project-repo-avatar"
import { GithubSettingsButton } from "@/components/common/github-settings-link"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { fetchDiscoveryRepoReleases } from "@/lib/discovery-repo-readme"
import { formatFileSize } from "@/lib/format-file-size"
import { formatGithubPushedRelative } from "@/lib/github-relative-time"
import { parseGithubOwner } from "@/lib/project-display"
import { cn } from "@/lib/utils"
import type { ProjectRelease, ProjectReleaseAsset } from "@/types/project-github"

export type DiscoveryRepoReleasesTabProps = {
  owner: string
  repo: string
  fullName: string
  displayName: string
  githubUrl: string
  enabled: boolean
}

const releaseAssetsColumnClass =
  "ml-auto min-w-[5.25rem] max-w-[min(26rem,90vw)] shrink-[999] basis-[min(26rem,90vw)] overflow-hidden"

const releaseAssetsTriggerClass =
  "h-8 w-full min-w-0 max-w-full justify-between gap-2 px-3 text-xs font-normal shadow-none overflow-hidden"

const releaseAssetsEmptyTriggerClass = "bg-muted/40 text-muted-foreground justify-center gap-1.5"

const releaseTimeClass = "text-muted-foreground w-20 shrink-0 truncate text-right text-xs"

function ReleaseAssetsPopover({ assets }: { assets: ProjectReleaseAsset[] }) {
  const count = assets.length

  if (count === 0) {
    return (
      <div className={releaseAssetsColumnClass}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          className={cn(releaseAssetsTriggerClass, releaseAssetsEmptyTriggerClass)}
        >
          <Download className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">无附件</span>
        </Button>
      </div>
    )
  }

  return (
    <div className={releaseAssetsColumnClass}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              releaseAssetsTriggerClass,
              "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-950"
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Download className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{count} 个文件</span>
            </span>
            <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={0}
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <ul className="max-h-72 overflow-y-auto py-1">
            {assets.map((asset) => (
              <li
                key={asset.browser_download_url}
                className="hover:bg-muted/50 flex items-center gap-2 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={asset.name}>
                    {asset.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatFileSize(asset.size)}
                    {" · "}
                    {formatGithubPushedRelative(asset.updated_at)}
                    {" · "}
                    {asset.download_count} 次下载
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
                  <ExternalLink
                    href={asset.browser_download_url}
                    download
                    title={`下载 ${asset.name}`}
                  >
                    <Download className="size-4" aria-hidden />
                    <span className="sr-only">下载 {asset.name}</span>
                  </ExternalLink>
                </Button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function ReleaseRow({
  release,
  fullName,
  displayName,
  githubUrl,
}: {
  release: ProjectRelease
  fullName: string
  displayName: string
  githubUrl: string
}) {
  const [expanded, setExpanded] = useState(false)
  const owner = parseGithubOwner(fullName)
  const title = release.name?.trim() || release.tag_name
  const body = release.body?.trim()
  const assets = release.assets ?? []

  const titleNode = release.html_url ? (
    <ExternalLink
      href={release.html_url}
      className="text-foreground min-w-0 truncate text-sm font-medium hover:underline"
      title={title}
    >
      {title}
    </ExternalLink>
  ) : (
    <span className="min-w-0 truncate text-sm font-medium" title={title}>
      {title}
    </span>
  )

  return (
    <article className="group/release border-border bg-card/50 relative rounded-xl border">
      <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 shrink-0 items-center gap-6 overflow-hidden sm:gap-8">
          <div className="flex shrink-0 items-center gap-2">
            <ProjectRepoAvatar
              owner={owner}
              displayName={displayName}
              fullName={fullName}
              size="sm"
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="text-muted-foreground truncate font-mono text-xs">{release.tag_name}</p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            {titleNode}
            {release.prerelease ? (
              <span className="border-border bg-muted shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                Pre
              </span>
            ) : null}
            {release.draft ? (
              <span className="border-border bg-muted shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                Draft
              </span>
            ) : null}
          </div>
        </div>

        <ReleaseAssetsPopover assets={assets} />

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span className={releaseTimeClass} title={release.published_at ?? undefined}>
            {formatGithubPushedRelative(release.published_at)}
          </span>
          {release.html_url ? (
            <Button variant="outline" size="icon" className="size-8 shrink-0 shadow-none" asChild>
              <ExternalLink href={release.html_url} title="在 GitHub 打开">
                <ExternalLinkIcon className="size-4" aria-hidden />
                <span className="sr-only">在 GitHub 打开</span>
              </ExternalLink>
            </Button>
          ) : null}
        </div>
      </div>

      {body ? (
        <div className={cn("relative", expanded && "border-border border-t")}>
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? "收起说明" : "展开说明"}
            title={expanded ? "收起说明" : "展开说明"}
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "border-border bg-background hover:bg-muted absolute top-0 left-1/2 z-10 flex h-3.5 w-64 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border p-0 shadow-sm transition-opacity duration-150",
              "opacity-0 group-hover/release:opacity-100 focus-visible:opacity-100"
            )}
          >
            <ChevronDown
              className={cn("size-2.5 transition-transform", expanded && "rotate-180")}
              aria-hidden
            />
          </button>
          {expanded ? (
            <div className="px-3 pt-4 pb-3 sm:px-4">
              <MarkdownContent content={body} githubUrl={githubUrl} />
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

export function DiscoveryRepoReleasesTab({
  owner,
  repo,
  fullName,
  displayName,
  githubUrl,
  enabled,
}: DiscoveryRepoReleasesTabProps) {
  const query = useQuery({
    queryKey: ["discovery", owner, repo, "releases"],
    queryFn: () => fetchDiscoveryRepoReleases(owner, repo, { fresh: false }),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  })

  if (!enabled && query.isLoading) {
    return null
  }

  if (query.isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        正在加载 Release…
      </div>
    )
  }

  if (query.isError) {
    const msg = (query.error as Error).message || "加载失败"
    const is424 = msg.includes("Token") || msg.includes("GitHub")
    return (
      <div className="border-border bg-muted/20 rounded-xl border border-dashed px-6 py-10 text-center">
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
            <ExternalLink href={`${githubUrl.replace(/\/$/, "")}/releases`}>
              <ExternalLinkIcon className="size-4" aria-hidden />
              在 GitHub 查看
            </ExternalLink>
          </Button>
        </div>
      </div>
    )
  }

  const items = query.data?.items ?? []
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground border-border rounded-xl border border-dashed px-6 py-10 text-center text-sm">
        该仓库暂无 Release。
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((release) => (
        <ReleaseRow
          key={release.tag_name + (release.published_at ?? "")}
          release={release}
          fullName={fullName}
          displayName={displayName}
          githubUrl={githubUrl}
        />
      ))}
    </div>
  )
}
