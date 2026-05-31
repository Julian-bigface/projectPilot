import { parseGithubRepoUrl } from "@/lib/github-url"

function normalizeRepoPath(path: string): string {
  const parts = path.split("/").filter(Boolean)
  const out: string[] = []
  for (const part of parts) {
    if (part === ".") continue
    if (part === "..") {
      out.pop()
      continue
    }
    out.push(part)
  }
  return out.join("/")
}

/** README 所在目录（不含文件名），默认仓库根。 */
export function readmeDirectoryFromBasePath(readmeBasePath: string | null | undefined): string {
  if (!readmeBasePath?.trim()) return ""
  const parts = normalizeRepoPath(readmeBasePath.trim()).split("/").filter(Boolean)
  if (parts.length <= 1) return ""
  parts.pop()
  return parts.join("/")
}

/** GitHub raw 内容 base URL，用于解析相对图片/资源路径。 */
export function readmeRawBaseUrl(
  githubUrl: string | undefined,
  readmeBasePath?: string | null
): string | null {
  if (!githubUrl?.trim()) return null
  const parsed = parseGithubRepoUrl(githubUrl)
  if (!parsed) return null
  const dir = readmeDirectoryFromBasePath(readmeBasePath)
  const suffix = dir ? `${dir}/` : ""
  return `${parsed.normalizedUrl}/raw/HEAD/${suffix}`
}

/** 将 README 内图片 src 解析为可加载的绝对 URL。 */
export function resolveReadmeImageSrc(
  src: string | undefined,
  githubUrl: string | undefined,
  readmeBasePath?: string | null
): string | undefined {
  if (!src?.trim()) return src
  const trimmed = src.trim()
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("//")
  ) {
    return trimmed
  }
  const base = readmeRawBaseUrl(githubUrl, readmeBasePath)
  if (!base) return trimmed
  try {
    return new URL(trimmed, base).href
  } catch {
    return trimmed
  }
}
