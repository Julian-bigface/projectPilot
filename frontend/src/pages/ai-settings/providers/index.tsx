import { Loader2 } from "lucide-react"
import { useState } from "react"

import { AddProviderDialog } from "@/components/ai-settings/add-provider-dialog"
import {
  aiStudioHomeCrumb,
  AiStudioBreadcrumb,
} from "@/components/ai-settings/ai-studio-breadcrumb"
import { EditProviderDialog } from "@/components/ai-settings/edit-provider-dialog"
import { AiAddProviderCard, AiProviderCard } from "@/components/ai-settings/ai-provider-card"
import { useAiConfigDraft } from "@/context/ai-config-draft"
import type { AiProviderWrite } from "@/lib/settings-ai"

export function AiProvidersPage() {
  const {
    configQuery,
    draft,
    addProvider,
    deleteProvider,
    setDefaultProviderId,
    readProviderById,
    test,
    isProviderTestPending,
    getProviderTestResult,
    dirty,
  } = useAiConfigDraft()
  const [addOpen, setAddOpen] = useState(false)
  const [editProviderId, setEditProviderId] = useState<string | null>(null)

  const handleAddProvider = (provider: AiProviderWrite, setAsDefault: boolean) => {
    const id = addProvider(provider, setAsDefault)
    setAddOpen(false)
    setEditProviderId(id)
  }

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
      <AiStudioBreadcrumb
        items={[aiStudioHomeCrumb(), { label: "供应商管理" }]}
      />

      <div>
        <h2 className="text-xl font-semibold tracking-tight">AI 供应商</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          管理 MiniMax、DeepSeek 等 OpenAI 兼容供应商，各能力可分别选用。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {draft.providers.map((provider) => {
          if (!provider.id) return null
          return (
            <AiProviderCard
              key={provider.id}
              provider={provider}
              readProvider={readProviderById(provider.id)}
              isDefault={provider.id === draft.defaultProviderId}
              canDelete={draft.providers.length > 1}
              isTestPending={isProviderTestPending(provider.id!)}
              testResult={getProviderTestResult(provider.id!)}
              onEdit={() => setEditProviderId(provider.id!)}
              onTest={() => test({ providerId: provider.id! })}
              onSetDefault={() => setDefaultProviderId(provider.id!)}
              onDelete={() => deleteProvider(provider.id!)}
            />
          )
        })}
        <AiAddProviderCard onClick={() => setAddOpen(true)} />
      </div>

      {dirty ? (
        <p className="text-muted-foreground text-xs">
          有未保存的更改，请在编辑弹窗中保存。
        </p>
      ) : null}

      <AddProviderDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onConfirm={handleAddProvider}
      />

      <EditProviderDialog
        providerId={editProviderId}
        open={editProviderId != null}
        onOpenChange={(open) => {
          if (!open) setEditProviderId(null)
        }}
      />
    </div>
  )
}
