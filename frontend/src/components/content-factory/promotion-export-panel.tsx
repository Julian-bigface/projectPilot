import { Download, ImageIcon, Plus } from "lucide-react"
import { toast } from "sonner"

import { PromotionTitlePicker } from "@/components/content-factory/promotion-title-picker"
import { XhsPhonePreview } from "@/components/content-factory/xhs-phone-preview"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { buildExportMarkdown } from "@/lib/content-factory-api"
import { cn } from "@/lib/utils"
import type { ContentFactoryDraft } from "@/types/content-factory"

const MAX_BODY_CHARS = 1000
const MAX_TITLE_CHARS = 512

const fieldBase =
  "border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 resize-none"

type PromotionExportPanelProps = {
  title: string
  body: string
  titleOptions: string[]
  coverUrl: string | null
  suggestingTitles: boolean
  onTitleChange: (value: string) => void
  onBodyChange: (value: string) => void
  onSuggestTitles: () => void
  onDownloadCover: () => void
}

export function PromotionExportPanel({
  title,
  body,
  titleOptions,
  coverUrl,
  suggestingTitles,
  onTitleChange,
  onBodyChange,
  onSuggestTitles,
  onDownloadCover,
}: PromotionExportPanelProps) {
  return (
    <div className="flex min-h-[520px] flex-col gap-4">
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="border-border rounded-lg border bg-card p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">图片编辑</span>
              <span className="text-muted-foreground text-xs tabular-nums">1 / 1</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="border-border relative size-24 overflow-hidden rounded-md border">
                {coverUrl ? (
                  <img src={coverUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="bg-muted text-muted-foreground flex size-full flex-col items-center justify-center gap-1 text-[10px]">
                    <ImageIcon className="size-5 opacity-50" aria-hidden />
                    暂无封面
                  </div>
                )}
                <span className="absolute top-1 left-1 flex size-4 items-center justify-center rounded bg-black/60 text-[10px] font-medium text-white">
                  1
                </span>
              </div>
              <button
                type="button"
                disabled
                title="多图上传即将支持"
                className="border-border text-muted-foreground flex size-24 items-center justify-center rounded-md border border-dashed opacity-50"
              >
                <Plus className="size-5" aria-hidden />
              </button>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={!coverUrl}
                onClick={onDownloadCover}
              >
                <Download className="mr-1.5 size-3.5" aria-hidden />
                下载封面
              </Button>
            </div>
          </div>

          <div className="border-border flex min-h-0 flex-1 flex-col rounded-lg border bg-card">
            <div className="flex h-10 shrink-0 items-center gap-1 border-b px-4">
              <Input
                aria-label="标题"
                className={cn(
                  fieldBase,
                  "text-foreground h-10 min-w-0 flex-1 text-base font-bold"
                )}
                placeholder="标题"
                value={title}
                maxLength={MAX_TITLE_CHARS}
                onChange={(e) => onTitleChange(e.target.value)}
              />
              <PromotionTitlePicker
                platform="xiaohongshu"
                title={title}
                titleOptions={titleOptions}
                suggesting={suggestingTitles}
                showCharCount
                onSelectTitle={onTitleChange}
                onSuggestTitles={onSuggestTitles}
              />
            </div>
            <Textarea
              aria-label="正文"
              className={cn(
                fieldBase,
                "text-foreground min-h-[200px] flex-1 overflow-y-auto px-4 py-3 text-sm leading-[1.75]"
              )}
              placeholder="正文内容…"
              value={body}
              maxLength={MAX_BODY_CHARS}
              onChange={(e) => onBodyChange(e.target.value)}
            />
          </div>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="border-border min-h-[520px] rounded-lg border bg-card p-4">
            <XhsPhonePreview title={title} body={body} coverUrl={coverUrl} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function useExportMarkdownActions(draft: ContentFactoryDraft) {
  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(buildExportMarkdown(draft))
      toast.success("已复制 Markdown")
    } catch {
      toast.error("复制失败")
    }
  }

  const downloadMd = () => {
    try {
      const md = buildExportMarkdown(draft)
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${draft.project.name}-推荐稿.md`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success("已下载 Markdown")
    } catch {
      toast.error("导出失败")
    }
  }

  return { copyMarkdown, downloadMd }
}
