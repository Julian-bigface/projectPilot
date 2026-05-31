import { ChevronLeft, ChevronRight } from "lucide-react"
import type { RefObject } from "react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { type MarkdownHeading, scrollToMarkdownHeading } from "@/lib/markdown-toc"
import { cn } from "@/lib/utils"

export type ReadmeTocPanelProps = {
  headings: MarkdownHeading[]
  open: boolean
  onOpenChange: (open: boolean) => void
  scrollContainerRef?: RefObject<HTMLElement | null>
  pillVisible?: boolean
}

export function ReadmeTocPanel({
  headings,
  open,
  onOpenChange,
  scrollContainerRef,
  pillVisible = false,
}: ReadmeTocPanelProps) {
  if (headings.length === 0) {
    return null
  }

  const handleNavigate = (id: string) => {
    scrollToMarkdownHeading(id, scrollContainerRef?.current)
  }

  const handleToggle = () => onOpenChange(!open)
  const showPill = pillVisible

  return (
    <div
      className={cn(
        "relative shrink-0 self-stretch transition-[width] duration-200",
        open ? "w-52 sm:w-56" : "w-0"
      )}
    >
      <div className="pointer-events-none sticky top-[45vh] z-40 h-0">
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "border-border bg-background hover:bg-muted absolute top-0 left-0 flex h-20 w-5 min-w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border p-0 shadow-sm transition-opacity duration-150",
                showPill ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
                "focus-visible:pointer-events-auto focus-visible:opacity-100"
              )}
              aria-label={open ? "收起目录" : "展开目录"}
              aria-expanded={open}
              onClick={handleToggle}
            >
              {open ? (
                <ChevronRight className="size-3.5" aria-hidden />
              ) : (
                <ChevronLeft className="size-3.5" aria-hidden />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{open ? "收起目录" : "展开目录"}</TooltipContent>
        </Tooltip>
      </div>

      <aside
        className={cn(
          "border-border bg-background/95 sticky top-4 z-20 flex max-h-[calc(100vh-8rem)] flex-col overflow-hidden border-l backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-hidden={!open}
      >
        <div className="border-b px-3 py-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide">目录</p>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label="README 目录">
          <ul className="space-y-0.5">
            {headings.map((heading) => (
              <li key={heading.id}>
                <button
                  type="button"
                  className={cn(
                    "text-muted-foreground hover:text-foreground hover:bg-muted/60 w-full truncate rounded-md px-2 py-1.5 text-left text-xs leading-snug transition-colors",
                    heading.level === 1 && "font-medium",
                    heading.level === 2 && "pl-2",
                    heading.level === 3 && "pl-4",
                    heading.level === 4 && "pl-6",
                    heading.level >= 5 && "pl-8"
                  )}
                  title={heading.text}
                  onClick={() => handleNavigate(heading.id)}
                >
                  {heading.text}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  )
}
