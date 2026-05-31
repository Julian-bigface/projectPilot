import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useDiscoveryHeader } from "@/context/discovery-header"
import { cn } from "@/lib/utils"

export function DiscoveryPanelChrome() {
  const { header, refreshRef } = useDiscoveryHeader()

  if (!header) {
    return (
      <div className="flex min-w-0 flex-1 items-center">
        <span className="text-muted-foreground text-sm font-medium">发现中心</span>
      </div>
    )
  }

  const spinRefresh = header.fetchBusy || header.enrichBusy

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
      </div>
    </div>
  )
}
