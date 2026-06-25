/** 画面前缀 / 负向提示词胶囊：按分隔符拆条与合并。 */

const CAPSULE_CHUNK_SPLIT = /[；;]\s*/
const CAPSULE_SEGMENT_SPLIT = /[,，]\s*/

function splitPromptCapsuleChunk(chunk: string): string[] {
  return chunk
    .split(CAPSULE_SEGMENT_SPLIT)
    .map((segment) => segment.trim())
    .filter(Boolean)
}

export function splitPromptCapsules(value: string): string[] {
  if (!value.trim()) return []
  return value
    .trim()
    .split(CAPSULE_CHUNK_SPLIT)
    .flatMap((chunk) => splitPromptCapsuleChunk(chunk))
}

export function joinPromptCapsules(segments: string[]): string {
  if (segments.length === 0) return ""
  const separator = segments.some((segment) => /[\u4e00-\u9fff]/.test(segment)) ? "；" : ", "
  return segments.join(separator)
}
