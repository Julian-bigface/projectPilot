import type { CaptureProgressUpdate } from "@/lib/readme-cover-capture"

export function formatCoverProgressLabel(
  update: CaptureProgressUpdate,
  attempt = 1,
  maxAttempts = 1
): string {
  const attemptSuffix =
    attempt > 1 && maxAttempts > 1 ? `（第 ${attempt}/${maxAttempts} 轮）` : ""

  switch (update.phase) {
    case "layout":
      return `正在排版 README…${attemptSuffix}`
    case "inline":
      if (update.total > 0) {
        return `正在加载图片 ${update.loaded}/${update.total}${attemptSuffix}`
      }
      return `正在加载图片…${attemptSuffix}`
    case "wait":
      if (update.total > 0) {
        return `等待图片就绪 ${update.loaded}/${update.total}${attemptSuffix}`
      }
      return `等待图片就绪…${attemptSuffix}`
    case "export":
      return `正在合成封面…${attemptSuffix}`
    default:
      return `正在截取 README 封面…${attemptSuffix}`
  }
}

export function coverProgressShowsDetail(label: string | null | undefined): boolean {
  return Boolean(label && /\d+\s*\/\s*\d+/.test(label))
}

const PROGRESS_THROTTLE_MS = 120

/** 节流进度回调，避免高频 setState / flushSync 导致页面卡死或白屏 */
export function createCoverProgressReporter(
  setLabel: (label: string) => void,
  attempt: number,
  maxAttempts: number
): (update: CaptureProgressUpdate) => void {
  let lastEmitAt = 0
  let lastLabel = ""

  return (update: CaptureProgressUpdate) => {
    const label = formatCoverProgressLabel(update, attempt, maxAttempts)
    const now = Date.now()
    const isMilestone =
      update.phase === "export" ||
      update.phase === "layout" ||
      (update.total > 0 && update.loaded >= update.total)
    if (label === lastLabel) {
      return
    }
    if (!isMilestone && now - lastEmitAt < PROGRESS_THROTTLE_MS) {
      return
    }
    lastEmitAt = now
    lastLabel = label
    setLabel(label)
  }
}
