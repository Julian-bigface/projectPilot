import { Copy, Download } from "lucide-react"

import { useExportMarkdownActions } from "@/components/content-factory/promotion-export-panel"
import { Button } from "@/components/ui/button"
import { platformLabel } from "@/lib/content-factory-views"
import type { ContentFactoryDraft, RecommendPlatform } from "@/types/content-factory"

type PromotionExportFallbackProps = {
  draft: ContentFactoryDraft
  coverUrl: string | null
  onDownloadCover: () => void
  onSwitchToXiaohongshu: () => void
}

export function PromotionExportFallback({
  draft,
  coverUrl,
  onDownloadCover,
  onSwitchToXiaohongshu,
}: PromotionExportFallbackProps) {
  const exportDraft: ContentFactoryDraft = { ...draft }
  const { copyMarkdown, downloadMd } = useExportMarkdownActions(exportDraft)
  const label = platformLabel(draft.platform as RecommendPlatform)

  return (
    <div className="border-border flex min-h-[400px] flex-col items-center justify-center gap-6 rounded-lg border bg-card p-8 text-center">
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold">导出发布</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          当前平台为 <strong>{label}</strong>，手机预览仅支持小红书。你可以复制或下载 Markdown
          文稿，或切换到小红书后继续预览发布效果。
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void copyMarkdown()}>
          <Copy className="mr-1.5 size-3.5" aria-hidden />
          复制 Markdown
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={downloadMd}>
          <Download className="mr-1.5 size-3.5" aria-hidden />
          下载 .md
        </Button>
        {coverUrl ? (
          <Button type="button" variant="outline" size="sm" onClick={onDownloadCover}>
            <Download className="mr-1.5 size-3.5" aria-hidden />
            下载封面
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="secondary" onClick={onSwitchToXiaohongshu}>
          切换到小红书
        </Button>
      </div>
    </div>
  )
}
