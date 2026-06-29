import { Loader2 } from "lucide-react"

import {
  aiStudioHomeCrumb,
  AiStudioBreadcrumb,
} from "@/components/ai-settings/ai-studio-breadcrumb"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useAiConfigDraft } from "@/context/ai-config-draft"
import { SCENARIO_BADGES, SCENARIO_HINTS } from "@/lib/ai-scenario-meta"
import { AI_SCENARIO_IDS, type AiScenarioId } from "@/lib/settings-ai"
import { cn } from "@/lib/utils"

export function AiCapabilitiesPage() {
  const {
    configQuery,
    draft,
    providersById,
    defaultProvider,
    scenarioLabels,
    setScenario,
    test,
    isTestPending,
    save,
    savePending,
    dirty,
  } = useAiConfigDraft()

  if (configQuery.isLoading || !draft) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        加载配置…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AiStudioBreadcrumb items={[aiStudioHomeCrumb(), { label: "能力配置" }]} />

      <div>
        <h2 className="text-xl font-semibold tracking-tight">AI 能力配置</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          为不同 AI 能力选择供应商与模型；未单独配置的能力将跟随默认供应商。
        </p>
      </div>

      <div className="space-y-4">
        {AI_SCENARIO_IDS.map((scenarioId) => {
          const binding = draft.scenarios[scenarioId] ?? {
            provider_id: draft.defaultProviderId ?? null,
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
          const badge = SCENARIO_BADGES[scenarioId as AiScenarioId]

          return (
            <div
              key={scenarioId}
              className="border-border rounded-xl border bg-card/40 p-5 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium">
                  {scenarioLabels[scenarioId] ?? scenarioId}
                </h3>
                {badge ? (
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-medium",
                      badge.className
                    )}
                  >
                    {badge.label}
                  </span>
                ) : null}
              </div>
              {SCENARIO_HINTS[scenarioId as AiScenarioId] ? (
                <p className="text-muted-foreground mb-4 text-xs">
                  {SCENARIO_HINTS[scenarioId as AiScenarioId]}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>供应商</Label>
                  <select
                    value={binding.provider_id ?? draft.defaultProviderId ?? ""}
                    onChange={(e) => {
                      const providerId = e.target.value
                      const p = providersById.get(providerId)
                      setScenario(scenarioId as AiScenarioId, {
                        provider_id: providerId,
                        model: p?.default_model ?? binding.model,
                      })
                    }}
                    className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {draft.providers.map((p) => (
                      <option key={p.id} value={p.id ?? ""}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>模型</Label>
                  <select
                    value={binding.model ?? source?.default_model ?? ""}
                    disabled={!source || models.length === 0}
                    onChange={(e) =>
                      setScenario(scenarioId as AiScenarioId, {
                        provider_id: binding.provider_id ?? draft.defaultProviderId ?? null,
                        model: e.target.value,
                      })
                    }
                    className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
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
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    isTestPending({
                      providerId: binding.provider_id ?? draft.defaultProviderId ?? "",
                      scenarioId: scenarioId as AiScenarioId,
                    }) ||
                    !binding.provider_id ||
                    !binding.model
                  }
                  onClick={() =>
                    test({
                      providerId: binding.provider_id ?? draft.defaultProviderId ?? "",
                      scenarioId: scenarioId as AiScenarioId,
                    })
                  }
                >
                  {isTestPending({
                    providerId: binding.provider_id ?? draft.defaultProviderId ?? "",
                    scenarioId: scenarioId as AiScenarioId,
                  }) ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                  ) : null}
                  {scenarioId === "recommend_image" ? "测试生图" : "测试场景"}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={!dirty || savePending} onClick={save}>
          {savePending ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : null}
          保存配置
        </Button>
      </div>
    </div>
  )
}
