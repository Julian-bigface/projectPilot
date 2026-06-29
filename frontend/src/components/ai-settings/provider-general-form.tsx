import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useState } from "react"

import { AiProviderLinkBadge } from "@/components/ai-settings/ai-studio-shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ProviderTestResult } from "@/lib/ai-provider-api-key-display"
import type { AiProviderRead, AiProviderWrite } from "@/lib/settings-ai"

export type ProviderGeneralFormProps = {
  provider: AiProviderWrite
  readProvider?: AiProviderRead
  apiKeyInput: string
  onApiKeyChange: (value: string) => void
  onUpdate: (patch: Partial<AiProviderWrite>) => void
  testResult?: ProviderTestResult | null
  onTest?: () => void
  isTestPending?: boolean
}

export function ProviderGeneralForm({
  provider,
  readProvider,
  apiKeyInput,
  onApiKeyChange,
  onUpdate,
  testResult,
  onTest,
  isTestPending = false,
}: ProviderGeneralFormProps) {
  const [showKey, setShowKey] = useState(false)
  const hasApiKey = readProvider?.has_api_key ?? false
  const hasDisplayValue = apiKeyInput.length > 0

  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="provider-name">显示名称</Label>
        <Input
          id="provider-name"
          value={provider.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="provider-base-url">Base URL</Label>
        <Input
          id="provider-base-url"
          value={provider.base_url}
          onChange={(e) => onUpdate({ base_url: e.target.value })}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="provider-api-key">API Key</Label>
          <AiProviderLinkBadge hasApiKey={hasApiKey} testResult={testResult} />
        </div>
        <div className="relative">
          <Input
            id="provider-api-key"
            type={showKey ? "text" : "password"}
            value={apiKeyInput}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={hasDisplayValue ? undefined : "粘贴 API Key"}
            autoComplete="off"
            className="pr-10"
          />
          {hasDisplayValue ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-0 right-0 size-10"
              onClick={() => setShowKey((v) => !v)}
            >
              {showKey ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
              <span className="sr-only">{showKey ? "隐藏 Key" : "显示 Key"}</span>
            </Button>
          ) : null}
        </div>
        {onTest ? (
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isTestPending}
              onClick={onTest}
            >
              {isTestPending ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
              ) : null}
              测试连接
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
