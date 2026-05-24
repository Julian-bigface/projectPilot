import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const SIDEBAR_TOGGLE_SHORTCUT = "Ctrl+Alt+,"

type LibrarySidebarCollapseHandleProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LibrarySidebarCollapseHandle({ open, onOpenChange }: LibrarySidebarCollapseHandleProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={cn(
        "pointer-events-auto absolute inset-y-0 z-20 w-5",
        open ? "right-0 translate-x-1/2" : "left-0 -translate-x-1/2"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "border-border bg-background hover:bg-muted absolute top-1/4 left-1/2 h-14 w-3 min-w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border p-0 shadow-sm",
              "transition-opacity duration-150",
              hovered ? "opacity-100" : "opacity-0",
              "focus-visible:opacity-100"
            )}
            aria-label={open ? "收起资料库侧栏" : "展开资料库侧栏"}
            aria-expanded={open}
            onClick={(e) => {
              onOpenChange(!open)
              e.currentTarget.blur()
            }}
          >
            {open ? (
              <ChevronLeft className="size-2.5" aria-hidden />
            ) : (
              <ChevronRight className="size-2.5" aria-hidden />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-center">
          <p>{open ? "收起" : "展开"}</p>
          <p className="text-muted-foreground text-[10px]">{SIDEBAR_TOGGLE_SHORTCUT}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export { SIDEBAR_TOGGLE_SHORTCUT }
