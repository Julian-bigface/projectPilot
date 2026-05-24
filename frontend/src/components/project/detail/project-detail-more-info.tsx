import { useState } from "react"

import { formatLocalDateTime, folderDisplayLabel, MetaItem } from "@/components/project/detail/project-detail-shared"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Project } from "@/types/project"

export type ProjectDetailMoreInfoProps = {
  project: Project
}

export function ProjectDetailMoreInfo({ project: p }: ProjectDetailMoreInfoProps) {
  const [open, setOpen] = useState(false)

  const hasAi = Boolean(p.ai_summary?.trim())
  const hasDeploy = Boolean(p.deploy_methods && p.deploy_methods.length > 0)

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
            <MetaItem label="GitHub">
              <a
                href={p.github_url}
                target="_blank"
                rel="noreferrer"
                className="text-primary break-all hover:underline"
              >
                {p.github_url}
              </a>
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
