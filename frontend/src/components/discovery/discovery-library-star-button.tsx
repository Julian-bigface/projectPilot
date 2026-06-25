import { Star } from "lucide-react"
import { type MouseEvent } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type DiscoveryLibraryStarButtonProps = {
  importedProjectId?: number | null
  onCollect?: () => void
  onUncollect?: () => void
  uncollecting?: boolean
  /** 顶栏：星形旁显示「已收藏」 */
  showCollectedLabel?: boolean
  stopPropagation?: boolean
  className?: string
}

const collectedStarClass = "fill-amber-400 text-amber-500"

export function DiscoveryLibraryStarButton({
  importedProjectId,
  onCollect,
  onUncollect,
  uncollecting = false,
  showCollectedLabel = false,
  stopPropagation = false,
  className,
}: DiscoveryLibraryStarButtonProps) {
  const collected = importedProjectId != null
  const busy = uncollecting

  const handleClick = (e: MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation()
    }
    if (busy) {
      return
    }
    if (collected) {
      onUncollect?.()
      return
    }
    onCollect?.()
  }

  if (collected && showCollectedLabel) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "text-foreground h-8 shrink-0 gap-1.5 px-2 shadow-none hover:bg-amber-500/10",
          className
        )}
        title="取消收藏"
        aria-label="取消收藏"
        disabled={busy || !onUncollect}
        onClick={handleClick}
      >
        <Star className={cn("size-4 shrink-0", collectedStarClass)} aria-hidden />
        <span className="text-xs font-medium">已收藏</span>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "text-muted-foreground hover:text-foreground size-8 shrink-0 border-0 shadow-none",
        collected && "hover:bg-amber-500/10 hover:text-amber-600",
        className
      )}
      title={collected ? "取消收藏" : "收藏"}
      aria-label={collected ? "取消收藏" : "收藏"}
      disabled={busy || (collected ? !onUncollect : !onCollect)}
      onClick={handleClick}
    >
      <Star
        className={cn("size-4", collected && collectedStarClass)}
        aria-hidden
      />
    </Button>
  )
}
