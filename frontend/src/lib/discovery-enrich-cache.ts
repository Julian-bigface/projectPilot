import type { QueryClient } from "@tanstack/react-query"

import type { DiscoveryRepo } from "@/types/discovery"

/** 与后端 discovery_repo_cache TTL（6h）对齐 */
export const DISCOVERY_ENRICH_CACHE_MS = 6 * 60 * 60 * 1000

export function discoveryEnrichCacheKey(fullName: string) {
  return ["discovery", "enrich", fullName] as const
}

export function readDiscoveryEnrichCache(
  queryClient: QueryClient,
  fullName: string
): DiscoveryRepo | undefined {
  const key = discoveryEnrichCacheKey(fullName)
  const state = queryClient.getQueryState<DiscoveryRepo>(key)
  if (!state?.data) {
    return undefined
  }
  if (
    state.dataUpdatedAt != null &&
    Date.now() - state.dataUpdatedAt > DISCOVERY_ENRICH_CACHE_MS
  ) {
    return undefined
  }
  return state.data
}

export function writeDiscoveryEnrichCache(queryClient: QueryClient, repo: DiscoveryRepo) {
  queryClient.setQueryData(discoveryEnrichCacheKey(repo.full_name), repo)
}

export function repoNeedsDiscoveryEnrich(repo: DiscoveryRepo): boolean {
  return repo.stars === 0 || !repo.language?.trim()
}
