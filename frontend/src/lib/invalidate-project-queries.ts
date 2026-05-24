import type { QueryClient } from "@tanstack/react-query"

/** 项目增删改后统一失效的查询键（资料库树、列表、标签、无标签筛选、详情） */
export function invalidateProjectRelated(queryClient: QueryClient, projectId?: number) {
  const keys: Promise<unknown>[] = [
    queryClient.invalidateQueries({ queryKey: ["library", "tree"] }),
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
