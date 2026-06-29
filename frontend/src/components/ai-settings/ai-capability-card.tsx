import { Loader2 } from "lucide-react"
import { Link } from "react-router"

import { AiReadyBadge } from "@/components/ai-settings/ai-studio-shared"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useAiConfigDraft } from "@/context/ai-config-draft"
import { resolveScenarioDisplay } from "@/lib/ai-config-status"
import { SCENARIO_ICONS } from "@/lib/ai-scenario-meta"
import { AI_STUDIO_ROUTES } from "@/lib/ai-studio-routes"
import { AI_SCENARIO_IDS, type AiScenarioId } from "@/lib/settings-ai"
import { cn } from "@/lib/utils"

export type AiCapabilityCardProps = {
  scenarioId: AiScenarioId
  className?: string
}

export function AiCapabilityCard({ scenarioId, className }: AiCapabilityCardProps) {
  const {
    configQuery,
    draft,
    providersById,
    defaultProvider,
    scenarioLabels,
    setScenario,
  } = useAiConfigDraft()

  const config = configQuery.data
  const display = config ? resolveScenarioDisplay(config, scenarioId) : null
  const Icon = SCENARIO_ICONS[scenarioId]

  const binding = draft?.scenarios[scenarioId] ?? {
    provider_id: draft?.defaultProviderId ?? null,
    model: null,
  }
  const source = binding.provider_id
    ? providersById.get(binding.provider_id)
    : defaultProvider
  const models =
    source && source.models.length > 0
      ? source.models
      : source?.default_model
        ? [source.default_model]
        : []

  if (!display || !draft) return null

  return (
    <div
      className={cn(
        "border-border flex flex-col rounded-xl border bg-card/40 p-4 shadow-sm transition-colors hover:bg-card/60",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {Icon ? (
            <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-4" aria-hidden />
            </div>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-sm font-medium leading-tight">
              {scenarioLabels[scenarioId] ?? display.label}
            </h3>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {display.providerName ?? "未指定供应商"}
            </p>
          </div>
        </div>
        <AiReadyBadge ready={display.ready} />
      </div>

      <div className="mt-3 grid gap-1.5">
        <Label className="text-muted-foreground text-xs">模型</Label>
        <select
          value={binding.model ?? source?.default_model ?? ""}
          disabled={!source || models.length === 0}
          onChange={(e) =>
            setScenario(scenarioId, {
              provider_id: binding.provider_id ?? draft.defaultProviderId ?? null,
              model: e.target.value,
            })
          }
          className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-2.5 text-xs focus-visible:ring-2 focus-visible:outline-none"
        >
          {models.length === 0 ? (
            <option value="">请先为供应商添加模型</option>
          ) : (
            models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))
          )}
        </select>
      </div>
    </div>
  )
}

export function AiCapabilityGrid() {
  const { dirty, save, savePending } = useAiConfigDraft()

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">AI 能力概览</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            各业务场景使用的模型与供应商；可在此直接切换模型。
          </p>
        </div>
        {dirty ? (
          <Button type="button" size="sm" disabled={savePending} onClick={save}>
            {savePending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden /> : null}
            保存更改
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {AI_SCENARIO_IDS.map((scenarioId) => (
          <AiCapabilityCard key={scenarioId} scenarioId={scenarioId} />
        ))}
      </div>
      <div className="mt-4">
        <Link
          to={AI_STUDIO_ROUTES.capabilities}
          className="text-primary text-sm hover:underline underline-offset-4"
        >
          管理全部能力 →
        </Link>
      </div>
    </div>
  )
}
