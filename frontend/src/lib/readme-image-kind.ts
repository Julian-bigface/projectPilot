const SMALL_BADGE_URL_PATTERNS = [
  /shields\.io/i,
  /img\.shields\.io/i,
  /badgen\.net/i,
  /badges\.crowdin\.net/i,
  /github\.com\/.*\/(?:actions\/)?workflows\/.*\/badge/i,
  /codecov\.io/i,
  /circleci\.com\/.*\/badge/i,
  /goreportcard\.com\/badge/i,
  /vsmarketplacebadge/i,
  /app\.netlify\.com\/.*\/deploy/i,
  /heroku\.com\/button/i,
]

/** 路径含 badge 但实为居中横幅（Trendshift 等），非 shields 式行内小徽章。 */
const HERO_BADGE_URL_PATTERNS = [/trendshift\.io/i]

/** README 顶部居中横幅徽章（Trendshift 排行图等）。 */
export function isReadmeHeroBadgeImage(src?: string | null): boolean {
  const normalizedSrc = src?.trim() ?? ""
  if (!normalizedSrc) return false
  return HERO_BADGE_URL_PATTERNS.some((pattern) => pattern.test(normalizedSrc))
}

/** README 内联小徽章（shields 等）与正文大图（截图等）区分。 */
export function isReadmeBadgeImage(src?: string | null, alt?: string | null): boolean {
  const normalizedSrc = src?.trim() ?? ""
  const normalizedAlt = alt?.trim().toLowerCase() ?? ""

  if (!normalizedSrc) {
    return normalizedAlt.includes("badge")
  }

  if (isReadmeHeroBadgeImage(normalizedSrc)) {
    return false
  }

  if (SMALL_BADGE_URL_PATTERNS.some((pattern) => pattern.test(normalizedSrc))) {
    return true
  }

  return normalizedAlt.includes("badge")
}
