export type ProjectLibrary = {
  id: number
  name: string
  description: string | null
  is_pinned: boolean
  sort_order: number
  project_count: number
  created_at: string
  updated_at: string
}

export type ProjectLibraryCreate = {
  name: string
  description?: string | null
}

export type ProjectLibraryUpdate = {
  name?: string
  description?: string | null
  is_pinned?: boolean
  sort_order?: number
}
