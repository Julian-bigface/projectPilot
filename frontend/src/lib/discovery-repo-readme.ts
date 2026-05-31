import { parseApiErrorMessage } from "@/lib/api-error"
import type { ProjectReadme, ProjectReleasesResponse } from "@/types/project-github"

export type FetchDiscoveryRepoReadmeOptions = {
  path?: string | null
  fresh?: boolean
}

export async function fetchDiscoveryRepoReadme(
  owner: string,
  repo: string,
  options?: FetchDiscoveryRepoReadmeOptions
): Promise<ProjectReadme> {
  const params = new URLSearchParams()
  if (options?.path?.trim()) {
    params.set("path", options.path.trim())
  }
  if (options?.fresh) {
    params.set("fresh", "true")
  }
  const qs = params.toString()
  const res = await fetch(
    `/api/discovery/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme${qs ? `?${qs}` : ""}`
  )
  if (!res.ok) {
    throw new Error(await parseApiErrorMessage(res))
  }
  return res.json() as Promise<ProjectReadme>
}

export type FetchDiscoveryRepoReleasesOptions = {
  fresh?: boolean
}

export async function fetchDiscoveryRepoReleases(
  owner: string,
  repo: string,
  options?: FetchDiscoveryRepoReleasesOptions
): Promise<ProjectReleasesResponse> {
  const params = new URLSearchParams()
  if (options?.fresh) {
    params.set("fresh", "true")
  }
  const qs = params.toString()
  const res = await fetch(
    `/api/discovery/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases${qs ? `?${qs}` : ""}`
  )
  if (!res.ok) {
    throw new Error(await parseApiErrorMessage(res))
  }
  return res.json() as Promise<ProjectReleasesResponse>
}
