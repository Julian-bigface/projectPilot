import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type SettingsRowProps = {
  label: string
  description?: ReactNode
  children: ReactNode
  className?: string
}

export function SettingsRow({ label, description, children, className }: SettingsRowProps) {
  return (
    <div
      className={cn(
        "border-border flex flex-col gap-4 border-b py-6 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-10",
        className
      )}
    >
      <div className="min-w-0 flex-1 sm:max-w-md">
        <div className="text-[15px] font-medium">{label}</div>
        {description ? (
          <div className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{description}</div>
        ) : null}
      </div>
      <div className="min-w-0 shrink-0 sm:max-w-md sm:flex-1 sm:text-right">{children}</div>
    </div>
  )
}
