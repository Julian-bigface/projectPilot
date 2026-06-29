import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"

import type { ProviderTestResult } from "@/lib/ai-provider-api-key-display"
import {
  AI_SCENARIO_IDS,
  fetchAiConfig,
  postAiTest,
  putAiConfig,
  type AiConfigRead,
  type AiProviderRead,
  type AiProviderWrite,
  type AiScenarioBinding,
  type AiScenarioId,
} from "@/lib/settings-ai"

export type AiConfigDraft = {
  providers: AiProviderWrite[]
  defaultProviderId: string
  scenarios: Record<string, AiScenarioBinding>
}

export type AiTestTarget = {
  providerId: string
  scenarioId?: AiScenarioId
}

function providerToWrite(provider: AiProviderRead): AiProviderWrite {
  return {
    id: provider.id,
    name: provider.name,
    preset_id: provider.preset_id,
    provider: provider.provider,
    base_url: provider.base_url,
    models: [...provider.models],
    default_model: provider.default_model,
  }
}

export function configToDraft(config: AiConfigRead): AiConfigDraft {
  return {
    providers: config.providers.map(providerToWrite),
    defaultProviderId: config.default_provider_id ?? config.providers[0]?.id ?? "",
    scenarios: { ...config.scenarios },
  }
}

function sameTestTarget(a: AiTestTarget, b: AiTestTarget): boolean {
  return a.providerId === b.providerId && a.scenarioId === b.scenarioId
}

type AiConfigDraftContextValue = {
  configQuery: ReturnType<typeof useQuery<AiConfigRead>>
  draft: AiConfigDraft | null
  setDraft: React.Dispatch<React.SetStateAction<AiConfigDraft | null>>
  apiKeyInputs: Record<string, string>
  setApiKeyInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>
  dirty: boolean
  providersById: Map<string, AiProviderWrite>
  defaultProvider: AiProviderWrite | undefined
  scenarioLabels: Record<string, string>
  readProviderById: (id: string) => AiProviderRead | undefined
  updateProvider: (id: string, patch: Partial<AiProviderWrite>) => void
  setScenario: (scenarioId: AiScenarioId, binding: AiScenarioBinding) => void
  addProvider: (provider: AiProviderWrite, setAsDefault: boolean) => string
  deleteProvider: (id: string) => void
  setDefaultProviderId: (id: string) => void
  resetDraft: () => void
  save: () => void
  saveAsync: () => Promise<AiConfigRead>
  savePending: boolean
  test: (opts: AiTestTarget) => void
  isTestPending: (opts: AiTestTarget) => boolean
  isProviderTestPending: (providerId: string) => boolean
  getProviderTestResult: (providerId: string) => ProviderTestResult | null
  getProviderApiKeyDisplay: (providerId: string) => string
  setApiKeyForProvider: (providerId: string, value: string) => void
}

const AiConfigDraftContext = createContext<AiConfigDraftContextValue | null>(null)

