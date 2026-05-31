import { parseApiErrorMessage } from "@/lib/api-error"

export async function translatePlainText(content: string): Promise<string> {
  const res = await fetch("/api/translation/translate-text", {
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
