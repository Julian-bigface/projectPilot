import { parseApiErrorMessage } from "@/lib/api-error"
import type { ProjectReleasesResponse } from "@/types/project-github"

export type FetchProjectReleasesOptions = {
  fresh?: boolean
}

export async function fetchProjectReleases(
  projectId: number,
  options?: FetchProjectReleasesOptions
): Promise<ProjectReleasesResponse> {
  const params = new URLSearchParams()
  if (options?.fresh) {
    params.set("fresh", "true")
  }
  const qs = params.toString()
  const res = await fetch(`/api/projects/${projectId}/releases${qs ? `?${qs}` : ""}`)
  if (!res.ok) {
    throw new Error(await parseApiErrorMessage(res))
  }
  return res.json() as Promise<ProjectReleasesResponse>
}
