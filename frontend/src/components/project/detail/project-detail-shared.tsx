import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import type { Project } from "@/types/project"

export function formatLocalDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function folderDisplayLabel(p: Project): string {
  if (p.folder_id === null) {
    return "未归类"
  }
  if (p.folder_name?.trim()) {
    return p.folder_name
  }
  return "文件夹不存在或已删除"
}

export function StateBadge({ state }: { state: Project["state"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium",
        state === "未体验" && "border-border bg-muted text-muted-foreground",
        state === "正在体验" && "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300",
        state === "推荐归档" && "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        state === "放弃归档" && "border-orange-500/30 bg-orange-500/15 text-orange-800 dark:text-orange-200"
      )}
    >
      {state}
    </span>
  )
}

export function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[120px_1fr] sm:gap-3">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}
