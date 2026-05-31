import { parseApiErrorMessage } from "@/lib/api-error"
import type { ProjectReadme } from "@/types/project-github"

export type FetchProjectReadmeOptions = {
  fresh?: boolean
}

export async function fetchProjectReadme(
  projectId: number,
  path?: string | null,
  options?: FetchProjectReadmeOptions
): Promise<ProjectReadme> {
  const params = new URLSearchParams()
  if (path?.trim()) {
    params.set("path", path.trim())
  }
  if (options?.fresh) {
    params.set("fresh", "true")
  }
  const qs = params.toString()
  const res = await fetch(`/api/projects/${projectId}/readme${qs ? `?${qs}` : ""}`)
  if (!res.ok) {
    throw new Error(await parseApiErrorMessage(res))
  }
  return res.json() as Promise<ProjectReadme>
}
