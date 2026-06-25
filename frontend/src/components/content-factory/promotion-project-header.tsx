import { Star } from "lucide-react"

import { formatStars } from "@/lib/content-factory-api"
import type { ContentFactoryProjectBrief } from "@/types/content-factory"

export function PromotionProjectHeader({ project }: { project: ContentFactoryProjectBrief }) {
  const initial = project.name.slice(0, 2).toUpperCase()

  return (
    <div className="border-border flex flex-wrap items-start gap-4 rounded-lg border bg-card p-4">
      <div className="flex min-w-0 gap-3">
        <div className="bg-foreground text-background flex size-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{project.name}</h1>
            <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
              <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
              {formatStars(project.stars)}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
            {project.description || "暂无项目简介"}
          </p>
        </div>
      </div>
    </div>
  )
}
