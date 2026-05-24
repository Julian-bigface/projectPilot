import type { Project } from "@/types/project"

/** 从 `owner/repo` 解析 owner，用于 GitHub 头像 URL 等 */
export function parseGithubOwner(fullName: string): string | null {
  const t = fullName.trim()
  const i = t.indexOf("/")
  if (i <= 0 || i >= t.length - 1) {
    return null
  }
  return t.slice(0, i)
}

/** 列表/侧栏副标题：优先用户填写的简介，否则退回仓库坐标便于辨认 */
export function projectSubtitle(p: Project): string {
  const d = p.description?.trim()
  if (d) {
    return d
  }
  return p.full_name
}
