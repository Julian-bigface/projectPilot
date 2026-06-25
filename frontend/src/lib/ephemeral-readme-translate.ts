import { parseApiErrorMessage } from "@/lib/api-error"
import {
  joinReadmeBlocks,
  README_BLOCK_TRANSLATE_DELAY_MS,
  readmeBlockNeedsTranslation,
} from "@/lib/project-translate"

export async function fetchEphemeralReadmeBlocks(content: string): Promise<string[]> {
  const res = await fetch("/api/translation/readme-blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    throw new Error(await parseApiErrorMessage(res))
  }
  const data = (await res.json()) as { blocks: string[] }
  return data.blocks ?? []
}

export async function translateEphemeralReadmeBlock(content: string): Promise<string> {
  const res = await fetch("/api/translation/translate-readme-block", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    throw new Error(await parseApiErrorMessage(res))
  }
  const data = (await res.json()) as { translated: string }
  return data.translated
}

export async function translateEphemeralReadmeBlockWithRetry(
  content: string,
  maxAttempts = 3
): Promise<string> {
  let lastError: Error | undefined
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await translateEphemeralReadmeBlock(content)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 900 * (attempt + 1))
        })
      }
    }
  }
  throw lastError ?? new Error("段落翻译失败")
}

export { joinReadmeBlocks, README_BLOCK_TRANSLATE_DELAY_MS, readmeBlockNeedsTranslation }
