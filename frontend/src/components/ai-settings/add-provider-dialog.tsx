import { Eye, EyeOff } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AI_PROTOCOL_LABELS,
  AI_PROVIDER_PRESETS,
  DEFAULT_AI_PRESET_ID,
  findAiPresetById,
} from "@/lib/ai-provider-presets"
import type { AiProviderWrite } from "@/lib/settings-ai"

export type AddProviderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (provider: AiProviderWrite, setAsDefault: boolean) => void
}

export function AddProviderDialog({ open, onOpenChange, onConfirm }: AddProviderDialogProps) {
  const [presetId, setPresetId] = useState(DEFAULT_AI_PRESET_ID)
  const [name, setName] = useState("MiniMax")
  const [baseUrl, setBaseUrl] = useState("https://api.minimaxi.com/v1")
  const [defaultModel, setDefaultModel] = useState("MiniMax-M2.5-highspeed")
  const [apiKey, setApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [setAsDefault, setSetAsDefault] = useState(false)

  const preset = useMemo(
    () => findAiPresetById(presetId) ?? findAiPresetById(DEFAULT_AI_PRESET_ID)!,
    [presetId]
  )

  useEffect(() => {
    if (!open) return
    setPresetId(DEFAULT_AI_PRESET_ID)
    setName("MiniMax")
    setBaseUrl("https://api.minimaxi.com/v1")
    setDefaultModel("MiniMax-M2.5-highspeed")
    setApiKey("")
    setShowApiKey(false)
    setSetAsDefault(false)
  }, [open])

  const applyPreset = (nextPresetId: string) => {
    setPresetId(nextPresetId)
    const next = findAiPresetById(nextPresetId)
    if (!next) return
    setName(next.sourceName)
    if (next.baseUrl) setBaseUrl(next.baseUrl)
    if (next.defaultModel) setDefaultModel(next.defaultModel)
  }

  const modelOptions =
    preset.models.length > 0 ? preset.models : defaultModel.trim() ? [defaultModel.trim()] : []

  const handleConfirm = () => {
    const models = modelOptions.length > 0 ? [...modelOptions] : defaultModel.trim() ? [defaultModel.trim()] : []
    const dm = defaultModel.trim() || models[0] || ""
    if (dm && !models.includes(dm)) {
      models.unshift(dm)
    }
    onConfirm(
      {
        name: name.trim() || preset.label,
        preset_id: presetId,
        provider: "openai_compatible",
        base_url: baseUrl.trim(),
        models,
        default_model: dm,
        api_key: apiKey.trim() || undefined,
      },
      setAsDefault
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>添加 AI 供应商</DialogTitle>
          <DialogDescription>
            选择平台预设并填写 API Key。添加后可在各场景中指定使用的供应商与模型。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="add-preset">平台预设</Label>
            <select
              id="add-preset"
              value={presetId}
              onChange={(e) => applyPreset(e.target.value)}
              className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {AI_PROVIDER_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="add-name">显示名称</Label>
              <Input id="add-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-protocol">协议类型</Label>
              <Input
                id="add-protocol"
                value={AI_PROTOCOL_LABELS.openai_compatible}
                disabled
                className="bg-muted/30"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="add-base-url">API 接口地址</Label>
            <Input
              id="add-base-url"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value)
                if (presetId !== "custom") setPresetId("custom")
              }}
              placeholder="https://api.minimaxi.com/v1"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="add-model">默认模型</Label>
            {modelOptions.length > 0 ? (
              <select
                id="add-model"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="add-model"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                placeholder="MiniMax-M2.5-highspeed"
              />
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="add-api-key">API Key</Label>
            <div className="relative">
              <Input
                id="add-api-key"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10"
                placeholder="粘贴 API Key"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-0 right-0 h-10 w-10"
                onClick={() => setShowApiKey((v) => !v)}
                aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
              >
                {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
            {preset.apiKeyHint ? (
              <p className="text-muted-foreground text-xs">{preset.apiKeyHint}</p>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={setAsDefault}
              onChange={(e) => setSetAsDefault(e.target.checked)}
              className="size-4 rounded border"
            />
            添加后设为默认供应商
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" onClick={handleConfirm}>
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
