import { parseApiErrorMessage } from "@/lib/api-error"
import type { Project } from "@/types/project"

export type TranslateField = "description" | "readme"

export async function translateProject(
  projectId: number,
  fields: TranslateField[]
): Promise<Project> {
  const res = await fetch(`/api/projects/${projectId}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    throw new Error(await parseApiErrorMessage(res))
  }
  return res.json() as Promise<Project>
}

export async function fetchReadmeBlocks(projectId: number): Promise<string[]> {
  const res = await fetch(`/api/projects/${projectId}/readme/blocks`)
  if (!res.ok) {
    throw new Error(await parseApiErrorMessage(res))
  }
  const data = (await res.json()) as { blocks: string[] }
  return data.blocks ?? []
}

export async function translateReadmeBlock(
  projectId: number,
  content: string
): Promise<string> {
  const res = await fetch(`/api/projects/${projectId}/translate/readme-block`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const message = await parseApiErrorMessage(res)
    const error = new Error(message) as Error & { httpStatus?: number }
    error.httpStatus = res.status
    throw error
  }
  const data = (await res.json()) as { translated: string }
  return data.translated
}

/** 分段翻译间隔，降低 Google 免费通道触发限流的概率 */
export const README_BLOCK_TRANSLATE_DELAY_MS = 450

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/** 带退避重试的单段翻译（应对限流/瞬时网络错误） */
export async function translateReadmeBlockWithRetry(
  projectId: number,
  content: string,
  maxAttempts = 3
): Promise<string> {
  let lastError: Error | undefined
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await translateReadmeBlock(projectId, content)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const httpStatus = (err as Error & { httpStatus?: number }).httpStatus
      const retryable =
        httpStatus !== 424 &&
        (lastError.message.includes("限流") ||
          lastError.message.includes("网络") ||
          lastError.message.includes("稍后重试"))
      if (!retryable || attempt >= maxAttempts - 1) {
        break
      }
      await sleep(900 * (attempt + 1))
    }
  }
  throw lastError ?? new Error("段落翻译失败")
}

/** 与后端 block_needs_translation 一致：fenced 代码块不请求翻译 */
export function readmeBlockNeedsTranslation(block: string): boolean {
  const stripped = block.trim()
  if (!stripped) return false
  if (stripped.startsWith("```")) return false
  return true
}

export function joinReadmeBlocks(blocks: string[]): string {
  return blocks.join("\n\n")
}

/** 按保存时的 join 规则拆回分段；段数不一致时返回 null（如手动改过全文） */
export function splitReadmeTranslatedBlocks(
  translated: string,
  expectedCount: number
): string[] | null {
  const parts = translated.split("\n\n")
  if (parts.length !== expectedCount) return null
  return parts
}

/** 译文与原文完全相同的可译段落视为失败/未译 */
export function detectFailedReadmeBlockIndices(
  sources: string[],
  translatedParts: string[]
): number[] {
  const failed: number[] = []
  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i]!
    if (!readmeBlockNeedsTranslation(source)) continue
    const part = translatedParts[i]
    if (part === undefined || part.trim() === source.trim()) {
      failed.push(i)
    }
  }
  return failed
}
