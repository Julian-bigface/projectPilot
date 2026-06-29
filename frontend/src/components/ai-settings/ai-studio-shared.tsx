import type { ReactNode } from "react"

import type { ProviderTestResult } from "@/lib/ai-provider-api-key-display"
import { cn } from "@/lib/utils"

export type AiStatCardProps = {
  title: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function AiStatCard({ title, children, footer, className }: AiStatCardProps) {
  return (
    <div
      className={cn(
        "border-border flex flex-col rounded-xl border bg-card/40 p-4 shadow-sm",
        className
      )}
    >
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {title}
      </p>
      <div className="mt-2 min-h-[3rem] flex-1">{children}</div>
      {footer ? <div className="mt-3 text-xs">{footer}</div> : null}
    </div>
  )
}

export function AiConnectedBadge({
  connected,
  className,
}: {
  connected: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        connected
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        className
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")}
        aria-hidden
      />
      {connected ? "已配置 Key" : "未配置 Key"}
    </span>
  )
}

export function AiProviderLinkBadge({
  hasApiKey,
  testResult,
  className,
}: {
  hasApiKey: boolean
  testResult?: ProviderTestResult | null
  className?: string
}) {
  let label: string
  let tone: "amber" | "emerald" | "red" | "muted"

  if (!hasApiKey) {
    label = "未配置 Key"
    tone = "amber"
  } else if (testResult === "ok") {
    label = "连接正常"
    tone = "emerald"
  } else if (testResult === "fail") {
    label = "连接失败"
    tone = "red"
  } else {
    label = "已配置 Key"
    tone = "muted"
  }

  const toneClass =
    tone === "emerald"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : tone === "amber"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : tone === "red"
          ? "bg-destructive/15 text-destructive"
          : "bg-muted text-muted-foreground"

  const dotClass =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : tone === "red"
          ? "bg-destructive"
          : "bg-muted-foreground/60"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        toneClass,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClass)} aria-hidden />
      {label}
    </span>
  )
}

export function AiReadyBadge({ ready }: { ready: boolean }) {
  return (
    <span
      className={cn(
        "rounded px-2 py-0.5 text-[11px] font-medium",
        ready
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-muted text-muted-foreground"
      )}
    >
      {ready ? "已就绪" : "未就绪"}
    </span>
  )
}
