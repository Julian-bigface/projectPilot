import { BookOpen, ExternalLink as ExternalLinkIcon, GitFork, Star } from "lucide-react"
import { type KeyboardEvent, type MouseEvent } from "react"
import { useNavigate } from "react-router"

import { ExternalLink } from "@/components/common/external-link"
import { DiscoveryLibraryStarButton } from "@/components/discovery/discovery-library-star-button"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { parseGithubOwner } from "@/lib/project-display"
import { pickDiscoveryRepoDescription } from "@/lib/discovery-display"
import {
  discoveryDeltaTone,
  discoveryRankDeltaClassName,
  formatDiscoveryDeltaValue,
  formatDiscoveryRankDelta,
} from "@/lib/discovery-delta"
import { zreadProjectUrl } from "@/lib/project-wiki-links"
import { cn } from "@/lib/utils"
import { ProjectRepoAvatar } from "@/components/project/project-repo-avatar"
import type { DiscoveryRepo } from "@/types/discovery"

export type DiscoveryRepoCardProps = {
  repo: DiscoveryRepo
  importedProjectId?: number | null
  fromPath: string
  onBeforeNavigate?: () => void
  onCollect?: (repo: DiscoveryRepo) => void
  onUncollect?: (projectId: number, fullName: string) => void
  uncollecting?: boolean
  enriching?: boolean
  showDelta?: boolean
  /** 列表批量翻译后的简介覆盖（不落库） */
  descriptionOverride?: string | null
  /** 简介正在翻译中，展示骨架屏 */
  descriptionTranslating?: boolean
  className?: string
}

function deltaClassName(tone: "up" | "down" | "neutral") {
  return cn(
    "text-[10px] font-medium tabular-nums",
    tone === "up" && "text-emerald-600 dark:text-emerald-400",
    tone === "down" && "text-muted-foreground",
    tone === "neutral" && "text-muted-foreground"
  )
}

function stopNav(e: MouseEvent | KeyboardEvent) {
  e.stopPropagation()
}

export function DiscoveryRepoCard({
  repo,
  importedProjectId,
  fromPath,
  onBeforeNavigate,
  onCollect,
  onUncollect,
  uncollecting = false,
  enriching = false,
  showDelta = false,
  descriptionOverride,
  descriptionTranslating = false,
  className,
}: DiscoveryRepoCardProps) {
  const navigate = useNavigate()
  const delta = showDelta ? repo.delta : null
  const owner = parseGithubOwner(repo.full_name) ?? repo.full_name.split("/")[0] ?? "unknown"
  const repoSlug = repo.full_name.split("/")[1] ?? repo.name
  const zreadUrl = zreadProjectUrl(repo.full_name)
  const sourceDescription = pickDiscoveryRepoDescription(repo.description)
  const displayDescription = descriptionOverride ?? sourceDescription

  const handleCardActivate = () => {
    onBeforeNavigate?.()
    const repoForNav = { ...repo, description: displayDescription }
    if (importedProjectId) {
      navigate(`/projects/${importedProjectId}`, { state: { from: fromPath } })
      return
    }
    navigate(`/discovery/r/${encodeURIComponent(owner)}/${encodeURIComponent(repoSlug)}`, {
      state: { repo: repoForNav, from: fromPath },
    })
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleCardActivate()
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleCardActivate}
      onKeyDown={handleKeyDown}
      className={cn(
        "border-border bg-card/50 group flex cursor-pointer gap-3 rounded-xl border p-3 sm:gap-4 sm:p-4",
        "hover:bg-card/80 focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none",
        className
      )}
    >
      <div className="flex size-8 shrink-0 flex-col items-center justify-center sm:size-9">
        <div
          className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg text-sm font-semibold tabular-nums sm:size-9"
          aria-label={`排名 ${repo.rank}`}
        >
          {repo.rank}
        </div>
        {delta?.rank != null ? (
          <span
            className={cn(
              "mt-0.5 text-[10px] font-medium tabular-nums",
              discoveryRankDeltaClassName(delta.rank)
            )}
          >
            {formatDiscoveryRankDelta(delta.rank)}
          </span>
        ) : null}
        {delta?.is_new ? (
          <span className="mt-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            新上榜
          </span>
        ) : null}
      </div>

      <ProjectRepoAvatar
        owner={owner}
        displayName={repo.name}
        fullName={repo.full_name}
        size="md"
        className="shrink-0"
      />

      <div className="min-w-0 flex-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight sm:text-base">{repo.name}</h3>
          <ExternalLink
            href={repo.html_url}
            className="text-primary mt-0.5 inline-block max-w-full truncate font-mono text-xs hover:underline"
            onClick={stopNav}
          >
            {repo.full_name}
          </ExternalLink>
        </div>

        {descriptionTranslating ? (
          <Skeleton className="mt-2 h-8 w-full max-w-md" aria-label="简介翻译中" />
        ) : displayDescription ? (
          <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-relaxed">
            {displayDescription}
          </p>
        ) : enriching ? (
          <Skeleton className="mt-2 h-8 w-full max-w-md" />
        ) : null}

        <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5 fill-amber-400 text-amber-500" aria-hidden />
            {enriching && repo.stars === 0 ? (
              <Skeleton className="h-3 w-10" />
            ) : (
              <>
                <span className="text-foreground tabular-nums">
                  {repo.stars.toLocaleString("zh-CN")}
                </span>
                {delta?.stars != null ? (
                  <span className={deltaClassName(discoveryDeltaTone(delta.stars))}>
                    {formatDiscoveryDeltaValue(delta.stars)}
                  </span>
                ) : null}
              </>
            )}
          </span>
          {enriching && repo.forks === 0 ? (
            <Skeleton className="h-3 w-8" />
          ) : repo.forks > 0 ? (
            <span className="inline-flex items-center gap-1">
              <GitFork className="size-3.5" aria-hidden />
              <span className="tabular-nums">{repo.forks.toLocaleString("zh-CN")}</span>
              {delta?.forks != null ? (
                <span className={deltaClassName(discoveryDeltaTone(delta.forks))}>
                  {formatDiscoveryDeltaValue(delta.forks)}
                </span>
              ) : null}
            </span>
          ) : null}
          {enriching && !repo.language?.trim() ? (
            <Skeleton className="h-3 w-16" />
          ) : repo.language?.trim() ? (
            <span>{repo.language.trim()}</span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 self-start">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          asChild
          title="在 GitHub 打开"
          onClick={stopNav}
        >
          <ExternalLink href={repo.html_url}>
            <ExternalLinkIcon className="size-4" aria-hidden />
            <span className="sr-only">在 GitHub 打开</span>
          </ExternalLink>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          asChild
          title="在 Zread 查看"
          onClick={stopNav}
        >
          <ExternalLink href={zreadUrl}>
            <BookOpen className="size-4" aria-hidden />
            <span className="sr-only">在 Zread 查看</span>
          </ExternalLink>
        </Button>
        <DiscoveryLibraryStarButton
            importedProjectId={importedProjectId}
            onCollect={onCollect ? () => onCollect(repo) : undefined}
            onUncollect={
              importedProjectId != null && onUncollect
                ? () => onUncollect(importedProjectId, repo.full_name)
                : undefined
            }
            uncollecting={uncollecting}
            stopPropagation
          />
      </div>
    </article>
  )
}
