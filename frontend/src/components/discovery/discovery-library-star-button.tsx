import { Star } from "lucide-react"
import { type MouseEvent } from "react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type DiscoveryLibraryStarButtonProps = {
  importedProjectId?: number | null
  fromPath?: string
  onImport?: () => void
  onBeforeNavigate?: () => void
  /** 顶栏：星形旁显示「已收录」 */
  showImportedLabel?: boolean
  stopPropagation?: boolean
  className?: string
}

const importedStarClass = "fill-amber-400 text-amber-500"

export function DiscoveryLibraryStarButton({
  importedProjectId,
  fromPath,
  onImport,
  onBeforeNavigate,
  showImportedLabel = false,
  stopPropagation = false,
  className,
}: DiscoveryLibraryStarButtonProps) {
  const navigate = useNavigate()
  const imported = importedProjectId != null

  const handleClick = (e: MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation()
    }
    if (imported) {
      onBeforeNavigate?.()
      navigate(`/projects/${importedProjectId}`, {
        state: fromPath ? { from: fromPath } : undefined,
      })
      return
    }
    onImport?.()
  }

  if (imported && showImportedLabel) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "text-foreground h-8 shrink-0 gap-1.5 px-2 shadow-none hover:bg-amber-500/10",
          className
        )}
        title="已收录，点击查看项目"
        aria-label="已收录"
        onClick={handleClick}
      >
        <Star className={cn("size-4 shrink-0", importedStarClass)} aria-hidden />
        <span className="text-xs font-medium">已收录</span>
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
        imported && "hover:bg-amber-500/10 hover:text-amber-600",
        className
      )}
      title={imported ? "已收录，点击查看项目" : "加入资料库"}
      aria-label={imported ? "已收录" : "加入资料库"}
      onClick={handleClick}
    >
      <Star
        className={cn("size-4", imported && importedStarClass)}
        aria-hidden
      />
    </Button>
  )
}
