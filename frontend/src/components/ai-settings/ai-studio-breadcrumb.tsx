import { ChevronRight } from "lucide-react"
import { Fragment } from "react"
import { Link } from "react-router"

import { AI_STUDIO_ROUTES } from "@/lib/ai-studio-routes"
import { cn } from "@/lib/utils"

export type AiStudioBreadcrumbItem = {
  label: string
  href?: string
}

export type AiStudioBreadcrumbProps = {
  items: AiStudioBreadcrumbItem[]
  className?: string
}

export function AiStudioBreadcrumb({ items, className }: AiStudioBreadcrumbProps) {
  return (
    <nav aria-label="面包屑" className={cn("text-muted-foreground text-sm", className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 ? (
                <ChevronRight className="size-3.5 shrink-0 opacity-50" aria-hidden />
              ) : null}
              <li>
                {item.href && !isLast ? (
                  <Link
                    to={item.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-foreground font-medium" : undefined}>
                    {item.label}
                  </span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}

export function aiStudioHomeCrumb(): AiStudioBreadcrumbItem {
  return { label: "AI 工作室", href: AI_STUDIO_ROUTES.overview }
}
