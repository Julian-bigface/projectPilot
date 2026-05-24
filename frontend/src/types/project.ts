export const PROJECT_STATES = [
  "未体验",
  "正在体验",
  "推荐归档",
  "放弃归档",
] as const

export type ProjectState = (typeof PROJECT_STATES)[number]

/** 与后端 TagBrief 对齐 */
export interface ProjectTagBrief {
  id: number
  name: string
  category_id: number | null
}

export interface Project {
  id: number
  folder_id: number | null
  folder_name: string | null
  github_url: string
  name: string
  full_name: string
  description: string | null
  stars: number
  language: string | null
  author: string | null
  license: string | null
  ai_summary: string | null
  notes: string | null
  deploy_methods: string[] | null
  topics: string[]
  forks: number
  github_pushed_at: string | null
  github_release_tag: string | null
  state: ProjectState
  state_changed_at: string | null
  created_at: string
  updated_at: string
  /** 非空表示在回收站（软删除） */
  deleted_at?: string | null
  tags: ProjectTagBrief[]
}
