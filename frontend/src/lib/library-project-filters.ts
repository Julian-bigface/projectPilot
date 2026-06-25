import type { FolderTreeNode } from "@/types/library"
import type { Project } from "@/types/project"

export type TagMatchMode = "any" | "all"

export type LibraryBrowseFilterState = {
  searchQuery: string
  selectedTagIds: number[]
  tagMatchMode: TagMatchMode
  selectedFolderIds: number[]
}

export function filterBySearch(projects: Project[], q: string): Project[] {
  const needle = q.trim().toLowerCase()
  if (!needle) {
    return projects
  }
  return projects.filter((p) => {
    const hay = [p.name, p.full_name, p.description ?? ""].join("\n").toLowerCase()
    return hay.includes(needle)
  })
}

/** 文件夹 id → 该文件夹直接绑定的标签 id */
export function collectFolderTagIdsMap(roots: FolderTreeNode[]): Map<number, number[]> {
  const map = new Map<number, number[]>()
  const walk = (nodes: FolderTreeNode[]) => {
    for (const n of nodes) {
      map.set(
        n.id,
        (n.tags ?? []).map((t) => t.id)
      )
      walk(n.children)
    }
  }
  walk(roots)
  return map
}

function effectiveTagIdsForProject(
  project: Project,
  folderTagIdsByFolderId?: Map<number, number[]>
): Set<number> {
  const ids = new Set((project.tags ?? []).map((t) => t.id))
  if (project.folder_id !== null && folderTagIdsByFolderId) {
    for (const tid of folderTagIdsByFolderId.get(project.folder_id) ?? []) {
      ids.add(tid)
    }
  }
  return ids
}

export function filterByTags(
  projects: Project[],
  tagIds: number[],
  mode: TagMatchMode,
  folderTagIdsByFolderId?: Map<number, number[]>
): Project[] {
  if (tagIds.length === 0) {
    return projects
  }
  const want = new Set(tagIds)
  return projects.filter((p) => {
    const have = effectiveTagIdsForProject(p, folderTagIdsByFolderId)
    if (mode === "any") {
      for (const id of want) {
        if (have.has(id)) {
          return true
        }
      }
      return false
    }
    for (const id of want) {
      if (!have.has(id)) {
        return false
      }
    }
    return true
  })
}

export function filterByFolders(projects: Project[], folderIds: number[]): Project[] {
  if (folderIds.length === 0) {
    return projects
  }
  const allow = new Set(folderIds)
  return projects.filter((p) => p.folder_id !== null && allow.has(p.folder_id))
}

export function applyLibraryFilters(
  projects: Project[],
  state: LibraryBrowseFilterState,
  folderTagIdsByFolderId?: Map<number, number[]>
): Project[] {
  let out = projects
  out = filterBySearch(out, state.searchQuery)
  out = filterByTags(out, state.selectedTagIds, state.tagMatchMode, folderTagIdsByFolderId)
  out = filterByFolders(out, state.selectedFolderIds)
  return out
}

/** 当前 scope 内可用于筛选的标签 id（项目标签 + 所在文件夹标签） */
export function collectTagIdsFromProjects(
  projects: Project[],
  folderTagIdsByFolderId?: Map<number, number[]>
): Set<number> {
  const ids = new Set<number>()
  for (const p of projects) {
    for (const tid of effectiveTagIdsForProject(p, folderTagIdsByFolderId)) {
      ids.add(tid)
    }
  }
  return ids
}

export function hasActiveLibraryFilters(state: LibraryBrowseFilterState): boolean {
  return (
    state.searchQuery.trim() !== "" ||
    state.selectedTagIds.length > 0 ||
    state.selectedFolderIds.length > 0
  )
}
