import { parseGithubRepoUrl } from "@/lib/github-url"

const MD_SUFFIXES = [".md", ".markdown"]

function isMarkdownPath(path: string): boolean {
  const lower = path.toLowerCase()
  return MD_SUFFIXES.some((s) => lower.endsWith(s))
}

function normalizeRepoPath(path: string): string {
  const parts = path.split("/").filter(Boolean)
  const out: string[] = []
  for (const part of parts) {
    if (part === ".") {
      continue
    }
    if (part === "..") {
      out.pop()
      continue
    }
    out.push(part)
  }
  return out.join("/")
}

function resolveRelativePath(href: string, currentPath: string | null): string | null {
  const trimmed = href.trim()
  if (!trimmed || trimmed.startsWith("#")) {
    return null
  }
  const baseParts = currentPath ? currentPath.split("/") : []
  if (baseParts.length > 0) {
    baseParts.pop()
  }
  const relParts = trimmed.split("/")
  for (const part of relParts) {
    if (part === "" || part === ".") {
      continue
    }
    if (part === "..") {
      baseParts.pop()
      continue
    }
    baseParts.push(part)
  }
  const resolved = baseParts.join("/")
  return resolved && isMarkdownPath(resolved) ? resolved : null
}

function extractPathFromGithubBlobUrl(href: string, githubUrl: string): string | null {
  const parsed = parseGithubRepoUrl(githubUrl)
  if (!parsed) {
    return null
  }
  let url: URL
  try {
    url = new URL(href, "https://github.com")
  } catch {
    return null
  }
  if (url.hostname.replace(/^www\./i, "") !== "github.com") {
    return null
  }
  const [owner, repo] = parsed.full_name.split("/")
  if (!owner || !repo) {
    return null
  }
  const parts = url.pathname.split("/").filter(Boolean)
  if (parts.length < 5 || parts[0] !== owner || parts[1] !== repo) {
    return null
  }
  const kind = parts[2]
  if (kind !== "blob" && kind !== "raw") {
    return null
  }
  const filePath = parts.slice(3).join("/")
  if (!filePath || !isMarkdownPath(filePath)) {
    return null
  }
  return normalizeRepoPath(filePath)
}

/**
 * 若 href 指向同仓库内 Markdown 文件，返回仓库内路径（如 README.zh-CN.md）；否则 null。
 */
export function resolveReadmeRepoPath(
  href: string | undefined,
  currentPath: string | null,
  githubUrl: string
): string | null {
  if (!href?.trim()) {
    return null
  }
  const raw = href.trim()
  if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
    return extractPathFromGithubBlobUrl(raw, githubUrl)
  }
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    const path = normalizeRepoPath(raw.slice(1))
    return path && isMarkdownPath(path) ? path : null
  }
  return resolveRelativePath(raw, currentPath)
}
