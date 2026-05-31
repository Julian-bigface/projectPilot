/** 趋势 RSS / 旧缓存中的 description 是否为非 GitHub 短简介 */
export function isRssAggregateDescription(desc: string | null | undefined): boolean {
  if (!desc?.trim()) {
    return false
  }
  const text = desc.trim()
  if (text.length > 350) {
    return true
  }
  if (text.includes("▒") || text.includes("░")) {
    return true
  }
  if (text.startsWith("⭐") && text.includes("|") && text.length < 80) {
    return true
  }
  return false
}

/** 列表/预览展示用：优先 GitHub 短简介，过滤 RSS 聚合长文 */
export function pickDiscoveryRepoDescription(
  description: string | null | undefined,
  githubDescription?: string | null | undefined
): string | null {
  const gh = githubDescription?.trim()
  if (gh) {
    return gh
  }
  const trimmed = description?.trim()
  if (!trimmed) {
    return null
  }
  if (isRssAggregateDescription(trimmed)) {
    return null
  }
  return trimmed
}
