import type { FolderTreeNode } from "@/types/library"
import type { Project } from "@/types/project"

export type TagMatchMode = "any" | "all"

/** 按 `created_at` 相对当前时间的快捷范围；`null` 表示不限。 */
export type AddedTimePreset = "7d" | "30d" | "90d" | "365d"

export const ADDED_TIME_PRESET_DAYS: Record<AddedTimePreset, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
}

export const ADDED_TIME_PRESET_LABELS: Record<AddedTimePreset, string> = {
  "7d": "最近 7 天",
  "30d": "最近 30 天",
  "90d": "最近 3 个月",
  "365d": "最近 1 年",
}

export type LibraryBrowseFilterState = {
  searchQuery: string
  selectedTagIds: number[]
  tagMatchMode: TagMatchMode
  selectedFolderIds: number[]
  addedTimePreset: AddedTimePreset | null
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

export function filterByAddedTime(
  projects: Project[],
  preset: AddedTimePreset | null,
  now: Date = new Date()
): Project[] {
  if (!preset) {
    return projects
  }
  const days = ADDED_TIME_PRESET_DAYS[preset]
  const cutoffMs = now.getTime() - days * 24 * 60 * 60 * 1000
  return projects.filter((p) => {
    const ts = Date.parse(p.created_at)
    return Number.isFinite(ts) && ts >= cutoffMs
  })
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
  out = filterByAddedTime(out, state.addedTimePreset)
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
    state.selectedFolderIds.length > 0 ||
    state.addedTimePreset !== null
  )
}