export function AiConfigDraftProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<AiConfigDraft | null>(null)
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({})
  const [savedApiKeyMemory, setSavedApiKeyMemory] = useState<Record<string, string>>({})
  const [providerTestResults, setProviderTestResults] = useState<
    Record<string, ProviderTestResult>
  >({})

  const configQuery = useQuery({
    queryKey: ["settings", "ai", "config"],
    queryFn: fetchAiConfig,
  })

  useEffect(() => {
    if (configQuery.data && draft === null) {
      setDraft(configToDraft(configQuery.data))
    }
  }, [configQuery.data, draft])

  const providersById = useMemo(() => {
    const map = new Map<string, AiProviderWrite>()
    for (const p of draft?.providers ?? []) {
      if (p.id) map.set(p.id, p)
    }
    return map
  }, [draft?.providers])

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("配置未加载")
      const providers: AiProviderWrite[] = draft.providers.map((p) => {
        if (!p.id) return p
        const keyDraft = apiKeyInputs[p.id]
        const base: AiProviderWrite = { ...p }
        if (keyDraft !== undefined && keyDraft.trim()) {
          const read = configQuery.data?.providers.find((x) => x.id === p.id)
          const existing = read?.api_key ?? ""
          if (keyDraft.trim() !== existing) {
            return { ...base, api_key: keyDraft.trim() }
          }
        }
        return base
      })
      return putAiConfig({
        providers,
        default_provider_id: draft.defaultProviderId,
        scenarios: draft.scenarios,
      })
    },
    onSuccess: async (data) => {
      setSavedApiKeyMemory((mem) => {
        const next = { ...mem }
        for (const [id, key] of Object.entries(apiKeyInputs)) {
          const trimmed = key.trim()
          if (!trimmed) continue
          const read = data.providers.find((p) => p.id === id)
          if (trimmed !== (read?.api_key ?? "")) next[id] = trimmed
        }
        return next
      })
      setApiKeyInputs({})
      setDraft(configToDraft(data))
      toast.success("AI 配置已保存。")
      await queryClient.invalidateQueries({ queryKey: ["settings", "ai"] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const testMutation = useMutation({
    mutationFn: (opts: AiTestTarget) =>
      postAiTest({ providerId: opts.providerId, scenarioId: opts.scenarioId }),
    onSuccess: (data, variables) => {
      if (variables.providerId) {
        setProviderTestResults((prev) => ({
          ...prev,
          [variables.providerId]: data.ok ? "ok" : "fail",
        }))
      }
      if (data.ok) {
        toast.success(
          data.sample
            ? data.sample === "image_ok"
              ? "生图 API 连接可用"
              : `连接成功，模型回复：${data.sample}`
            : (data.message ?? "连接成功")
        )
      } else {
        toast.error(data.message ?? "连接测试失败")
      }
    },
    onError: (err: Error, variables) => {
      if (variables?.providerId) {
        setProviderTestResults((prev) => ({
          ...prev,
          [variables.providerId]: "fail",
        }))
      }
      toast.error(err.message)
    },
  })

  const readProviderById = useCallback(
    (id: string) => configQuery.data?.providers.find((p) => p.id === id),
    [configQuery.data?.providers]
  )

  const clearProviderTestResult = useCallback((providerId: string) => {
    setProviderTestResults((prev) => {
      if (!(providerId in prev)) return prev
      const next = { ...prev }
      delete next[providerId]
      return next
    })
  }, [])

  const getProviderApiKeyDisplay = useCallback(
    (providerId: string): string => {
      if (providerId in apiKeyInputs) return apiKeyInputs[providerId]
      if (savedApiKeyMemory[providerId]) return savedApiKeyMemory[providerId]
      const read = readProviderById(providerId)
      if (read?.api_key) return read.api_key
      return ""
    },
    [apiKeyInputs, readProviderById, savedApiKeyMemory]
  )

  const getProviderTestResult = useCallback(
    (providerId: string): ProviderTestResult | null =>
      providerTestResults[providerId] ?? null,
    [providerTestResults]
  )

  const setApiKeyForProvider = useCallback(
    (providerId: string, value: string) => {
      setApiKeyInputs((prev) => ({ ...prev, [providerId]: value }))
      clearProviderTestResult(providerId)
    },
    [clearProviderTestResult]
  )

  const isTestPending = useCallback(
    (opts: AiTestTarget) => {
      if (!testMutation.isPending || !testMutation.variables) return false
      return sameTestTarget(testMutation.variables, opts)
    },
    [testMutation.isPending, testMutation.variables]
  )

  const isProviderTestPending = useCallback(
    (providerId: string) => {
      if (!testMutation.isPending || !testMutation.variables) return false
      return testMutation.variables.providerId === providerId
    },
    [testMutation.isPending, testMutation.variables]
  )

  const updateProvider = useCallback(
    (id: string, patch: Partial<AiProviderWrite>) => {
      if ("base_url" in patch || "preset_id" in patch) {
        clearProviderTestResult(id)
      }
      setDraft((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          providers: prev.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }
      })
    },
    [clearProviderTestResult]
  )

  const setScenario = useCallback((scenarioId: AiScenarioId, binding: AiScenarioBinding) => {
    setDraft((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        scenarios: { ...prev.scenarios, [scenarioId]: binding },
      }
    })
  }, [])

  const addProvider = useCallback((provider: AiProviderWrite, setAsDefault: boolean): string => {
    const tempId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
        : `p${Date.now()}`
    const next: AiProviderWrite = { ...provider, id: tempId }
    setDraft((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        providers: [...prev.providers, next],
        defaultProviderId: setAsDefault ? tempId : prev.defaultProviderId,
      }
    })
    if (provider.api_key?.trim()) {
      setSavedApiKeyMemory((prev) => ({
        ...prev,
        [tempId]: provider.api_key!.trim(),
      }))
    }
    return tempId
  }, [])

  const deleteProvider = useCallback((id: string) => {
    setSavedApiKeyMemory((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
    setProviderTestResults((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
    setApiKeyInputs((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
    setDraft((prev) => {
      if (!prev || prev.providers.length <= 1) return prev
      const nextProviders = prev.providers.filter((p) => p.id !== id)
      let nextDefault = prev.defaultProviderId
      if (nextDefault === id) {
        nextDefault = nextProviders[0]?.id ?? ""
      }
      const nextScenarios = { ...prev.scenarios }
      for (const scenarioId of AI_SCENARIO_IDS) {
        if (nextScenarios[scenarioId]?.provider_id === id) {
          nextScenarios[scenarioId] = {
            provider_id: nextDefault,
            model: nextProviders.find((p) => p.id === nextDefault)?.default_model ?? null,
          }
        }
      }
      return {
        providers: nextProviders,
        defaultProviderId: nextDefault,
        scenarios: nextScenarios,
      }
    })
  }, [])

  const setDefaultProviderId = useCallback((id: string) => {
    setDraft((prev) => (prev ? { ...prev, defaultProviderId: id } : prev))
  }, [])

  const resetDraft = useCallback(() => {
    if (configQuery.data) {
      setDraft(configToDraft(configQuery.data))
      setApiKeyInputs({})
    }
  }, [configQuery.data])

  const defaultProvider = draft?.providers.find((p) => p.id === draft.defaultProviderId)

  const dirty = useMemo(() => {
    if (!draft || !configQuery.data) return false
    if (Object.values(apiKeyInputs).some((v) => v.trim())) return true
    return JSON.stringify(configToDraft(configQuery.data)) !== JSON.stringify(draft)
  }, [apiKeyInputs, configQuery.data, draft])

  const scenarioLabels = configQuery.data?.scenario_labels ?? {}

  const value: AiConfigDraftContextValue = {
    configQuery,
    draft,
    setDraft,
    apiKeyInputs,
    setApiKeyInputs,
    dirty,
    providersById,
    defaultProvider,
    scenarioLabels,
    readProviderById,
    updateProvider,
    setScenario,
    addProvider,
    deleteProvider,
    setDefaultProviderId,
    resetDraft,
    save: () => saveMutation.mutate(),
    saveAsync: () => saveMutation.mutateAsync(),
    savePending: saveMutation.isPending,
    test: (opts) => testMutation.mutate(opts),
    isTestPending,
    isProviderTestPending,
    getProviderTestResult,
    getProviderApiKeyDisplay,
    setApiKeyForProvider,
  }

  return (
    <AiConfigDraftContext.Provider value={value}>{children}</AiConfigDraftContext.Provider>
  )
}

export function useAiConfigDraft() {
  const ctx = useContext(AiConfigDraftContext)
  if (!ctx) {
    throw new Error("useAiConfigDraft must be used within AiConfigDraftProvider")
  }
  return ctx
}
