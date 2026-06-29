import { Loader2 } from "lucide-react"

import { AiCapabilityGrid } from "@/components/ai-settings/ai-capability-card"
import { AiOverviewStatCards } from "@/components/ai-settings/ai-overview-stat-cards"
import { useAiConfigDraft } from "@/context/ai-config-draft"

export function AiOverviewPage() {
  const { configQuery } = useAiConfigDraft()

  if (configQuery.isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        加载配置…
      </div>
    )
  }

  if (configQuery.isError || !configQuery.data) {
    return (
      <p className="text-destructive text-sm">
        {configQuery.error instanceof Error ? configQuery.error.message : "加载失败"}
      </p>
    )
  }

  return (
    <div className="space-y-8">
      <AiOverviewStatCards config={configQuery.data} />
      <AiCapabilityGrid />
    </div>
  )
}
