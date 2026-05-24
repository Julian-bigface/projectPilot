import { GitFork, Plus, Star } from "lucide-react"
import { useMemo, useState } from "react"

import { formatLocalDateTime, StateBadge } from "@/components/project/detail/project-detail-shared"
import { ProjectDomainTagsDialog } from "@/components/project/project-domain-tags-dialog"
import { ProjectGithubMark } from "@/components/project/project-github-mark"
import { ProjectInlineDescription } from "@/components/project/project-inline-description"
import { ProjectRepoAvatar } from "@/components/project/project-repo-avatar"
import { Button } from "@/components/ui/button"
import { formatGithubPushedRelative } from "@/lib/github-relative-time"
import { parseGithubOwner, projectSubtitle } from "@/lib/project-display"
import { domainTagPillClass } from "@/lib/topic-pill-palette"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/project"

export type ProjectDetailHeaderProps = {
  project: Project
  statsSyncing?: boolean
  onProjectUpdated?: (p: Project) => void
}

export function ProjectDetailHeader({
  project: p,
  statsSyncing = false,
  onProjectUpdated,
}: ProjectDetailHeaderProps) {
  const [tagDialogOpen, setTagDialogOpen] = useState(false)

  const owner = parseGithubOwner(p.full_name)
  const initialTagIds = useMemo(() => (p.tags ?? []).map((t) => t.id), [p.tags])
  const tagIdsKey = useMemo(
    () => [...initialTagIds].sort((a, b) => a - b).join(","),
    [initialTagIds]
  )

  const subtitleFallback = projectSubtitle(p)
  const descPlaceholder =
    subtitleFallback !== p.full_name.trim() ? subtitleFallback : "暂无简介。双击编辑"

  return (
    <>
      <ProjectDomainTagsDialog
        projectId={p.id}
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        initialTagIds={initialTagIds}
        tagIdsKey={tagIdsKey}
        onSaved={onProjectUpdated}
      />

      <section className="w-full pb-3">
        <div className="flex flex-wrap items-start gap-3">
          <ProjectRepoAvatar
            owner={owner}
            displayName={p.name}
            fullName={p.full_name}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words sm:text-3xl">
                {p.name}
              </h1>
              <StateBadge state={p.state} />
            </div>
            <div className="text-muted-foreground mt-2 flex min-w-0 items-center gap-1.5 text-sm">
              <ProjectGithubMark className="size-4 shrink-0 opacity-80" aria-hidden />
              <a
                href={p.github_url}
                target="_blank"
                rel="noreferrer"
                className="text-primary min-w-0 truncate font-mono hover:underline"
              >
                {p.full_name}
              </a>
            </div>
          </div>
        </div>

        <p
          className={cn(
            "text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm transition-opacity",
            statsSyncing && "opacity-60"
          )}
          aria-busy={statsSyncing}
        >
          <span className="inline-flex items-center gap-1">
            <Star className="size-4 shrink-0 fill-amber-400 text-amber-500" aria-hidden />
            <span className="text-foreground tabular-nums">{p.stars.toLocaleString("zh-CN")}</span>
          </span>
          {p.forks > 0 ? (
            <>
              <span className="text-border hidden sm:inline" aria-hidden>
                ·
              </span>
              <span className="inline-flex items-center gap-1">
                <GitFork className="size-3.5 shrink-0" aria-hidden />
                {p.forks.toLocaleString("zh-CN")}
              </span>
            </>
          ) : null}
          {p.github_pushed_at ? (
            <>
              <span className="text-border hidden sm:inline" aria-hidden>
                ·
              </span>
              <span title={formatLocalDateTime(p.github_pushed_at)}>
                推送 {formatGithubPushedRelative(p.github_pushed_at)}
              </span>
            </>
          ) : null}
        </p>

        <ProjectInlineDescription
          projectId={p.id}
          description={p.description}
          fallbackPlaceholder={descPlaceholder}
          variant="detail"
          hideTitle
          onSaved={onProjectUpdated}
        />

        <div className="group/labels mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {(p.tags ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">暂无标签。</p>
            ) : (
              (p.tags ?? []).map((t) => (
                <span key={t.id} className={domainTagPillClass(t.id)}>
                  <span className="truncate">{t.name}</span>
                </span>
              ))
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="text-muted-foreground size-7 shrink-0 opacity-0 transition-opacity group-hover/labels:opacity-100 focus-visible:opacity-100"
              aria-label="管理标签"
              title="管理标签"
              onClick={() => setTagDialogOpen(true)}
            >
              <Plus className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
