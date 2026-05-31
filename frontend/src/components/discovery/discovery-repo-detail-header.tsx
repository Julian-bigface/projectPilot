import { BookOpen, GitFork, Star } from "lucide-react"

import { ExternalLink } from "@/components/common/external-link"
import { DiscoveryLibraryStarButton } from "@/components/discovery/discovery-library-star-button"
import { DiscoveryRepoDescription } from "@/components/discovery/discovery-repo-description"
import { ProjectGithubMark } from "@/components/project/project-github-mark"
import { ProjectRepoAvatar } from "@/components/project/project-repo-avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { parseGithubOwner } from "@/lib/project-display"
import { pickDiscoveryRepoDescription } from "@/lib/discovery-display"
import { zreadProjectUrl } from "@/lib/project-wiki-links"
import { cn } from "@/lib/utils"
import type { DiscoveryRepo } from "@/types/discovery"

export type DiscoveryRepoDetailHeaderProps = {
  repo: DiscoveryRepo
  enriching?: boolean
  importedProjectId?: number | null
  fromPath?: string
  onImport?: () => void
}

export function DiscoveryRepoDetailHeader({
  repo,
  enriching = false,
  importedProjectId = null,
  fromPath,
  onImport,
}: DiscoveryRepoDetailHeaderProps) {
  const owner = parseGithubOwner(repo.full_name)
  const zreadUrl = zreadProjectUrl(repo.full_name)

  return (
    <section className="w-full pb-3">
      <div className="flex flex-wrap items-start gap-3">
        <ProjectRepoAvatar
          owner={owner}
          displayName={repo.name}
          fullName={repo.full_name}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words sm:text-3xl">
              {repo.name}
            </h1>
            <Button variant="outline" size="icon" className="size-8 shrink-0 shadow-none" asChild>
              <ExternalLink
                href={zreadUrl}
                title="在 Zread 中查看 AI Wiki"
                aria-label="在 Zread 中查看 AI Wiki"
              >
                <BookOpen className="size-4" aria-hidden />
              </ExternalLink>
            </Button>
            <DiscoveryLibraryStarButton
              importedProjectId={importedProjectId}
              fromPath={fromPath}
              onImport={onImport}
              showImportedLabel
            />
          </div>
          <div className="text-muted-foreground mt-2 flex min-w-0 items-center gap-1.5 text-sm">
            <ProjectGithubMark className="size-4 shrink-0 opacity-80" aria-hidden />
            <ExternalLink
              href={repo.html_url}
              className="text-primary inline-block max-w-full truncate font-mono hover:underline"
            >
              {repo.full_name}
            </ExternalLink>
          </div>
        </div>
      </div>

      <DiscoveryRepoDescription
        description={pickDiscoveryRepoDescription(repo.description)}
        enriching={enriching}
      />

      <p
        className={cn(
          "text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm",
          enriching && "opacity-60"
        )}
      >
        <span className="inline-flex items-center gap-1">
          <Star className="size-3.5 fill-amber-400 text-amber-500" aria-hidden />
          {enriching && repo.stars === 0 ? (
            <Skeleton className="h-3.5 w-12" />
          ) : (
            <span className="text-foreground tabular-nums">{repo.stars.toLocaleString("zh-CN")}</span>
          )}
        </span>
        {enriching && repo.forks === 0 ? (
          <Skeleton className="h-3.5 w-10" />
        ) : repo.forks > 0 ? (
          <span className="inline-flex items-center gap-1">
            <GitFork className="size-3.5" aria-hidden />
            {repo.forks.toLocaleString("zh-CN")}
          </span>
        ) : null}
        {enriching && !repo.language?.trim() ? (
          <Skeleton className="h-3.5 w-16" />
        ) : repo.language?.trim() ? (
          <span>{repo.language.trim()}</span>
        ) : null}
      </p>
    </section>
  )
}
