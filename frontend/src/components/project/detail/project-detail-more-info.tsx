import { Loader2 } from "lucide-react"
import { useState } from "react"

import { ExternalLink } from "@/components/common/external-link"
import { formatLocalDateTime, folderDisplayLabel, MetaItem } from "@/components/project/detail/project-detail-shared"
import { GithubSettingsButton } from "@/components/common/github-settings-link"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useProjectGithubCache } from "@/context/project-github-cache"
import { formatGithubCacheStatusLabel } from "@/lib/github-cache-label"
import type { Project } from "@/types/project"

export type ProjectDetailMoreInfoProps = {
  project: Project
}

export function ProjectDetailMoreInfo({ project: p }: ProjectDetailMoreInfoProps) {
  const [open, setOpen] = useState(false)
  const {
    readmeRequested,
    releasesRequested,
    readmeSyncState,
    readmeSyncError,
    defaultReadmeQuery,
    syncReadmeFromGithub,
    releasesSyncState,
    releasesSyncError,
    releasesQuery,
    syncReleasesFromGithub,
  } = useProjectGithubCache()

  const hasAi = Boolean(p.ai_summary?.trim())
  const hasDeploy = Boolean(p.deploy_methods && p.deploy_methods.length > 0)
  const readmeStatusLabel = readmeRequested
    ? formatGithubCacheStatusLabel(
        defaultReadmeQuery.data?.cached_at,
        readmeSyncState,
        readmeSyncError,
        {
          isLoading: defaultReadmeQuery.isLoading,
          source: defaultReadmeQuery.data?.source,
          emptyLabel: "尚未缓存",
        }
      )
    : "打开 README Tab 后同步"
  const releasesCount = releasesQuery.data?.items?.length
  const releasesStatusLabel = releasesRequested
    ? formatGithubCacheStatusLabel(
        releasesQuery.data?.cached_at,
        releasesSyncState,
        releasesSyncError,
        {
          isLoading: releasesQuery.isLoading,
          source: releasesQuery.data?.source,
          emptyLabel: "尚未缓存",
          count: releasesCount,
        }
      )
    : "打开 Release Tab 后同步"
  const readmePath = defaultReadmeQuery.data?.path?.trim()
  const readmeSyncFailed = readmeSyncState === "error"
  const releasesSyncFailed = releasesSyncState === "error"
  const readmeIs424 =
    readmeSyncError?.includes("Token") || readmeSyncError?.includes("GitHub") || false
  const releasesIs424 =
    releasesSyncError?.includes("Token") || releasesSyncError?.includes("GitHub") || false

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground mb-px h-7 shrink-0 px-2 text-sm"
        >
          更多信息
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="max-h-[70vh] w-96 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {hasAi ? (
            <div>
              <h4 className="mb-1 text-sm font-semibold">AI 摘要</h4>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                {p.ai_summary!.trim()}
              </p>
            </div>
          ) : null}
          {hasDeploy ? (
            <div>
              <h4 className="mb-2 text-sm font-semibold">部署方式</h4>
              <ul className="flex flex-wrap gap-2">
                {p.deploy_methods!.map((m) => (
                  <li
                    key={m}
                    className="border-border bg-muted/50 text-muted-foreground rounded-md border px-2.5 py-1 text-xs font-medium"
                  >
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <dl className="flex flex-col gap-3">
            <MetaItem label="README 缓存">
              <div className="flex flex-col gap-1.5">
                <span className="text-muted-foreground flex items-center gap-1.5 text-sm leading-relaxed">
                  {readmeSyncState === "syncing" ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                  ) : null}
                  {readmeStatusLabel}
                </span>
                {readmePath ? (
                  <span className="text-muted-foreground font-mono text-xs">{readmePath}</span>
                ) : null}
                {readmeSyncFailed ? (
                  <div className="flex flex-wrap gap-2">
                    {readmeIs424 ? (
                      <GithubSettingsButton variant="outline" size="sm" className="h-7 text-xs">
                        配置 Token
                      </GithubSettingsButton>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => void syncReadmeFromGithub({ manual: true })}
                      >
                        重试同步
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
            </MetaItem>
            <MetaItem label="Release 缓存">
              <div className="flex flex-col gap-1.5">
                <span className="text-muted-foreground flex items-center gap-1.5 text-sm leading-relaxed">
                  {releasesSyncState === "syncing" ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                  ) : null}
                  {releasesStatusLabel}
                </span>
                {releasesSyncFailed ? (
                  <div className="flex flex-wrap gap-2">
                    {releasesIs424 ? (
                      <GithubSettingsButton variant="outline" size="sm" className="h-7 text-xs">
                        配置 Token
                      </GithubSettingsButton>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => void syncReleasesFromGithub({ manual: true })}
                      >
                        重试同步
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
            </MetaItem>
            <MetaItem label="GitHub">
              <ExternalLink
                href={p.github_url}
                className="text-primary break-all hover:underline"
              >
                {p.github_url}
              </ExternalLink>
            </MetaItem>
            {p.language?.trim() ? <MetaItem label="语言">{p.language.trim()}</MetaItem> : null}
            {p.license?.trim() ? <MetaItem label="许可证">{p.license.trim()}</MetaItem> : null}
            <MetaItem label="所在文件夹">{folderDisplayLabel(p)}</MetaItem>
            <MetaItem label="收录时间">{formatLocalDateTime(p.created_at)}</MetaItem>
            <MetaItem label="更新时间">{formatLocalDateTime(p.updated_at)}</MetaItem>
            {p.github_release_tag?.trim() ? (
              <MetaItem label="最新 Release">{p.github_release_tag.trim()}</MetaItem>
            ) : null}
          </dl>
        </div>
      </PopoverContent>
    </Popover>
  )
}
