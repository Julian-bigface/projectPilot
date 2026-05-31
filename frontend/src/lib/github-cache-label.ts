import { formatGithubPushedRelative } from "@/lib/github-relative-time"

export type GithubCacheSyncState = "idle" | "syncing" | "synced" | "error"

export function formatGithubCacheStatusLabel(
  cachedAt: string | null | undefined,
  syncState: GithubCacheSyncState,
  syncError: string | null,
  options?: {
    isLoading?: boolean
    source?: "cache" | "github"
    emptyLabel?: string
    count?: number
  }
): string {
  const isLoading = options?.isLoading ?? false
  const source = options?.source
  const count = options?.count

  if (isLoading) {
    return "加载中…"
  }

  const cachedLabel = cachedAt ? formatGithubPushedRelative(cachedAt) : null
  const countSuffix =
    count !== undefined ? `（${count} 条）` : ""

  if (syncState === "syncing") {
    return cachedLabel
      ? `缓存于 ${cachedLabel}${countSuffix}，正在同步…`
      : `正在从 GitHub 同步…${countSuffix}`
  }
  if (syncState === "error") {
    const prefix = cachedLabel ? `显示缓存（${cachedLabel}${countSuffix}）` : `显示缓存${countSuffix}`
    return syncError ? `${prefix}，同步失败` : `${prefix}，同步失败`
  }
  if (source === "cache" && cachedLabel) {
    return `缓存于 ${cachedLabel}${countSuffix}`
  }
  if (syncState === "synced" && source === "github") {
    return cachedLabel ? `已与 GitHub 同步（${cachedLabel}${countSuffix}）` : `已与 GitHub 同步${countSuffix}`
  }
  if (source === "github") {
    return cachedLabel ? `已同步（${cachedLabel}${countSuffix}）` : `已同步${countSuffix}`
  }
  return options?.emptyLabel ?? "尚未缓存"
}
