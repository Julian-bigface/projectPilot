import { Loader2 } from "lucide-react"

import { ProviderGeneralForm } from "@/components/ai-settings/provider-general-form"
import { ProviderModelsForm } from "@/components/ai-settings/provider-models-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAiConfigDraft } from "@/context/ai-config-draft"
import { findAiPresetById } from "@/lib/ai-provider-presets"

export type EditProviderDialogProps = {
  providerId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditProviderDialog({ providerId, open, onOpenChange }: EditProviderDialogProps) {
  const {
    draft,
    getProviderApiKeyDisplay,
    setApiKeyForProvider,
    getProviderTestResult,
    updateProvider,
    setDefaultProviderId,
    readProviderById,
    resetDraft,
    saveAsync,
    savePending,
    dirty,
    test,
    isTestPending,
  } = useAiConfigDraft()

  const provider = providerId ? draft?.providers.find((p) => p.id === providerId) : undefined
  const readProvider = providerId ? readProviderById(providerId) : undefined
  const preset = provider ? findAiPresetById(provider.preset_id) : undefined
  const isDefault = Boolean(providerId && draft && providerId === draft.defaultProviderId)

  const handleClose = () => {
    resetDraft()
    onOpenChange(false)
  }

  const handleSave = async () => {
    try {
      await saveAsync()
      onOpenChange(false)
    } catch {
      // 错误已由 context toast 提示
    }
  }

  if (!provider || !providerId) {
    return null
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose()
        else onOpenChange(true)
      }}
    >
      <DialogContent className="flex h-[min(90vh,520px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-border shrink-0 space-y-1 border-b px-6 py-4 text-left">
          <DialogTitle>编辑供应商</DialogTitle>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground min-w-0 flex-1 text-sm">
              {provider.name} · {preset?.label ?? provider.preset_id}
            </p>
            {isDefault ? (
              <span className="bg-primary/10 text-primary shrink-0 rounded px-2 py-0.5 text-[11px] font-medium">
                当前默认供应商
              </span>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={() => setDefaultProviderId(providerId)}
              >
                设为默认
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-4">
          <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mb-4 w-fit shrink-0 justify-start">
              <TabsTrigger value="general">通用设置</TabsTrigger>
              <TabsTrigger value="models">模型管理</TabsTrigger>
            </TabsList>

            <div className="grid min-h-0 flex-1 [&>[data-state=inactive]]:hidden">
              <TabsContent value="general" className="col-start-1 row-start-1 mt-0 overflow-y-auto">
                <ProviderGeneralForm
                  provider={provider}
                  readProvider={readProvider}
                  apiKeyInput={getProviderApiKeyDisplay(providerId)}
                  onApiKeyChange={(value) => setApiKeyForProvider(providerId, value)}
                  onUpdate={(patch) => updateProvider(providerId, patch)}
                  testResult={getProviderTestResult(providerId)}
                  onTest={() => test({ providerId })}
                  isTestPending={isTestPending({ providerId })}
                />
              </TabsContent>

              <TabsContent value="models" className="col-start-1 row-start-1 mt-0 overflow-y-auto">
                <ProviderModelsForm
                  provider={provider}
                  onUpdate={(patch) => updateProvider(providerId, patch)}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="border-border shrink-0 gap-2 border-t px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button type="button" disabled={!dirty || savePending} onClick={handleSave}>
            {savePending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
