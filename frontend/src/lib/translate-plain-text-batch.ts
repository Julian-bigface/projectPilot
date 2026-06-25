import { translatePlainText } from "@/lib/translate-plain-text"

export type DescriptionTranslateJob = {
  fullName: string
  source: string
}

export type BuildDescriptionTranslateJobsResult = {
  /** 待翻译任务（按 fullName，同一 source 可重复出现） */
  jobs: DescriptionTranslateJob[]
  /** source 文本 -> 需写入译文的 fullName 列表 */
  fullNamesBySource: Map<string, string[]>
  /** 去重后的唯一 source 列表 */
  uniqueSources: string[]
}

export function buildDescriptionTranslateJobs(
  items: Array<{ fullName: string; source: string | null | undefined }>,
  alreadyTranslated: ReadonlySet<string> = new Set()
): BuildDescriptionTranslateJobsResult {
  const jobs: DescriptionTranslateJob[] = []
  const fullNamesBySource = new Map<string, string[]>()

  for (const { fullName, source } of items) {
    const trimmed = source?.trim() ?? ""
    if (!trimmed || alreadyTranslated.has(fullName)) {
      continue
    }
    jobs.push({ fullName, source: trimmed })
    const names = fullNamesBySource.get(trimmed) ?? []
    names.push(fullName)
    fullNamesBySource.set(trimmed, names)
  }

  const uniqueSources = [...fullNamesBySource.keys()]
  return { jobs, fullNamesBySource, uniqueSources }
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

export type TranslateDescriptionsBatchOptions = {
  batchSize?: number
  onProgress?: (done: number, total: number) => void
  onSourceComplete?: (source: string, translated: string) => void
  onSourceFailed?: (source: string) => void
  signal?: AbortSignal
}

export type TranslateDescriptionsBatchResult = {
  /** source -> translated */
  bySource: Map<string, string>
  failedSources: string[]
}

export async function translateDescriptionsBatch(
  uniqueSources: string[],
  options: TranslateDescriptionsBatchOptions = {}
): Promise<TranslateDescriptionsBatchResult> {
  const batchSize = options.batchSize ?? 5
  const bySource = new Map<string, string>()
  const failedSources: string[] = []
  const total = uniqueSources.length
  let done = 0

  options.onProgress?.(done, total)

  for (const batch of chunk(uniqueSources, batchSize)) {
    if (options.signal?.aborted) {
      break
    }

    await Promise.all(
      batch.map(async (source) => {
        if (options.signal?.aborted) {
          return
        }
        try {
          const translated = await translatePlainText(source)
          bySource.set(source, translated)
          options.onSourceComplete?.(source, translated)
        } catch {
          failedSources.push(source)
          options.onSourceFailed?.(source)
        } finally {
          done += 1
          options.onProgress?.(done, total)
        }
      })
    )
  }

  return { bySource, failedSources }
}

/** 将 batch 结果展开为 full_name -> translated */
export function mapTranslationsToFullNames(
  fullNamesBySource: Map<string, string[]>,
  bySource: Map<string, string>
): Map<string, string> {
  const result = new Map<string, string>()
  for (const [source, fullNames] of fullNamesBySource) {
    const translated = bySource.get(source)
    if (!translated) {
      continue
    }
    for (const fullName of fullNames) {
      result.set(fullName, translated)
    }
  }
  return result
}
