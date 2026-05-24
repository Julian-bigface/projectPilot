import { Columns2, LayoutGrid } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLibraryProjectsLayout } from "@/context/library-projects-layout"
import { cn } from "@/lib/utils"

export function LibraryProjectsLayoutToggle({ className }: { className?: string }) {
  const { layout, setLayout } = useLibraryProjectsLayout()

  const toggle = () => {
    setLayout(layout === "grid" ? "masonry" : "grid")
  }

  const tooltipText =
    layout === "grid"
      ? "网格视图：卡片等高对齐。点击切换为瀑布流（多列错落）。"
      : "瀑布流视图：多列错落排列。点击切换为网格（整齐等高）。"

  const ariaLabel =
    layout === "grid" ? "当前为网格视图，点击切换为瀑布流" : "当前为瀑布流视图，点击切换为网格"

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-foreground hover:text-foreground size-8 shrink-0 rounded-md",
            className
          )}
          aria-label={ariaLabel}
          aria-pressed={layout === "masonry"}
          onClick={toggle}
        >
          {layout === "grid" ? (
            <LayoutGrid className="size-4" aria-hidden />
          ) : (
            <Columns2 className="size-4" aria-hidden />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  )
}
