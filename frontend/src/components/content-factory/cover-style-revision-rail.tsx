import { useCallback } from "react"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { cn } from "@/lib/utils"
import type { CoverStyleRevisionSummary } from "@/types/content-factory"

/** 纵向版本指示条（Vertical Pagination Indicator / Version Rail） */
export function CoverStyleRevisionRail({
  items,
  activeRevisionId,
  onSelect,
  onSelectLatest,
  onDeleteRevision,
  onDiscardLiveLatest,
  className,
}: {
  items: CoverStyleRevisionSummary[]
  /** null = 当前最新编辑态 */
  activeRevisionId: number | null
  onSelect: (revisionId: number) => void
  onSelectLatest: () => void
  onDeleteRevision: (revisionId: number) => void
  /** 撤销最后一次 AI 调整：删除最新 checkpoint 并回退编辑态 */
  onDiscardLiveLatest: () => void
  className?: string
}) {
  const ordered = [...items].sort((a, b) => a.revision_index - b.revision_index)
  const isOnLiveLatest = activeRevisionId === null

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (ordered.length === 0) {
        return
      }
      if (event.key === "ArrowDown" && isOnLiveLatest) {
        event.preventDefault()
        onSelect(ordered[ordered.length - 1]!.id)
        return
      }
      if (activeRevisionId === null) {
        return
      }
      const currentIdx = ordered.findIndex((item) => item.id === activeRevisionId)
      if (currentIdx < 0) {
        return
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        if (currentIdx > 0) {
          onSelect(ordered[currentIdx - 1]!.id)
        }
      } else if (event.key === "ArrowDown") {
        event.preventDefault()
        if (currentIdx < ordered.length - 1) {
          onSelect(ordered[currentIdx + 1]!.id)
        } else {
          onSelectLatest()
        }
      }
    },
    [activeRevisionId, isOnLiveLatest, onSelect, onSelectLatest, ordered]
  )

  if (items.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        "flex max-h-full shrink-0 flex-col items-center justify-center gap-2 self-center overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      role="tablist"
      aria-label="版本历史"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {ordered.map((item) => {
        const isActive = activeRevisionId === item.id
        const titleParts = [
          `#${item.revision_index}`,
          "调整前",
          item.instruction?.trim() || "AI 调整",
        ]
        return (
          <ContextMenu key={item.id}>
            <ContextMenuTrigger asChild>
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={titleParts.join(" · ")}
                title={titleParts.join(" · ")}
                className="rounded-full p-1.5 transition-transform hover:scale-105"
                onClick={() => onSelect(item.id)}
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-all",
                    isActive
                      ? "bg-primary w-5"
                      : "bg-muted-foreground/30 w-4 hover:bg-muted-foreground/50"
                  )}
                />
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-40">
              <ContextMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDeleteRevision(item.id)}
              >
                删除版本 #{item.revision_index}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )
      })}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            role="tab"
            aria-selected={isOnLiveLatest}
            aria-label="当前最新编辑"
            title="当前最新编辑"
            className="rounded-full p-1.5 transition-transform hover:scale-105"
            onClick={() => {
              if (!isOnLiveLatest) {
                onSelectLatest()
              }
            }}
          >
            <span
              className={cn(
                "block h-1.5 rounded-full transition-all",
                isOnLiveLatest
                  ? "bg-primary w-5"
                  : "bg-muted-foreground/30 w-4 hover:bg-muted-foreground/50"
              )}
            />
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-44">
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDiscardLiveLatest()}
          >
            撤销最后一次 AI 调整
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}
