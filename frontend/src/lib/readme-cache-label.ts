import {
  formatGithubCacheStatusLabel,
  type GithubCacheSyncState,
} from "@/lib/github-cache-label"
import type { ProjectReadme } from "@/types/project-github"

export function formatReadmeCacheStatusLabel(
  data: ProjectReadme | undefined,
  syncState: GithubCacheSyncState,
  syncError: string | null,
  isLoading = false
): string {
  return formatGithubCacheStatusLabel(data?.cached_at, syncState, syncError, {
    isLoading,
    source: data?.source,
    emptyLabel: "尚未缓存",
  })
}

export type { GithubCacheSyncState }
