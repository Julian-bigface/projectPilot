import { Search } from "lucide-react"
import { useMemo } from "react"

import { TagGridRow, type TagActions } from "@/components/library/tag-management-shared"
import {
  TAG_CATEGORY_GRID_SCROLL_CLASS,
  TAG_CATEGORY_PANEL_TITLE_CLASS,
  TAG_CATEGORY_SCROLL_BASE_CLASS,
  TAG_CATEGORY_SEARCH_INPUT_CLASS,
} from "@/components/library/tag-category-styles"
import { useAutoScrollbarVisible } from "@/hooks/use-auto-scrollbar-visible"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { HoverHelp } from "@/components/ui/hover-help"
import { Input } from "@/components/ui/input"
import type { TagCategory, TagWithUsage } from "@/types/tag"
import { cn } from "@/lib/utils"

export type TagCategoryTagGridProps = {
  selectedCategoryId: number | null
  selectedCategory: TagCategory | null
  tags: TagWithUsage[]
  panelTagSearch: string
  onPanelTagSearchChange: (value: string) => void
  selectedTagIds: Set<number>
  onTagSelect: (tagId: number, options: { additive: boolean }) => void
  onSelectAll: (tagIds: number[]) => void
  onClearSelection: () => void
  onBatchMove: (categoryId: number | null) => void
  categories: TagCategory[]
  actions: TagActions
  batchMoving?: boolean
}

export function TagCategoryTagGrid({
  selectedCategoryId,
  selectedCategory,
  tags,
  panelTagSearch,
  onPanelTagSearchChange,
  selectedTagIds,
  onTagSelect,
  onSelectAll,
  onClearSelection,
  onBatchMove,
  categories,
  actions,
  batchMoving = false,
}: TagCategoryTagGridProps) {
  const title = selectedCategoryId === null ? "未分类标签" : selectedCategory?.name ?? "分类标签"
  const searchPlaceholder =
    selectedCategoryId === null ? "搜索未分类标签" : `搜索「${selectedCategory?.name ?? ""}」内标签`

  const filteredTags = useMemo(() => {
    const q = panelTagSearch.trim().toLowerCase()
    if (!q) return tags
    return tags.filter((t) => t.name.toLowerCase().includes(q))
  }, [tags, panelTagSearch])

  const filteredTagIds = useMemo(() => filteredTags.map((t) => t.id), [filteredTags])
  const allFilteredSelected =
    filteredTagIds.length > 0 && filteredTagIds.every((id) => selectedTagIds.has(id))
  const { scrollbarVisible, onScroll } = useAutoScrollbarVisible()

  return (
    <div className="border-border bg-card flex h-full max-h-[min(72vh,760px)] min-h-0 min-w-0 flex-1 flex-col rounded-lg border">
      <div className="space-y-3 border-border border-b p-3">
        <div className="flex min-h-8 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h3 className={TAG_CATEGORY_PANEL_TITLE_CLASS}>{title}</h3>
            <HoverHelp contentClassName="w-64">
              <p>
                将标签拖到左侧分类可快速归类。按住 <kbd className="bg-muted rounded px-1 py-px font-mono text-[10px]">Ctrl</kbd>{" "}
                点击可多选，选中后使用下方批量操作。
              </p>
            </HoverHelp>
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs tabular-nums">
              {filteredTags.length}
            </span>
          </div>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          将标签拖拽到左侧分类；按住 Ctrl 点击可多选标签
        </p>

        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={panelTagSearch}
            onChange={(e) => onPanelTagSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={TAG_CATEGORY_SEARCH_INPUT_CLASS}
            aria-label={searchPlaceholder}
          />
        </div>
      </div>

      <div
        className={cn(
          TAG_CATEGORY_GRID_SCROLL_CLASS,
          TAG_CATEGORY_SCROLL_BASE_CLASS,
          scrollbarVisible && "main-auto-scrollbar--visible"
        )}
        onScroll={onScroll}
        onWheel={(e) => e.stopPropagation()}
      >
        {filteredTags.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {filteredTags.length === 0 && tags.length === 0
              ? "暂无标签，可点击「创建标签」添加。"
              : "无匹配标签。"}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredTags.map((tag) => (
              <TagGridRow
                key={tag.id}
                tag={tag}
                actions={actions}
                selected={selectedTagIds.has(tag.id)}
                onSelect={(options) => onTagSelect(tag.id, options)}
              />
            ))}
          </div>
        )}
      </div>

      {filteredTags.length > 0 && selectedTagIds.size > 0 ? (
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2">
          <span className="text-muted-foreground text-xs tabular-nums">
            已选 {selectedTagIds.size} / {filteredTags.length}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={filteredTagIds.length === 0}
              onClick={() => (allFilteredSelected ? onClearSelection() : onSelectAll(filteredTagIds))}
            >
              {allFilteredSelected ? "取消全选" : "全选"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={selectedTagIds.size === 0}
              onClick={onClearSelection}
            >
              取消选择
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={selectedTagIds.size === 0 || batchMoving}
                >
                  移动到分类…
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {selectedCategoryId !== null ? (
                  <DropdownMenuItem onSelect={() => onBatchMove(null)}>未分类</DropdownMenuItem>
                ) : null}
                {categories
                  .filter((c) => c.id !== selectedCategoryId)
                  .map((c) => (
                    <DropdownMenuItem key={c.id} onSelect={() => onBatchMove(c.id)}>
                      {c.name}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : null}
    </div>
  )
}
