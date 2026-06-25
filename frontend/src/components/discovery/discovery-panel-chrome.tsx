import { Languages, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useDiscoveryHeader } from "@/context/discovery-header"
import { cn } from "@/lib/utils"

export function DiscoveryPanelChrome() {
  const { header, refreshRef, translateDescriptionsRef } = useDiscoveryHeader()

  if (!header) {
    return (
      <div className="flex min-w-0 flex-1 items-center">
        <span className="text-muted-foreground text-sm font-medium">发现中心</span>
      </div>
    )
  }

  const spinRefresh = header.fetchBusy || header.enrichBusy
  const translateBusy = header.descriptionTranslateBusy
  const translateActive = header.descriptionTranslateActive
  const targetLabel = header.descriptionTranslateTargetLabel ?? "目标语言"
  const translateTitle = translateActive
    ? "显示原文"
    : `翻译简介（${targetLabel}）`
  const translateDisabled = header.listBusy || !header.descriptionTranslateAvailable

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="text-foreground min-w-0 truncate text-sm font-medium">{header.title}</span>
        {header.meta ? (
          <span className="text-muted-foreground shrink-0 text-xs">{header.meta}</span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {header.enrichBusy ? (
          <span className="text-muted-foreground text-xs">正在补全 Star 与语言…</span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shadow-none"
          onClick={() => refreshRef.current?.()}
          disabled={header.fetchBusy}
          title="刷新"
          aria-label="刷新"
        >
          <RefreshCw className={cn("size-4", spinRefresh && "animate-spin")} aria-hidden />
        </Button>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 shadow-none",
                translateActive && "text-primary"
              )}
              onClick={() => translateDescriptionsRef.current?.()}
              disabled={translateDisabled}
              aria-label={translateTitle}
              aria-pressed={translateActive}
            >
              <Languages
                className={cn("size-4", translateBusy && "animate-pulse")}
                aria-hidden
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {translateBusy
              ? "正在翻译列表简介，完成后逐条显示译文"
              : translateActive
                ? "点击恢复显示原文（译文仍保留在会话中）"
                : `将当前列表中的仓库简介翻译为${targetLabel}（不保存）`}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
