export interface TagCategory {
  id: number
  name: string
  sort_order: number
  created_at: string
}

export interface TagWithUsage {
  id: number
  name: string
  category_id: number | null
  category_name: string | null
  project_usage_count: number
  folder_usage_count: number
  usage_count: number
}
