import { CircleHelp } from "lucide-react"
import type { ReactNode } from "react"

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"

type HoverHelpProps = {
  children: ReactNode
  /** Icon alignment when placed beside labels */
  className?: string
}

/** Compact (?） trigger; put longer copy in children (shown in hover card). */
export function HoverHelp({ children, className }: HoverHelpProps) {
  return (
    <HoverCard defaultOpen={false} openDelay={500} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          className={cn(
            "text-muted-foreground hover:text-foreground inline-flex shrink-0 rounded-sm p-0.5 align-middle outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
          aria-label="查看说明"
          title="悬停查看说明"
        >
          <CircleHelp className="size-3.5" aria-hidden />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="text-foreground w-80 space-y-2 text-xs leading-relaxed" side="top">
        {children}
      </HoverCardContent>
    </HoverCard>
  )
}
