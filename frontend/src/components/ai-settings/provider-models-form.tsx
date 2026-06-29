import { Input } from "@/components/ui/input"
import { FieldLabelWithHint } from "@/components/ai-settings/field-label-with-hint"
import type { AiProviderWrite } from "@/lib/settings-ai"

export type ProviderModelsFormProps = {
  provider: AiProviderWrite
  onUpdate: (patch: Partial<AiProviderWrite>) => void
}

export function ProviderModelsForm({ provider, onUpdate }: ProviderModelsFormProps) {
  const modelOptions =
    provider.models.length > 0
      ? provider.models
      : provider.default_model
        ? [provider.default_model]
        : []

  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <FieldLabelWithHint
          htmlFor="provider-default-model"
          hint="未单独配置的场景将使用默认供应商的默认模型"
        >
          默认模型
        </FieldLabelWithHint>
        {modelOptions.length > 0 ? (
          <select
            id="provider-default-model"
            value={provider.default_model}
            onChange={(e) => onUpdate({ default_model: e.target.value })}
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
            id="provider-default-model"
            value={provider.default_model}
            onChange={(e) => onUpdate({ default_model: e.target.value })}
            placeholder="MiniMax-M2.5-highspeed"
          />
        )}
      </div>

      <div className="grid gap-2">
        <FieldLabelWithHint
          htmlFor="provider-models"
          hint={`已添加 ${provider.models.length} 个模型，供能力配置页选择`}
        >
          模型列表（逗号分隔）
        </FieldLabelWithHint>
        <Input
          id="provider-models"
          value={provider.models.join(", ")}
          onChange={(e) => {
            const models = e.target.value
              .split(",")
              .map((m) => m.trim())
              .filter(Boolean)
            onUpdate({ models })
          }}
          placeholder="model-a, model-b"
        />
      </div>
    </div>
  )
}
