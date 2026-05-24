import { cn } from "@/lib/utils"

/** 与 GitHub 卡片上 language/topics 行一致的浅色胶囊调色板 */
export const TOPIC_PILL_CLASSES = [
  "bg-sky-100 text-sky-900 dark:bg-sky-950/55 dark:text-sky-100",
  "bg-orange-100 text-orange-950 dark:bg-orange-950/45 dark:text-orange-100",
  "bg-violet-100 text-violet-900 dark:bg-violet-950/55 dark:text-violet-100",
  "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100",
  "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100",
  "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
] as const

export function topicPillClass(index: number): string {
  return TOPIC_PILL_CLASSES[index % TOPIC_PILL_CLASSES.length] ?? TOPIC_PILL_CLASSES[0]
}

/** 领域标签等：与 language/topics 行相同的圆角胶囊 + 按 id 稳定取色 */
export function domainTagPillClass(tagId: number): string {
  return cn(
    "inline-flex max-w-full min-w-0 items-center rounded-full px-2 py-px text-[11px] font-medium leading-none",
    topicPillClass(tagId),
  )
}
