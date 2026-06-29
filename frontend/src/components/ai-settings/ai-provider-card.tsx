import { Loader2, MoreHorizontal } from "lucide-react"

import { AiProviderLinkBadge } from "@/components/ai-settings/ai-studio-shared"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { findAiPresetById } from "@/lib/ai-provider-presets"
import type { ProviderTestResult } from "@/lib/ai-provider-api-key-display"
import type { AiProviderRead, AiProviderWrite } from "@/lib/settings-ai"
import { cn } from "@/lib/utils"

export type AiProviderCardProps = {
  provider: AiProviderWrite
  readProvider?: AiProviderRead
  isDefault: boolean
  canDelete: boolean
  isTestPending: boolean
  testResult?: ProviderTestResult | null
  onEdit: () => void
  onTest: () => void
  onSetDefault: () => void
  onDelete: () => void
  className?: string
}

function providerInitial(name: string, presetId: string): string {
  const preset = findAiPresetById(presetId)
  const source = preset?.sourceName ?? name
  return source.slice(0, 1).toUpperCase()
}

export function AiProviderCard({
  provider,
  readProvider,
  isDefault,
  canDelete,
  isTestPending,
  testResult,
  onEdit,
  onTest,
  onSetDefault,
  onDelete,
  className,
}: AiProviderCardProps) {
  if (!provider.id) return null
  const preset = findAiPresetById(provider.preset_id)
  const hasApiKey = readProvider?.has_api_key ?? false

  return (
    <div
      className={cn(
        "border-border relative flex min-h-[168px] flex-col rounded-xl border bg-card/40 p-4 shadow-sm transition-opacity",
        isTestPending && "pointer-events-none opacity-50",
        className
      )}
    >
      {isTestPending ? (
        <div
          className="bg-background/40 absolute inset-0 z-10 flex items-center justify-center rounded-xl"
          aria-hidden
        >
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <Avatar
          className="size-10 shrink-0 rounded-lg"
          fallback={
            <span className="bg-primary/10 text-primary flex size-full items-center justify-center rounded-lg text-sm font-semibold">
              {providerInitial(provider.name, provider.preset_id)}
            </span>
          }
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium leading-tight">{provider.name}</h3>
            {isDefault ? (
              <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-[11px] font-medium">
                默认
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">{preset?.label ?? provider.preset_id}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              disabled={isTestPending}
            >
              <MoreHorizontal className="size-4" aria-hidden />
              <span className="sr-only">更多操作</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit} disabled={isTestPending}>
              编辑
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isTestPending} onClick={onTest}>
              {isTestPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  测试中…
                </>
              ) : (
                "测试连接"
              )}
            </DropdownMenuItem>
            {!isDefault ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSetDefault} disabled={isTestPending}>
                  设为默认供应商
                </DropdownMenuItem>
              </>
            ) : null}
            {canDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={onDelete}
                  disabled={isTestPending}
                >
                  删除供应商
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-auto flex items-end justify-between gap-2 pt-4">
        <p className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
          {provider.default_model || "未设置默认模型"}
        </p>
        <AiProviderLinkBadge
          hasApiKey={hasApiKey}
          testResult={testResult}
          className="shrink-0"
        />
      </div>
    </div>
  )
}

export type AiAddProviderCardProps = {
  onClick: () => void
  className?: string
}

export function AiAddProviderCard({ onClick, className }: AiAddProviderCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-transparent p-4 transition-colors",
        className
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full border border-dashed text-xl">
        +
      </span>
      <span className="text-sm font-medium">添加供应商</span>
    </button>
  )
}
