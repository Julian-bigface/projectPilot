import { Calendar, GitFork, Plus, Star, Tags } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { useNavigate } from "react-router"

import { ProjectDomainTagsDialog } from "@/components/project/project-domain-tags-dialog"
import { ExternalLink } from "@/components/common/external-link"
import { ProjectGithubMark } from "@/components/project/project-github-mark"
import { ProjectInlineDescription } from "@/components/project/project-inline-description"
import { ProjectRepoAvatar } from "@/components/project/project-repo-avatar"
import { useLibraryProjectPreview } from "@/context/library-project-preview"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatGithubPushedRelative } from "@/lib/github-relative-time"
import { parseGithubOwner, projectSubtitle } from "@/lib/project-display"
import { domainTagPillClass } from "@/lib/topic-pill-palette"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/project"

export type ProjectLibraryPreviewPanelProps = {
  project: Project
}

function formatGithubAbsolute(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return ""
  }
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatLocalDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function folderDisplayLabel(p: Project): string {
  if (p.folder_id === null) {
    return "未归类"
  }
  if (p.folder_name?.trim()) {
    return p.folder_name
  }
  return "文件夹不存在或已删除"
}

function StateBadge({ state, className }: { state: Project["state"]; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium",
        state === "未体验" && "border-border bg-muted text-muted-foreground",
        state === "正在体验" && "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300",
        state === "推荐归档" && "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        state === "放弃归档" && "border-orange-500/30 bg-orange-500/15 text-orange-800 dark:text-orange-200",
        className
      )}
    >
      {state}
    </span>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-foreground text-sm font-semibold tracking-tight">{title}</h3>
      <div className="text-muted-foreground text-sm leading-relaxed">{children}</div>
    </section>
  )
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[120px_1fr] sm:gap-3">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-foreground text-sm">{children}</dd>
    </div>
  )
}

