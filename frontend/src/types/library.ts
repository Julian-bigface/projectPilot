import type { Project } from "@/types/project"

/** 与后端 `FolderTreeNode` / `LibraryTreeResponse` 对齐 */
export interface FolderTreeNode {
  id: number
  name: string
  tags?: FolderTagBrief[]
  children: FolderTreeNode[]
  projects: Project[]
}

export interface LibraryTreeResponse {
  folders: FolderTreeNode[]
  orphan_projects: Project[]
}

/** 与后端 TagBrief 对齐 */
export interface FolderTagBrief {
  id: number
  name: string
  category_id: number | null
}

export interface FolderRow {
  id: number
  parent_id: number | null
  name: string
  description: string | null
  sort_order: number
  tags: FolderTagBrief[]
  created_at: string
  updated_at: string
}
