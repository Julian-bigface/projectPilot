export type MarkdownHeading = {
  level: number
  text: string
  id: string
}

export const README_HEADING_ATTR = "data-readme-heading"

/** 与 Markdown 渲染时一致的标题 slug（支持中文等 Unicode）。 */
export function slugifyMarkdownHeading(text: string): string {
  const cleaned = text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim()
    .toLowerCase()

  const slug = cleaned
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return slug || "section"
}

function assignHeadingId(text: string, slugCounts: Map<string, number>): string {
  const base = slugifyMarkdownHeading(text)
  const seen = slugCounts.get(base) ?? 0
  slugCounts.set(base, seen + 1)
  return seen === 0 ? base : `${base}-${seen}`
}

/** 从已渲染 DOM 同步标题列表，并补全缺失的 id。 */
export function syncDomMarkdownHeadings(root: HTMLElement): MarkdownHeading[] {
  const nodes = root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")
  const slugCounts = new Map<string, number>()
  const headings: MarkdownHeading[] = []

  nodes.forEach((el) => {
    const text = el.textContent?.trim() ?? ""
    if (!text) return

    let id = el.id
    if (!id) {
      id = assignHeadingId(text, slugCounts)
      el.id = id
      el.setAttribute(README_HEADING_ATTR, id)
    } else if (!el.hasAttribute(README_HEADING_ATTR)) {
      el.setAttribute(README_HEADING_ATTR, id)
    }

    headings.push({
      level: Number(el.tagName.charAt(1)),
      text,
      id,
    })
  })

  return headings
}

/** 从 Markdown 源码提取 ATX 标题（# …），顺序与渲染一致；跳过代码块内行。 */
export function extractMarkdownHeadings(content: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = []
  const slugCounts = new Map<string, number>()
  let inFence = false
  let fenceMarker = ""

  for (const line of content.split("\n")) {
    const fenceMatch = line.match(/^(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1]!
      if (!inFence) {
        inFence = true
        fenceMarker = marker
      } else if (line.startsWith(fenceMarker)) {
        inFence = false
        fenceMarker = ""
      }
      continue
    }
    if (inFence) continue

    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (!match) continue

    const level = match[1]!.length
    const rawText = match[2]!.replace(/\s+#+\s*$/, "").trim()
    if (!rawText) continue

    const plainText = rawText.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    headings.push({
      level,
      text: plainText,
      id: assignHeadingId(plainText, slugCounts),
    })
  }

  return headings
}

export function createHeadingIdAssigner(): {
  next: (text: string) => string
  reset: () => void
} {
  const slugCounts = new Map<string, number>()
  return {
    next: (text: string) => assignHeadingId(text, slugCounts),
    reset: () => slugCounts.clear(),
  }
}

function findScrollableAncestor(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement
  while (parent) {
    const { overflowY } = getComputedStyle(parent)
    if (/(auto|scroll|overlay)/.test(overflowY) && parent.scrollHeight > parent.clientHeight) {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

/** 在 README 容器内滚动到标题；优先滚动 main 或可滚动父级。 */
export function scrollToMarkdownHeading(id: string, searchRoot?: HTMLElement | null): void {
  const root = searchRoot ?? document
  const el =
    root.querySelector<HTMLElement>(`#${CSS.escape(id)}`) ??
    root.querySelector<HTMLElement>(`[${README_HEADING_ATTR}="${CSS.escape(id)}"]`) ??
    document.getElementById(id)

  if (!el) return

  const scrollParent =
    (searchRoot?.closest("main") as HTMLElement | null) ??
    findScrollableAncestor(el) ??
    (document.querySelector("main") as HTMLElement | null)

  scrollElementIntoView(el, scrollParent)
}

function scrollElementIntoView(el: HTMLElement, scrollParent: HTMLElement | null): void {
  const offset = 24

  if (scrollParent) {
    const top =
      el.getBoundingClientRect().top -
      scrollParent.getBoundingClientRect().top +
      scrollParent.scrollTop -
      offset
    scrollParent.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
    return
  }

  el.scrollIntoView({ behavior: "smooth", block: "start" })
}
