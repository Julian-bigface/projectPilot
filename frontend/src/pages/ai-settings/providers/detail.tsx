import { Loader2 } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router"

import {
  aiStudioHomeCrumb,
  AiStudioBreadcrumb,
} from "@/components/ai-settings/ai-studio-breadcrumb"
import { ProviderGeneralForm } from "@/components/ai-settings/provider-general-form"
import { ProviderModelsForm } from "@/components/ai-settings/provider-models-form"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAiConfigDraft } from "@/context/ai-config-draft"
import { findAiPresetById } from "@/lib/ai-provider-presets"
import { AI_STUDIO_ROUTES } from "@/lib/ai-studio-routes"

export function AiProviderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    configQuery,
    draft,
    getProviderApiKeyDisplay,
    setApiKeyForProvider,
    getProviderTestResult,
    updateProvider,
    setDefaultProviderId,
    readProviderById,
    resetDraft,
    save,
    savePending,
    dirty,
    test,
    isTestPending,
    deleteProvider,
  } = useAiConfigDraft()

  const provider = draft?.providers.find((p) => p.id === id)
  const readProvider = id ? readProviderById(id) : undefined

  if (configQuery.isLoading || !draft) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        加载配置…
      </div>
    )
  }

  if (!provider || !id) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-muted-foreground text-sm">未找到该供应商</p>
        <Button type="button" variant="outline" asChild>
          <Link to={AI_STUDIO_ROUTES.providers}>返回供应商列表</Link>
        </Button>
      </div>
    )
  }

  const preset = findAiPresetById(provider.preset_id)
  const initial = (preset?.sourceName ?? provider.name).slice(0, 1).toUpperCase()
  const isDefault = id === draft.defaultProviderId

  const handleCancel = () => {
    resetDraft()
    navigate(AI_STUDIO_ROUTES.providers)
  }

  const handleDelete = () => {
    if (draft.providers.length <= 1) return
    deleteProvider(id)
    navigate(AI_STUDIO_ROUTES.providers)
  }

  return (
    <div className="space-y-6">
      <AiStudioBreadcrumb
        items={[
          aiStudioHomeCrumb(),
          { label: "供应商管理", href: AI_STUDIO_ROUTES.providers },
          { label: provider.name },
        ]}
      />

      <div className="flex flex-wrap items-start gap-4">
        <Avatar
          className="size-14 rounded-xl"
          fallback={
            <span className="bg-primary/10 text-primary flex size-full items-center justify-center rounded-xl text-lg font-semibold">
              {initial}
            </span>
          }
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight">{provider.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground text-sm">
              配置 {preset?.label ?? provider.preset_id} 服务
            </p>
            {isDefault ? (
              <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-[11px] font-medium">
                当前默认供应商
              </span>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setDefaultProviderId(id)}>
                设为默认供应商
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">通用设置</TabsTrigger>
          <TabsTrigger value="models">模型管理</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="border-border rounded-xl border bg-card/40 p-5 shadow-sm">
            <ProviderGeneralForm
              provider={provider}
              readProvider={readProvider}
              apiKeyInput={getProviderApiKeyDisplay(id)}
              onApiKeyChange={(value) => setApiKeyForProvider(id, value)}
              onUpdate={(patch) => updateProvider(id, patch)}
              testResult={getProviderTestResult(id)}
              onTest={() => test({ providerId: id })}
              isTestPending={isTestPending({ providerId: id })}
            />
          </div>
        </TabsContent>

        <TabsContent value="models">
          <div className="border-border rounded-xl border bg-card/40 p-5 shadow-sm">
            <ProviderModelsForm
              provider={provider}
              onUpdate={(patch) => updateProvider(id, patch)}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isTestPending({ providerId: id })}
            onClick={() => test({ providerId: id })}
          >
            {isTestPending({ providerId: id }) ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
            ) : null}
            测试连接
          </Button>
          {draft.providers.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              删除
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleCancel}>
            取消
          </Button>
          <Button type="button" disabled={!dirty || savePending} onClick={save}>
            {savePending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : null}
            保存
          </Button>
        </div>
      </div>
    </div>
  )
}
