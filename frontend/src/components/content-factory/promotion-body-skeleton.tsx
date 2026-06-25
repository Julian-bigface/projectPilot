import { Skeleton } from "@/components/ui/skeleton"

const BODY_SKELETON_LINES: Array<{ width: string }> = [
  { width: "w-full" },
  { width: "w-[96%]" },
  { width: "w-[88%]" },
  { width: "w-full" },
  { width: "w-[72%]" },
  { width: "w-[94%]" },
  { width: "w-[60%]" },
]

export function PromotionBodySkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3"
      aria-busy
      aria-label="正在重新生成正文"
    >
      {BODY_SKELETON_LINES.map((line, index) => (
        <Skeleton key={index} className={`h-3.5 ${line.width}`} />
      ))}
    </div>
  )
}
