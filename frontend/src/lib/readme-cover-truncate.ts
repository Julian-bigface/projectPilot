const MAX_LINES = 150
const MAX_CHARS = 16_000

function applySizeLimits(text: string): string {
  let out = text
  const lines = out.split("\n")
  if (lines.length > MAX_LINES) {
    out = lines.slice(0, MAX_LINES).join("\n")
  }
  if (out.length > MAX_CHARS) {
    out = out.slice(0, MAX_CHARS)
  }
  return out
}

/**
 * 封面截图用 README：不做 ## 等语义截断，与标签页渲染同一套 markdown；
 * 仅限制行数/字符以防 DOM 过大，超出 3:4 画布由 overflow:hidden 裁切。
 */
export function truncateReadmeHeroMarkdown(content: string): string {
  const text = content.trim()
  if (!text) {
    return ""
  }
  return applySizeLimits(text)
}

/** @deprecated 使用 truncateReadmeHeroMarkdown */
export function truncateReadmeMarkdown(content: string): string {
  return truncateReadmeHeroMarkdown(content)
}
