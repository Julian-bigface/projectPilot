export interface ProjectReadme {
  content: string
  source: "github"
}

export interface ProjectRelease {
  tag_name: string
  name: string | null
  body: string | null
  published_at: string | null
  html_url: string | null
  prerelease: boolean
  draft: boolean
}

export interface ProjectReleasesResponse {
  items: ProjectRelease[]
}

export type ProjectDetailTab = "readme" | "release" | "notes"

export const PROJECT_DETAIL_TABS: ProjectDetailTab[] = ["readme", "release", "notes"]

export function parseProjectDetailTab(value: string | null): ProjectDetailTab {
  if (value === "release" || value === "notes") {
    return value
  }
  return "readme"
}
