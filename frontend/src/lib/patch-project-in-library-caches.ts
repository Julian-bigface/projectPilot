import type { QueryClient } from "@tanstack/react-query"

import type { FolderTreeNode, LibraryTreeResponse } from "@/types/library"
import type { Project } from "@/types/project"

function patchProjectsInList(list: Project[], updated: Project): Project[] {
  const i = list.findIndex((p) => p.id === updated.id)
  if (i < 0) {
    return list
  }
  const next = [...list]
  next[i] = { ...next[i], ...updated }
  return next
}

function patchFolderTreeNodes(nodes: FolderTreeNode[], updated: Project): FolderTreeNode[] {
  return nodes.map((n) => ({
    ...n,
    projects: patchProjectsInList(n.projects, updated),
    children: patchFolderTreeNodes(n.children, updated),
  }))
}

function patchLibraryTree(tree: LibraryTreeResponse, updated: Project): LibraryTreeResponse {
  return {
    folders: patchFolderTreeNodes(tree.folders, updated),
    orphan_projects: patchProjectsInList(tree.orphan_projects, updated),
  }
}

/** 将单条项目变更写入资料库 tree / 列表类 query 缓存，使中间卡片与右侧预览一致。 */
export function patchProjectInLibraryCaches(queryClient: QueryClient, project: Project): void {
  queryClient.setQueriesData<LibraryTreeResponse>(
    {
      predicate: (q) =>
        q.queryKey[0] === "library" &&
        typeof q.queryKey[1] === "number" &&
        q.queryKey[2] === "tree",
    },
    (old) => (old ? patchLibraryTree(old, project) : old)
  )

  queryClient.setQueriesData<Project[]>(
    {
      predicate: (q) =>
        q.queryKey[0] === "projects" &&
        typeof q.queryKey[1] === "number" &&
        (q.queryKey[2] === "trash" || q.queryKey[2] === "missing-tags"),
    },
    (old) => (old ? patchProjectsInList(old, project) : old)
  )
}

export function projectUpdatedAtMs(p: Project): number {
  const t = Date.parse(p.updated_at)
  return Number.isFinite(t) ? t : 0
}
