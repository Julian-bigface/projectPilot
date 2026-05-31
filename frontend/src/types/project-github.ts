export interface ProjectReadme {
  content: string
  source: "cache" | "github"
  path?: string | null
  is_default?: boolean
  cached_at?: string | null
  github_sha?: string | null
  content_changed?: boolean
}

export interface ProjectReleaseAsset {
  name: string
  size: number | null
  download_count: number
  browser_download_url: string
  updated_at: string | null
}

export interface ProjectRelease {
  tag_name: string
  name: string | null
  body: string | null
  published_at: string | null
  html_url: string | null
  prerelease: boolean
  draft: boolean
  assets?: ProjectReleaseAsset[]
}

export interface ProjectReleasesResponse {
  items: ProjectRelease[]
  source?: "cache" | "github"
  cached_at?: string | null
  content_changed?: boolean
}

export type ProjectDetailTab = "readme" | "release" | "notes"

export const PROJECT_DETAIL_TABS: ProjectDetailTab[] = ["readme", "release", "notes"]

export function parseProjectDetailTab(value: string | null): ProjectDetailTab {
  if (value === "release" || value === "notes") {
    return value
  }
  return "readme"
}
