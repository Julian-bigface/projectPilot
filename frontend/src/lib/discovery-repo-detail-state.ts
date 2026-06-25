import type { DiscoveryRepo } from "@/types/discovery"

const STORAGE_PREFIX = "projectPilot.discoveryRepoDetail"

function storageKey(fullName: string) {
  return `${STORAGE_PREFIX}:${fullName}`
}

export function readStoredDiscoveryRepo(fullName: string): DiscoveryRepo | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    const raw = window.sessionStorage.getItem(storageKey(fullName))
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as DiscoveryRepo
  } catch {
    return null
  }
}

export function writeStoredDiscoveryRepo(repo: DiscoveryRepo) {
  if (typeof window === "undefined") {
    return
  }
  try {
    window.sessionStorage.setItem(storageKey(repo.full_name), JSON.stringify(repo))
  } catch {
    /* ignore quota */
  }
}

/** 合并详情页仓库信息，避免 Tab 切换或 state 丢失后回退为空白占位 */
export function mergeDiscoveryRepo(base: DiscoveryRepo, patch: DiscoveryRepo): DiscoveryRepo {
  const description =
    patch.description?.trim() || base.description?.trim()
      ? patch.description?.trim() || base.description
      : null
  return {
    ...base,
    ...patch,
    rank: patch.rank || base.rank,
    name: patch.name?.trim() || base.name,
    description,
    stars: Math.max(base.stars, patch.stars),
    forks: Math.max(base.forks, patch.forks),
    language: patch.language?.trim() || base.language?.trim() || null,
    topics: patch.topics?.length ? patch.topics : base.topics,
    owner_login: patch.owner_login ?? base.owner_login,
    owner_avatar_url: patch.owner_avatar_url ?? base.owner_avatar_url,
    pushed_at: patch.pushed_at ?? base.pushed_at,
    delta: base.delta ?? patch.delta,
  }
}

export function discoveryRepoNeedsEnrich(repo: DiscoveryRepo): boolean {
  return repo.stars === 0 && repo.forks === 0 && !repo.language?.trim() && !repo.description?.trim()
}
