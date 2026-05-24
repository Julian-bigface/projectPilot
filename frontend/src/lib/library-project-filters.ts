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

export function filterByTags(projects: Project[], tagIds: number[], mode: TagMatchMode): Project[] {
  if (tagIds.length === 0) {
    return projects
  }
  const want = new Set(tagIds)
  return projects.filter((p) => {
    const have = new Set((p.tags ?? []).map((t) => t.id))
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

export function applyLibraryFilters(projects: Project[], state: LibraryBrowseFilterState): Project[] {
  let out = projects
  out = filterBySearch(out, state.searchQuery)
  out = filterByTags(out, state.selectedTagIds, state.tagMatchMode)
  out = filterByFolders(out, state.selectedFolderIds)
  return out
}

/** 当前 scope 项目列表上出现过的标签 id */
export function collectTagIdsFromProjects(projects: Project[]): Set<number> {
  const ids = new Set<number>()
  for (const p of projects) {
    for (const t of p.tags ?? []) {
      ids.add(t.id)
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
