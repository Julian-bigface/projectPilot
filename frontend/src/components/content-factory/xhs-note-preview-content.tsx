import { Heart, MessageCircle, Share2, Star } from "lucide-react"

import { cn } from "@/lib/utils"

type XhsNotePreviewContentProps = {
  title: string
  body: string
  coverUrl: string | null
  authorName?: string
  className?: string
}

function AuthorAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0) || "预"
  return (
    <div
      className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      aria-hidden
    >
      {initial}
    </div>
  )
}

export function XhsNotePreviewContent({
  title,
  body,
  coverUrl,
  authorName = "项目推广预览",
  className,
}: XhsNotePreviewContentProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col bg-white text-neutral-900", className)}>
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-100 px-3 py-2">
        <AuthorAvatar name={authorName} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{authorName}</span>
        <button
          type="button"
          className="shrink-0 rounded-full bg-[#FE2C55] px-2.5 py-0.5 text-[10px] font-medium text-white"
          tabIndex={-1}
        >
          关注
        </button>
        <Share2 className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="aspect-[3/4] w-full object-cover" />
        ) : (
          <div className="bg-muted text-muted-foreground flex aspect-[3/4] w-full items-center justify-center text-center text-xs leading-relaxed">
            暂无封面
            <br />
            建议返回编辑生成
          </div>
        )}

        <div className="space-y-2 px-3 py-3">
          {title ? (
            <h2 className="text-sm leading-snug font-bold">{title}</h2>
          ) : (
            <p className="text-muted-foreground text-sm">（无标题）</p>
          )}
          {body ? (
            <p className="text-xs leading-relaxed whitespace-pre-wrap text-neutral-700">{body}</p>
          ) : (
            <p className="text-muted-foreground text-xs">（无正文）</p>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-neutral-100 px-3 py-2">
        <div className="text-muted-foreground mb-2 rounded-full bg-neutral-100 px-3 py-1.5 text-[10px]">
          说点什么…
        </div>
        <div className="text-muted-foreground flex items-center justify-around text-[10px]">
          <span className="flex items-center gap-1">
            <Heart className="size-3.5" aria-hidden />
            赞
          </span>
          <span className="flex items-center gap-1">
            <Star className="size-3.5" aria-hidden />
            收藏
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="size-3.5" aria-hidden />
            评论
          </span>
        </div>
      </div>
    </div>
  )
}
