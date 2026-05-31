import type { QueryClient } from "@tanstack/react-query"

import { patchProjectInLibraryCaches } from "@/lib/patch-project-in-library-caches"
import type { Project } from "@/types/project"

/** 项目增删改后：先写入缓存（可选），再失效相关查询。 */
export async function invalidateProjectRelated(
  queryClient: QueryClient,
  projectId?: number,
  updatedProject?: Project
) {
  if (updatedProject) {
    patchProjectInLibraryCaches(queryClient, updatedProject)
  }

  const keys: Promise<unknown>[] = [
    queryClient.invalidateQueries({ queryKey: ["library"] }),
    queryClient.invalidateQueries({ queryKey: ["projects"] }),
    queryClient.invalidateQueries({ queryKey: ["tags"] }),
    queryClient.invalidateQueries({ queryKey: ["projects", "missing-tags"] }),
    queryClient.invalidateQueries({ queryKey: ["projects", "missing-tags-count"] }),
    queryClient.invalidateQueries({ queryKey: ["projects", "trash"] }),
    queryClient.invalidateQueries({ queryKey: ["projects", "trash-count"] }),
  ]
  if (projectId != null) {
    keys.push(queryClient.invalidateQueries({ queryKey: ["projects", "detail", projectId] }))
    keys.push(queryClient.invalidateQueries({ queryKey: ["projects", projectId, "readme"] }))
    keys.push(queryClient.invalidateQueries({ queryKey: ["projects", projectId, "releases"] }))
  }
  return Promise.all(keys)
}
