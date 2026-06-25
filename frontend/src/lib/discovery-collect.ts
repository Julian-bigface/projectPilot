import { parseApiErrorMessage } from "@/lib/api-error"
import { plApiPath } from "@/lib/pl-api"
import type { DiscoveryRepo } from "@/types/discovery"
import type { Project } from "@/types/project"

/** 发现中心取消收藏：直接删除项目，不进入回收站。 */
export async function uncollectDiscoveryProject(projectId: number): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/collect`, { method: "DELETE" })
  if (!res.ok) {
    throw new Error(await parseApiErrorMessage(res))
  }
}

export async function importDiscoveryRepo(
  repo: DiscoveryRepo,
  libraryId: number,
  folderId?: number | null
): Promise<Project> {
  const body: Record<string, unknown> = {
    github_url: repo.github_url,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    stars: repo.stars,
    forks: repo.forks,
    language: repo.language,
    state: "未体验",
    topics: repo.topics?.length ? repo.topics : [],
  }
  if (folderId != null) {
    body.folder_id = folderId
  }
  const res = await fetch(plApiPath(libraryId, "/projects"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await parseApiErrorMessage(res))
  }
  return (await res.json()) as Project
}
