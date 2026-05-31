import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type DiscoveryRepoCardSkeletonProps = {
  count?: number
  className?: string
}

function DiscoveryRepoCardSkeletonItem() {
  return (
    <article className="border-border bg-card/50 flex gap-3 rounded-xl border p-3 sm:gap-4 sm:p-4">
      <Skeleton className="size-8 shrink-0 rounded-lg sm:size-9" />
      <Skeleton className="size-10 shrink-0 rounded-full sm:size-11" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-5 w-40 max-w-full" />
        <Skeleton className="h-3 w-56 max-w-full" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="flex gap-3 pt-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-7 w-[72px] rounded-md" />
      </div>
    </article>
  )
}

export function DiscoveryRepoListSkeleton({ count = 8, className }: DiscoveryRepoCardSkeletonProps) {
  return (
    <ul className={cn("flex flex-col gap-3", className)} aria-busy="true" aria-label="正在加载仓库列表">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <DiscoveryRepoCardSkeletonItem />
        </li>
      ))}
    </ul>
  )
}
