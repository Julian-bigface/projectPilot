import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { Navigate, useLocation, useParams } from "react-router"

import { DiscoveryRepoDetailHeader } from "@/components/discovery/discovery-repo-detail-header"
import { DiscoveryRepoDetailTabs } from "@/components/discovery/discovery-repo-detail-tabs"
import { useDiscoveryCollectDialogs } from "@/hooks/use-discovery-collect-dialogs"
import { enrichDiscoveryRepos } from "@/lib/discovery-api"
import {
  discoveryRepoNeedsEnrich,
  mergeDiscoveryRepo,
  readStoredDiscoveryRepo,
  writeStoredDiscoveryRepo,
} from "@/lib/discovery-repo-detail-state"
import { fetchDiscoveryImportedMap } from "@/lib/discovery-imported-map"
import type { DiscoveryRepo } from "@/types/discovery"

type DiscoveryRepoDetailLocationState = {
  repo?: DiscoveryRepo
  from?: string
}

function buildFallbackRepo(owner: string, repoName: string): DiscoveryRepo {
  const fullName = `${owner}/${repoName}`
  return {
    rank: 0,
    full_name: fullName,
    name: repoName,
    github_url: `https://github.com/${fullName}`,
    html_url: `https://github.com/${fullName}`,
    description: null,
    stars: 0,
    forks: 0,
    language: null,
    topics: [],
    owner_login: owner,
    owner_avatar_url: null,
    pushed_at: null,
  }
}

export function DiscoveryRepoDetailPage() {
  const { owner, repo: repoParam } = useParams<{ owner: string; repo: string }>()
  const location = useLocation()
  const state = location.state as DiscoveryRepoDetailLocationState | null

  const [importedProjectId, setImportedProjectId] = useState<number | null>(null)

  const importedMapQuery = useQuery({
    queryKey: ["discovery-imported-map"],
    queryFn: fetchDiscoveryImportedMap,
    staleTime: 60_000,
  })

  const { requestCollect, requestUncollect, dialogs, uncollectingProjectId } =
    useDiscoveryCollectDialogs({
      onCollected: (project) => setImportedProjectId(project.id),
      onUncollected: () => setImportedProjectId(null),
    })

  const valid = Boolean(owner?.trim() && repoParam?.trim())
  const safeOwner = owner?.trim() ?? ""
  const safeRepo = repoParam?.trim() ?? ""
  const fullName = `${safeOwner}/${safeRepo}`

  const seedRepo = useMemo(() => {
    const fromState = state?.repo
    const fromStorage = readStoredDiscoveryRepo(fullName)
    const fallback = buildFallbackRepo(safeOwner, safeRepo)
    if (fromState) {
      return mergeDiscoveryRepo(fallback, fromState)
    }
    if (fromStorage) {
      return mergeDiscoveryRepo(fallback, fromStorage)
    }
    return fallback
  }, [fullName, safeOwner, safeRepo, state?.repo])

  const [displayRepo, setDisplayRepo] = useState<DiscoveryRepo>(seedRepo)
  const resolvedRef = useRef(displayRepo)

  useEffect(() => {
    const next = mergeDiscoveryRepo(resolvedRef.current, seedRepo)
    resolvedRef.current = next
    setDisplayRepo(next)
    writeStoredDiscoveryRepo(next)
  }, [seedRepo])

  const enrichQuery = useQuery({
    queryKey: ["discovery", "repo-detail-enrich", fullName],
    queryFn: async () => {
      const result = await enrichDiscoveryRepos([
        {
          full_name: displayRepo.full_name,
          rank: displayRepo.rank,
          name: displayRepo.name,
          html_url: displayRepo.html_url,
          description: displayRepo.description,
          stars: displayRepo.stars,
          forks: displayRepo.forks,
        },
      ])
      return result.items[0] ?? displayRepo
    },
    enabled: valid && discoveryRepoNeedsEnrich(displayRepo),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  useEffect(() => {
    if (!enrichQuery.data) {
      return
    }
    const next = mergeDiscoveryRepo(resolvedRef.current, enrichQuery.data)
    resolvedRef.current = next
    setDisplayRepo(next)
    writeStoredDiscoveryRepo(next)
  }, [enrichQuery.data])

  if (!valid) {
    return <Navigate to="/discovery/trending" replace />
  }

  const enriching = discoveryRepoNeedsEnrich(displayRepo) && enrichQuery.isLoading

  const resolvedImportedId =
    importedProjectId ?? importedMapQuery.data?.get(displayRepo.full_name) ?? null

  const uncollecting =
    uncollectingProjectId != null && uncollectingProjectId === resolvedImportedId

  return (
    <>
      {dialogs}
      <div className="main-auto-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-12">
        <DiscoveryRepoDetailHeader
          repo={displayRepo}
          enriching={enriching}
          importedProjectId={resolvedImportedId}
          onCollect={() => requestCollect(displayRepo)}
          onUncollect={
            resolvedImportedId != null
              ? () => requestUncollect(resolvedImportedId, displayRepo.full_name)
              : undefined
          }
          uncollecting={uncollecting}
        />
        <DiscoveryRepoDetailTabs
          owner={safeOwner}
          repo={safeRepo}
          discoveryRepo={displayRepo}
          importedProjectId={resolvedImportedId}
          onCollect={() => requestCollect(displayRepo)}
          onUncollect={
            resolvedImportedId != null
              ? () => requestUncollect(resolvedImportedId, displayRepo.full_name)
              : undefined
          }
          uncollecting={uncollecting}
        />
      </div>
    </>
  )
}
