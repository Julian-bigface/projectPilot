/** Parse github.com owner/repo from pasted URL or host/path input. */

export type ParsedGithubRepo = {
  /** Canonical https://github.com/owner/repo */
  normalizedUrl: string
  /** Repository slug only, e.g. awesome-design-md */
  name: string
  /** owner/repo e.g. VoltAgent/awesome-design-md */
  full_name: string
}

export function parseGithubRepoUrl(raw: string): ParsedGithubRepo | null {
  const s = raw.trim()
  if (!s) {
    return null
  }
  let urlStr = s
  if (!/^https?:\/\//i.test(s)) {
    urlStr = `https://${s}`
  }
  let u: URL
  try {
    u = new URL(urlStr)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, "")
  if (host !== "github.com") {
    return null
  }
  const parts = u.pathname.split("/").filter(Boolean)
  if (parts.length < 2) {
    return null
  }
  const owner = parts[0]
  const repo = parts[1].replace(/\.git$/i, "")
  if (!owner || !repo) {
    return null
  }
  const full_name = `${owner}/${repo}`
  return {
    normalizedUrl: `https://github.com/${full_name}`,
    name: repo,
    full_name,
  }
}
