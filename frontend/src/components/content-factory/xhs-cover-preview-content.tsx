import { Battery, ChevronDown, Heart, Menu, Plus, Search, Signal, Wifi } from "lucide-react"

import { cn } from "@/lib/utils"

type XhsCoverPreviewContentProps = {
  coverUrl: string | null
  title: string
  authorName?: string
  className?: string
}

function StatusBar() {
  return (
    <div className="flex shrink-0 items-center justify-between px-4 pt-1 pb-0.5 text-[9px] font-semibold text-neutral-900">
      <span className="tabular-nums">9:41</span>
      <div className="flex items-center gap-1 text-neutral-800">
        <Signal className="size-2.5" aria-hidden />
        <Wifi className="size-2.5" aria-hidden />
        <Battery className="size-3.5" aria-hidden />
      </div>
    </div>
  )
}

function AuthorAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0) || "预"
  return (
    <div
      className="bg-muted text-muted-foreground flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold"
      aria-hidden
    >
      {initial}
    </div>
  )
}

function FeedCard({
  coverUrl,
  title,
  authorName,
  featured = false,
}: {
  coverUrl: string | null
  title: string
  authorName: string
  featured?: boolean
}) {
  const displayTitle = title.trim() || "示例笔记标题"
  return (
    <article
      className={cn(
        "overflow-hidden rounded-md bg-white",
        featured && "ring-1 ring-[#FE2C55]/40"
      )}
    >
      {coverUrl ? (
        <img src={coverUrl} alt="" className="aspect-[3/4] w-full object-cover" />
      ) : (
        <div className="bg-muted text-muted-foreground flex aspect-[3/4] w-full items-center justify-center text-center text-[9px] leading-snug">
          暂无封面
        </div>
      )}
      <div className="space-y-1.5 p-1.5">
        <p className="line-clamp-2 text-[10px] leading-snug font-medium text-neutral-900">
          {displayTitle}
        </p>
        <div className="flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1">
            <AuthorAvatar name={authorName} />
            <span className="truncate text-[9px] text-neutral-500">{authorName}</span>
          </div>
          <span className="flex shrink-0 items-center gap-0.5 text-[9px] text-neutral-400">
            <Heart className="size-2.5" aria-hidden />
            0
          </span>
        </div>
      </div>
    </article>
  )
}

function PlaceholderCard({ tall = false }: { tall?: boolean }) {
  return (
    <article className="overflow-hidden rounded-md bg-white">
      <div className={cn("w-full bg-neutral-100", tall ? "aspect-[3/5]" : "aspect-square")} />
      <div className="space-y-1.5 p-1.5">
        <div className="h-2.5 w-4/5 rounded bg-neutral-100" />
        <div className="flex items-center justify-between">
          <div className="h-2 w-1/2 rounded bg-neutral-100" />
          <div className="h-2 w-6 rounded bg-neutral-100" />
        </div>
      </div>
    </article>
  )
}

export function XhsCoverPreviewContent({
  coverUrl,
  title,
  authorName = "项目推广预览",
  className,
}: XhsCoverPreviewContentProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col bg-white text-neutral-900", className)}>
      <StatusBar />

      <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-2.5 py-1.5">
        <Menu className="size-3.5 text-neutral-500" aria-hidden />
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-neutral-400">关注</span>
          <span className="relative font-semibold text-neutral-900">
            发现
            <span
              className="absolute -bottom-1.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-[#FE2C55]"
              aria-hidden
            />
          </span>
          <span className="text-neutral-400">附近</span>
        </div>
        <Search className="size-3.5 text-neutral-500" aria-hidden />
      </div>

      <div className="flex shrink-0 items-center border-b border-neutral-100 py-2 pr-1.5 pl-2.5 text-[10px]">
        <div className="flex min-w-0 flex-1 items-center justify-between">
          <span className="font-bold text-neutral-900">推荐</span>
          <span className="text-neutral-400">直播</span>
          <span className="text-neutral-400">短剧</span>
          <span className="text-neutral-400">穿搭</span>
          <span className="text-neutral-400">旅行</span>
          <span className="text-neutral-400">动漫</span>
        </div>
        <ChevronDown className="size-3 shrink-0 text-neutral-400" aria-hidden />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          <FeedCard featured coverUrl={coverUrl} title={title} authorName={authorName} />
          <PlaceholderCard tall />
          <PlaceholderCard />
          <PlaceholderCard tall />
          <PlaceholderCard />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-around border-t border-neutral-100 py-1.5 text-[9px] text-neutral-400">
        <span>首页</span>
        <span>市集</span>
        <span className="flex size-7 items-center justify-center rounded-full bg-[#FE2C55] text-white">
          <Plus className="size-4" aria-hidden />
        </span>
        <span>消息</span>
        <span>我</span>
      </div>
    </div>
  )
}
