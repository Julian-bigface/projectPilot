import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ExternalLink, Loader2, Tag } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"

import { MarkdownContent } from "@/components/project/detail/markdown-content"
import { formatLocalDateTime } from "@/components/project/detail/project-detail-shared"
import { Button } from "@/components/ui/button"
import { parseApiErrorMessage } from "@/lib/api-error"
import { cn } from "@/lib/utils"
import type { ProjectRelease, ProjectReleasesResponse } from "@/types/project-github"

export type ProjectReleasesTabProps = {
  projectId: number
  githubUrl: string
  enabled: boolean
}

function ReleaseCard({ release }: { release: ProjectRelease }) {
  const [expanded, setExpanded] = useState(false)
  const title = release.name?.trim() || release.tag_name
  const body = release.body?.trim()
  const showTag = release.tag_name.trim() !== title.trim()

  const titleNode = release.html_url ? (
    <a
      href={release.html_url}
      target="_blank"
      rel="noreferrer"
      className="text-primary min-w-0 text-base font-semibold tracking-tight hover:underline"
    >
      {title}
    </a>
  ) : (
    <h3 className="min-w-0 text-base font-semibold tracking-tight">{title}</h3>
  )

  return (
    <article className="border-border bg-card/50 rounded-xl border p-4 sm:p-5">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Tag className="text-muted-foreground size-4 shrink-0" aria-hidden />
          {titleNode}
          {showTag ? (
            <span className="text-muted-foreground shrink-0 font-mono text-xs">{release.tag_name}</span>
          ) : null}
          {release.prerelease ? (
            <span className="border-border bg-muted shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              Pre-release
            </span>
          ) : null}
          {release.draft ? (
            <span className="border-border bg-muted shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              Draft
            </span>
          ) : null}
        </div>
        {release.published_at ? (
          <p className="text-muted-foreground mt-1 text-xs">
            {formatLocalDateTime(release.published_at)}
          </p>
        ) : null}
      </div>
      {body ? (
        <div className="mt-4">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-medium"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
            {expanded ? "收起说明" : "展开说明"}
          </button>
          {expanded ? (
            <div className="border-border mt-3 border-t pt-3">
              <MarkdownContent content={body} />
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

export function ProjectReleasesTab({ projectId, githubUrl, enabled }: ProjectReleasesTabProps) {
  const query = useQuery({
    queryKey: ["projects", projectId, "releases"],
    queryFn: async (): Promise<ProjectReleasesResponse> => {
      const res = await fetch(`/api/projects/${projectId}/releases`)
      if (!res.ok) {
        throw new Error(await parseApiErrorMessage(res))
      }
      return res.json() as Promise<ProjectReleasesResponse>
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  })

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
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings/github">配置 GitHub Token</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              重试
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <a href={`${githubUrl.replace(/\/$/, "")}/releases`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden />
              在 GitHub 查看
            </a>
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
    <div className="flex flex-col gap-4">
      {items.map((release) => (
        <ReleaseCard key={release.tag_name + (release.published_at ?? "")} release={release} />
      ))}
    </div>
  )
}
