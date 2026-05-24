import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** 按源段落行数估算占位高度，翻译进行中显示 */
export function MarkdownBlockSkeleton({ source }: { source: string }) {
  const lineCount = Math.min(10, Math.max(2, source.split("\n").length))
  return (
    <div
      className="space-y-2 py-1"
      aria-busy
      aria-label="正在翻译本段"
    >
      {Array.from({ length: lineCount }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lineCount - 1 ? "w-[72%]" : "w-full")}
        />
      ))}
    </div>
  )
}
