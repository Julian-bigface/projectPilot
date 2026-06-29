import {
  AI_SCENARIO_IDS,
  type AiConfigRead,
  type AiProviderRead,
  type AiScenarioId,
} from "@/lib/settings-ai"

export type ScenarioDisplay = {
  scenarioId: AiScenarioId
  label: string
  model: string | null
  providerName: string | null
  providerId: string | null
  ready: boolean
}

function providerHasKey(
  providerId: string | null | undefined,
  providers: AiProviderRead[]
): boolean {
  if (!providerId) return false
  const p = providers.find((x) => x.id === providerId)
  return p?.has_api_key ?? false
}

function resolveBindingProviderId(config: AiConfigRead, scenarioId: AiScenarioId): string | null {
  const binding = config.scenarios[scenarioId]
  return binding?.provider_id ?? config.default_provider_id
}

function resolveBindingModel(
  config: AiConfigRead,
  scenarioId: AiScenarioId,
  providerId: string | null
): string | null {
  const binding = config.scenarios[scenarioId]
  if (binding?.model) return binding.model
  if (!providerId) return null
  const draftProvider = config.providers.find((p) => p.id === providerId)
  return draftProvider?.default_model ?? null
}

export function isScenarioReady(config: AiConfigRead, scenarioId: AiScenarioId): boolean {
  const providerId = resolveBindingProviderId(config, scenarioId)
  if (!providerId) return false
  if (!providerHasKey(providerId, config.providers)) return false
  const model = resolveBindingModel(config, scenarioId, providerId)
  if (!model) return false
  return true
}

export function countReadyScenarios(config: AiConfigRead): { ready: number; total: number } {
  const total = AI_SCENARIO_IDS.length
  const ready = AI_SCENARIO_IDS.filter((id) => isScenarioReady(config, id)).length
  return { ready, total }
}

export function providerHealthSummary(providers: AiProviderRead[]): {
  ok: number
  missingKey: number
  total: number
} {
  const total = providers.length
  const ok = providers.filter((p) => p.has_api_key).length
  return { ok, missingKey: total - ok, total }
}

export function resolveScenarioDisplay(
  config: AiConfigRead,
  scenarioId: AiScenarioId
): ScenarioDisplay {
  const label = config.scenario_labels[scenarioId] ?? scenarioId
  const providerId = resolveBindingProviderId(config, scenarioId)
  const provider = providerId ? config.providers.find((p) => p.id === providerId) : undefined
  const model = resolveBindingModel(config, scenarioId, providerId)
  return {
    scenarioId,
    label,
    model,
    providerName: provider?.name ?? null,
    providerId,
    ready: isScenarioReady(config, scenarioId),
  }
}

export function getDefaultProvider(config: AiConfigRead): AiProviderRead | undefined {
  const id = config.default_provider_id ?? config.providers[0]?.id
  return config.providers.find((p) => p.id === id)
}