export function ProjectLibraryPreviewPanel({ project: p }: ProjectLibraryPreviewPanelProps) {
  const navigate = useNavigate()
  const { setPreviewProject } = useLibraryProjectPreview()

  const [tagDialogOpen, setTagDialogOpen] = useState(false)

  const initialTagIds = useMemo(() => (p.tags ?? []).map((t) => t.id), [p.tags])
  const tagIdsKey = useMemo(
    () => [...initialTagIds].sort((a, b) => a - b).join(","),
    [initialTagIds]
  )

  const owner = parseGithubOwner(p.full_name)

  const pushedIso = p.github_pushed_at
  const pushedRelative = formatGithubPushedRelative(pushedIso)
  const pushedAbsolute = formatGithubAbsolute(pushedIso)
  const pushedTooltip =
    pushedAbsolute !== ""
      ? `上次推送：${pushedAbsolute}\n相对：${pushedRelative}`
      : "暂无上次推送时间"

  const hasAi = Boolean(p.ai_summary?.trim())
  const subtitleFallback = projectSubtitle(p)
  const cardBodyFallback = subtitleFallback !== p.full_name.trim() ? subtitleFallback : ""

  return (
    <>
          <ProjectDomainTagsDialog
            projectId={p.id}
            projectLibraryId={p.project_library_id}
            open={tagDialogOpen}
            onOpenChange={setTagDialogOpen}
            initialTagIds={initialTagIds}
            tagIdsKey={tagIdsKey}
          />

      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
              <div className="border-border shrink-0 space-y-3 border-b px-3 pb-3 pt-3">
                <div className="space-y-3 text-left">
                  <div
                    className={cn(
                      "flex min-w-0 gap-3 rounded-md px-1 py-0.5 -mx-1 text-left outline-offset-2",
                      "cursor-pointer hover:bg-muted/40",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                    )}
                    role="button"
                    tabIndex={0}
                    aria-label="查看完整详情"
                    onClick={() => {
                      setPreviewProject(null)
                      navigate(`/projects/${p.id}`)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setPreviewProject(null)
                        navigate(`/projects/${p.id}`)
                      }
                    }}
                  >
                    <ProjectRepoAvatar owner={owner} displayName={p.name} fullName={p.full_name} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                        <h2 className="text-foreground min-w-0 text-left text-base leading-snug font-semibold tracking-tight">
                          {p.name.trim() || p.full_name}
                        </h2>
                        <StateBadge
                          state={p.state}
                          className="scale-95 border-border/60 !bg-muted/40 px-1.5 py-px text-[11px] leading-none font-normal !text-muted-foreground opacity-85"
                        />
                      </div>
                      <p className="sr-only">资料库项目预览。仓库路径 {p.full_name}。</p>
                      <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-left text-xs leading-snug">
                        <ProjectGithubMark className="size-3.5 shrink-0 opacity-80" aria-hidden />
                        <ExternalLink
                          href={p.github_url}
                          className="text-primary min-w-0 truncate font-mono hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.full_name}
                        </ExternalLink>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-muted-foreground flex w-full min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Star className="size-3.5 shrink-0 opacity-70" aria-hidden />
                      {p.stars.toLocaleString("zh-CN")}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <GitFork className="size-3.5 shrink-0 opacity-70" aria-hidden />
                      {(p.forks ?? 0).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex max-w-full min-w-0 shrink-0 cursor-default items-center justify-end gap-1 tabular-nums">
                        <Calendar className="size-3.5 shrink-0 opacity-70" aria-hidden />
                        <span className="truncate">{pushedRelative}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs whitespace-pre-line">
                      {pushedTooltip}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
                {hasAi ? (
                  <Section title="AI 摘要">
                    <p className="text-foreground whitespace-pre-wrap">{p.ai_summary!.trim()}</p>
                  </Section>
                ) : null}

                <ProjectInlineDescription
                  projectId={p.id}
                  description={p.description}
                  fallbackPlaceholder={cardBodyFallback.trim() || "暂无简介。"}
                  variant="preview"
                  sectionTitle="仓库简介"
                  showTranslate
                  onSaved={setPreviewProject}
                />

                <section className="group/labels space-y-2">
                  <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold tracking-tight">
                    <Tags className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    领域标签
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5">
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
                      className="text-muted-foreground size-6 shrink-0 opacity-0 transition-opacity group-hover/labels:opacity-100 focus-visible:opacity-100"
                      aria-label="管理标签"
                      title="管理标签"
                      onClick={() => setTagDialogOpen(true)}
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </section>

                {p.deploy_methods && p.deploy_methods.length > 0 ? (
                  <Section title="部署方式">
                    <ul className="text-foreground flex flex-wrap gap-2">
                      {p.deploy_methods.map((m) => (
                        <li
                          key={m}
                          className="border-border bg-muted/50 text-muted-foreground rounded-md border px-2.5 py-1 text-xs font-medium"
                        >
                          {m}
                        </li>
                      ))}
                    </ul>
                  </Section>
                ) : null}

                <section className="space-y-3">
                  <h3 className="text-foreground text-sm font-semibold tracking-tight">基本信息</h3>
                  <dl className="flex flex-col gap-3">
                    <MetaRow label="许可证">{p.license?.trim() ? p.license : "—"}</MetaRow>
                    <MetaRow label="作者">{p.author?.trim() ? p.author : "—"}</MetaRow>
                    <MetaRow label="语言">{p.language?.trim() ? p.language.trim() : "—"}</MetaRow>
                    <MetaRow label="所在文件夹">{folderDisplayLabel(p)}</MetaRow>
                    <MetaRow label="收录时间">{formatLocalDateTime(p.created_at)}</MetaRow>
                    <MetaRow label="更新时间">{formatLocalDateTime(p.updated_at)}</MetaRow>
                    {p.github_release_tag?.trim() ? (
                      <MetaRow label="Release 标签">{p.github_release_tag.trim()}</MetaRow>
                    ) : null}
                  </dl>
                </section>
              </div>
      </div>
    </>
  )
}
