import { formatAppVersionLabel } from "@/lib/app-version"
import { cn } from "@/lib/utils"

type AppVersionLabelProps = {
  className?: string
}

/** 桌面/生产构建版本标识（VITE_APP_VERSION + 构建时间） */
export function AppVersionLabel({ className }: AppVersionLabelProps) {
  return (
    <p className={cn("text-muted-foreground text-xs tabular-nums", className)}>
      {formatAppVersionLabel()}
    </p>
  )
}
