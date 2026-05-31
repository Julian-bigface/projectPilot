import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Navigate, useLocation, useParams } from "react-router"

import { DiscoveryRepoDetailHeader } from "@/components/discovery/discovery-repo-detail-header"
import { DiscoveryRepoDetailTabs } from "@/components/discovery/discovery-repo-detail-tabs"
import { ImportToLibraryDialog } from "@/components/discovery/import-to-library-dialog"
import { enrichDiscoveryRepos } from "@/lib/discovery-api"
import { fetchDiscoveryImportedMap } from "@/lib/discovery-imported-map"
import type { DiscoveryRepo } from "@/types/discovery"
import type { Project } from "@/types/project"

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

function needsEnrich(repo: DiscoveryRepo): boolean {
  return repo.stars === 0 && repo.forks === 0 && !repo.language?.trim()
}

export function DiscoveryRepoDetailPage() {
  const { owner, repo: repoParam } = useParams<{ owner: string; repo: string }>()
  const location = useLocation()
  const state = location.state as DiscoveryRepoDetailLocationState | null

  const [importOpen, setImportOpen] = useState(false)
  const [importedProjectId, setImportedProjectId] = useState<number | null>(null)

  const fromPath =
    typeof state?.from === "string" && state.from.startsWith("/discovery")
      ? state.from
      : `${location.pathname}${location.search}`

  const importedMapQuery = useQuery({
    queryKey: ["discovery-imported-map"],
    queryFn: fetchDiscoveryImportedMap,
    staleTime: 60_000,
  })

  const valid = Boolean(owner?.trim() && repoParam?.trim())
  const safeOwner = owner?.trim() ?? ""
  const safeRepo = repoParam?.trim() ?? ""

  const baseRepo = useMemo(
    () => state?.repo ?? buildFallbackRepo(safeOwner, safeRepo),
    [state?.repo, safeOwner, safeRepo]
  )

  const enrichQuery = useQuery({
    queryKey: ["discovery", "repo-detail-enrich", baseRepo.full_name],
    queryFn: async () => {
      const result = await enrichDiscoveryRepos([
        {
          full_name: baseRepo.full_name,
          rank: baseRepo.rank,
          name: baseRepo.name,
          html_url: baseRepo.html_url,
          description: baseRepo.description,
          stars: baseRepo.stars,
          forks: baseRepo.forks,
        },
      ])
      return result.items[0] ?? baseRepo
    },
    enabled: valid && needsEnrich(baseRepo),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  })

  if (!valid) {
    return <Navigate to="/discovery/trending" replace />
  }

  const displayRepo = needsEnrich(baseRepo) ? (enrichQuery.data ?? baseRepo) : baseRepo
  const enriching = needsEnrich(baseRepo) && enrichQuery.isLoading

  const resolvedImportedId =
    importedProjectId ?? importedMapQuery.data?.get(displayRepo.full_name) ?? null

  const openImport = () => setImportOpen(true)

  const handleImported = (project: Project) => {
    setImportedProjectId(project.id)
  }

  return (
    <>
      <ImportToLibraryDialog
        repo={displayRepo}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />

      <div className="main-auto-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-12">
        <DiscoveryRepoDetailHeader
          repo={displayRepo}
          enriching={enriching}
          importedProjectId={resolvedImportedId}
          fromPath={fromPath}
          onImport={openImport}
        />
        <DiscoveryRepoDetailTabs
          owner={safeOwner}
          repo={safeRepo}
          discoveryRepo={displayRepo}
          importedProjectId={resolvedImportedId}
          fromPath={fromPath}
          onImport={resolvedImportedId ? undefined : openImport}
        />
      </div>
    </>
  )
}
