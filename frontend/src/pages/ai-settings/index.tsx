import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { AddProviderDialog } from "@/components/ai-settings/add-provider-dialog"
import { AppVersionLabel } from "@/components/common/app-version-label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { findAiPresetById } from "@/lib/ai-provider-presets"
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
import { cn } from "@/lib/utils"

const SCENARIO_HINTS: Partial<Record<AiScenarioId, string>> = {
  tag_classification: "标签管理 → 未分类 → AI 整理未分类",
  recommend_copy: "内容工厂 → 项目推广文案",
  recommend_image: "内容工厂 AI 封面出图（RootFlowAI 等 /images/generations）",
  recommend_cover_style:
    "内容工厂 → 风格库 AI 生成；上传参考图需 vision 模型（如 MiniMax-M3、GPT-4o、Claude 3+、Gemini 等）",
}

const SCENARIO_BADGES: Partial<Record<AiScenarioId, { label: string; className: string }>> = {
  tag_classification: {
    label: "整理",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  recommend_copy: {
    label: "话术",
    className: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  recommend_image: {
    label: "配图",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
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

function configToDraft(config: AiConfigRead) {
  return {
    providers: config.providers.map(providerToWrite),
    defaultProviderId: config.default_provider_id ?? config.providers[0]?.id ?? "",
    scenarios: { ...config.scenarios },
  }
}

export function AiSettingsPage() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<ReturnType<typeof configToDraft> | null>(null)
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null)

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
        const keyDraft = p.id ? apiKeyInputs[p.id] : undefined
        const base: AiProviderWrite = { ...p }
        if (keyDraft !== undefined && keyDraft.trim()) {
          return { ...base, api_key: keyDraft.trim() }
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
      setApiKeyInputs({})
      setDraft(configToDraft(data))
      setExpandedId(null)
      setBanner({ type: "ok", text: "AI 配置已保存。" })
      await queryClient.invalidateQueries({ queryKey: ["settings", "ai"] })
    },
    onError: (err: Error) => {
      setBanner({ type: "err", text: err.message })
    },
  })

  const testMutation = useMutation({
    mutationFn: (opts: { providerId: string; scenarioId?: AiScenarioId }) =>
      postAiTest({ providerId: opts.providerId, scenarioId: opts.scenarioId }),
    onSuccess: (data) => {
      if (data.ok) {
        setBanner({
          type: "ok",
          text: data.sample
            ? `连接成功。${data.sample === "image_ok" ? "生图 API 可用" : `模型回复：${data.sample}`}`
            : (data.message ?? "连接成功"),
        })
      } else {
        setBanner({ type: "err", text: data.message ?? "连接测试失败" })
      }
    },
    onError: (err: Error) => {
      setBanner({ type: "err", text: err.message })
    },
  })

  const updateProvider = useCallback((id: string, patch: Partial<AiProviderWrite>) => {
    setDraft((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        providers: prev.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }
    })
  }, [])

  const setScenario = useCallback((scenarioId: AiScenarioId, binding: AiScenarioBinding) => {
    setDraft((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        scenarios: { ...prev.scenarios, [scenarioId]: binding },
      }
    })
  }, [])

  const handleAddProvider = (provider: AiProviderWrite, setAsDefault: boolean) => {
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
    setExpandedId(tempId)
  }

  const handleDeleteProvider = (id: string) => {
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
  }

  const defaultProvider = draft?.providers.find((p) => p.id === draft.defaultProviderId)

  const dirty = useMemo(() => {
    if (!draft || !configQuery.data) return false
    if (Object.values(apiKeyInputs).some((v) => v.trim())) return true
    return JSON.stringify(configToDraft(configQuery.data)) !== JSON.stringify(draft)
  }, [apiKeyInputs, configQuery.data, draft])

  const scenarioLabels = configQuery.data?.scenario_labels ?? {}

  return (
    <div className="space-y-8 pb-16">
      <header>
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">AI 配置</h1>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              支持多供应商、多模型，并为标签整理等场景指定专用模型。翻译仍走独立 Google 通道。
            </p>
            <AppVersionLabel className="mt-2" />
          </div>
        </div>
      </header>

      {banner ? (
        <div
          role="status"
          className={cn(
            "rounded-lg border px-4 py-3 text-sm leading-relaxed",
            banner.type === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          )}
        >
          {banner.text}
        </div>
      ) : null}

      {/* 供应商列表 */}
      <section className="border-border rounded-xl border bg-card/40 p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-medium">AI 供应商</h2>
            <p className="text-muted-foreground text-sm">
              添加 MiniMax、DeepSeek 等 OpenAI 兼容供应商，各场景可分别选用。
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 size-4" aria-hidden />
            添加供应商
          </Button>
        </div>

        {configQuery.isLoading || !draft ? (
          <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            加载配置…
          </div>
        ) : (
          <div className="space-y-3">
            {draft.providers.map((provider) => {
              if (!provider.id) return null
              const readProvider = configQuery.data?.providers.find((p) => p.id === provider.id)
              const preset = findAiPresetById(provider.preset_id)
              const isDefault = provider.id === draft.defaultProviderId
              const expanded = expandedId === provider.id
              const modelCount = provider.models.length
              const keyHint = readProvider?.has_api_key
                ? readProvider.api_key_preview
                  ? `Key 已保存（末位 ${readProvider.api_key_preview}）`
                  : "Key 已配置"
                : "未配置 Key"

              return (
                <div
                  key={provider.id}
                  className="border-border rounded-lg border bg-background/60"
                >
                  <button
                    type="button"
                    className="hover:bg-muted/30 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
                    onClick={() => setExpandedId(expanded ? null : provider.id!)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{provider.name}</span>
                        {isDefault ? (
                          <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-[11px] font-medium">
                            默认供应商
                          </span>
                        ) : null}
                        <span className="text-muted-foreground text-xs">
                          {preset?.label ?? provider.preset_id}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {keyHint}
                        {modelCount > 0 ? ` · 已添加 ${modelCount} 个模型` : " · 尚未添加模型"}
                        {provider.default_model ? ` · 默认模型：${provider.default_model}` : null}
                      </p>
                    </div>
                    {!isDefault ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDraft((prev) =>
                            prev ? { ...prev, defaultProviderId: provider.id! } : prev
                          )
                        }}
                      >
                        设为默认
                      </Button>
                    ) : null}
                  </button>

                  {expanded ? (
                    <div className="border-border space-y-4 border-t px-4 py-4">
                      <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                        <div className="grid gap-2">
                          <Label>显示名称</Label>
                          <Input
                            value={provider.name}
                            onChange={(e) =>
                              updateProvider(provider.id!, { name: e.target.value })
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Base URL</Label>
                          <Input
                            value={provider.base_url}
                            onChange={(e) =>
                              updateProvider(provider.id!, { base_url: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label>默认模型</Label>
                        <Input
                          value={provider.default_model}
                          onChange={(e) =>
                            updateProvider(provider.id!, { default_model: e.target.value })
                          }
                          placeholder="MiniMax-M2.5-highspeed"
                        />
                        <p className="text-muted-foreground text-xs">
                          模型列表（逗号分隔）：{" "}
                          <Input
                            value={provider.models.join(", ")}
                            onChange={(e) => {
                              const models = e.target.value
                                .split(",")
                                .map((m) => m.trim())
                                .filter(Boolean)
                              updateProvider(provider.id!, { models })
                            }}
                            className="mt-1"
                          />
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <Label>API Key</Label>
                        <Input
                          type="password"
                          value={apiKeyInputs[provider.id!] ?? ""}
                          onChange={(e) =>
                            setApiKeyInputs((prev) => ({
                              ...prev,
                              [provider.id!]: e.target.value,
                            }))
                          }
                          placeholder={
                            readProvider?.has_api_key ? "留空则不修改已保存的 Key" : "粘贴 API Key"
                          }
                          autoComplete="off"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={testMutation.isPending}
                          onClick={() =>
                            testMutation.mutate({ providerId: provider.id! })
                          }
                        >
                          {testMutation.isPending ? (
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                          ) : null}
                          测试连接
                        </Button>
                        {draft.providers.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteProvider(provider.id!)}
                          >
                            <Trash2 className="mr-1.5 size-3.5" />
                            删除
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 默认设置 */}
      <section className="border-border rounded-xl border bg-card/40 p-5 shadow-sm">
        <h2 className="mb-4 text-base font-medium">默认设置</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="default-provider">默认供应商</Label>
            <select
              id="default-provider"
              value={draft?.defaultProviderId ?? ""}
              disabled={!draft}
              onChange={(e) =>
                setDraft((prev) =>
                  prev ? { ...prev, defaultProviderId: e.target.value } : prev
                )
              }
              className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {(draft?.providers ?? []).map((p) => (
                <option key={p.id} value={p.id ?? ""}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="default-model">默认模型</Label>
            <select
              id="default-model"
              value={defaultProvider?.default_model ?? ""}
              disabled={!defaultProvider}
              onChange={(e) => {
                if (!defaultProvider?.id) return
                updateProvider(defaultProvider.id, { default_model: e.target.value })
              }}
              className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {(defaultProvider?.models.length
                ? defaultProvider.models
                : defaultProvider?.default_model
                  ? [defaultProvider.default_model]
                  : []
              ).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 场景映射 */}
      <section className="border-border rounded-xl border bg-card/40 p-5 shadow-sm">
        <h2 className="mb-1 text-base font-medium">场景模型设置</h2>
        <p className="text-muted-foreground mb-5 text-sm">
          为不同 AI 能力选择供应商与模型；未单独配置的场景将跟随默认供应商。
        </p>

        <div className="space-y-4">
          {AI_SCENARIO_IDS.map((scenarioId) => {
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
            const badge = SCENARIO_BADGES[scenarioId]

            return (
              <div
                key={scenarioId}
                className="border-border rounded-lg border bg-background/50 p-4"
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
                {SCENARIO_HINTS[scenarioId] ? (
                  <p className="text-muted-foreground mb-3 text-xs">{SCENARIO_HINTS[scenarioId]}</p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>供应商</Label>
                    <select
                      value={binding.provider_id ?? draft?.defaultProviderId ?? ""}
                      disabled={!draft}
                      onChange={(e) => {
                        const providerId = e.target.value
                        const p = providersById.get(providerId)
                        setScenario(scenarioId, {
                          provider_id: providerId,
                          model: p?.default_model ?? binding.model,
                        })
                      }}
                      className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {(draft?.providers ?? []).map((p) => (
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
                        setScenario(scenarioId, {
                          provider_id: binding.provider_id ?? draft?.defaultProviderId ?? null,
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
                      testMutation.isPending ||
                      !binding.provider_id ||
                      !binding.model
                    }
                    onClick={() =>
                      testMutation.mutate({
                        providerId: binding.provider_id ?? draft?.defaultProviderId ?? "",
                        scenarioId,
                      })
                    }
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                    ) : null}
                    {scenarioId === "recommend_image" ? "测试生图" : "测试场景"}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={!dirty || saveMutation.isPending || configQuery.isLoading}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : null}
          保存配置
        </Button>
      </div>

      {configQuery.isError ? (
        <p className="text-destructive text-sm">
          {configQuery.error instanceof Error ? configQuery.error.message : "加载失败"}
        </p>
      ) : null}

      <AddProviderDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onConfirm={handleAddProvider}
      />
    </div>
  )
}
