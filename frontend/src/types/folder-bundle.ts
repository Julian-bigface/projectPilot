/** 文件夹子树便携包（与后端 FolderBundle 对齐） */

export type BundleTagSpec = {
  name: string
  category_name?: string | null
}

export type BundleFolderSpec = {
  key: string
  parent_key: string | null
  name: string
  description?: string | null
  sort_order?: number
  tags?: BundleTagSpec[]
}

export type BundleProjectSpec = {
  key: string
  folder_key: string | null
  github_url: string
  name: string
  full_name: string
  description?: string | null
  stars?: number
  language?: string | null
  author?: string | null
  license?: string | null
  ai_summary?: string | null
  notes?: string | null
  deploy_methods?: string[] | null
  state?: string
  tags?: BundleTagSpec[]
}

export type BundleSourceInfo = {
  library_name: string
  root_folder_name: string
}

export type FolderBundle = {
  format_version: 1
  kind: "project_pilot.folder_bundle"
  exported_at: string
  source: BundleSourceInfo
  folders: BundleFolderSpec[]
  projects: BundleProjectSpec[]
}

export type FolderBundleImportResult = {
  created_folders: number
  created_projects: number
  skipped_projects: number
  errors: string[]
}
