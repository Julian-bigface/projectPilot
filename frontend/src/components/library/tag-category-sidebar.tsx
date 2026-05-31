import { useDroppable } from "@dnd-kit/core"
import { Folder, MoreHorizontal, Plus, Search, Tags } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { UNCATEGORIZED_DROP_ID } from "@/components/library/tag-management-shared"
import {
  TAG_CATEGORY_NAV_CLASS,
  TAG_CATEGORY_NAV_COUNT_CLASS,
  TAG_CATEGORY_NAV_ITEM_BASE,
  TAG_CATEGORY_PANEL_TITLE_CLASS,
  TAG_CATEGORY_SCROLL_BASE_CLASS,
  TAG_CATEGORY_SEARCH_INPUT_CLASS,
  tagCategoryNavItemClass,
} from "@/components/library/tag-category-styles"
import { useAutoScrollbarVisible } from "@/hooks/use-auto-scrollbar-visible"
import type { TagCategory } from "@/types/tag"
import { cn } from "@/lib/utils"

type CategoryRowProps = {
  dropId: string
  icon: React.ReactNode
  name: string
  count: number
  selected: boolean
  onSelect: () => void
  menu?: ReactNode
}

function CategoryRow({ dropId, icon, name, count, selected, onSelect, menu }: CategoryRowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId })

  return (
    <div ref={setNodeRef} className="group relative py-px">
      <div className="relative flex min-w-0 items-center gap-0.5">
        <button
          type="button"
          className={cn(TAG_CATEGORY_NAV_ITEM_BASE, tagCategoryNavItemClass(selected))}
          onClick={onSelect}
        >
          <span className="flex min-w-0 items-center gap-1">
            <span className="text-muted-foreground shrink-0 [&_svg]:size-3.5">{icon}</span>
            <span className="truncate">{name}</span>
          </span>
          <span className={TAG_CATEGORY_NAV_COUNT_CLASS}>{count}</span>
        </button>
        {menu ? (
          <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {menu}
          </div>
        ) : null}
      </div>
      {isOver ? (
        <div
          className="bg-primary/18 pointer-events-none absolute inset-0 z-[5] rounded-md"
          aria-hidden
        />
      ) : null}
    </div>
  )
}

export type TagCategorySidebarProps = {
  categories: TagCategory[]
  categoryCounts: Map<number | null, number>
  categorySearch: string
  onCategorySearchChange: (value: string) => void
  selectedCategoryId: number | null
  onSelectCategory: (categoryId: number | null) => void
  onCreateCategory: () => void
  onRenameCategory: (category: TagCategory) => void
  onDeleteCategory: (category: TagCategory) => void
}

export function TagCategorySidebar({
  categories,
  categoryCounts,
  categorySearch,
  onCategorySearchChange,
  selectedCategoryId,
  onSelectCategory,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
}: TagCategorySidebarProps) {
  const q = categorySearch.trim().toLowerCase()
  const filteredCategories = q
    ? categories.filter((c) => c.name.toLowerCase().includes(q))
    : categories
  const showUncategorized = !q || "未分类".includes(q)

  const uncategorizedCount = categoryCounts.get(null) ?? 0
  const { scrollbarVisible, onScroll } = useAutoScrollbarVisible()

  return (
    <aside className="border-border bg-card flex h-full max-h-[min(72vh,760px)] min-h-0 w-[240px] shrink-0 flex-col rounded-lg border">
      <div className="space-y-3 p-3">
        <h3 className={TAG_CATEGORY_PANEL_TITLE_CLASS}>分类列表</h3>
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={categorySearch}
            onChange={(e) => onCategorySearchChange(e.target.value)}
            placeholder="搜索分类"
            className={TAG_CATEGORY_SEARCH_INPUT_CLASS}
            aria-label="搜索分类"
          />
        </div>
      </div>

      <nav
        className={cn(
          TAG_CATEGORY_NAV_CLASS,
          TAG_CATEGORY_SCROLL_BASE_CLASS,
          scrollbarVisible && "main-auto-scrollbar--visible"
        )}
        aria-label="标签分类列表"
        onScroll={onScroll}
        onWheel={(e) => e.stopPropagation()}
      >
        {showUncategorized ? (
          <CategoryRow
            dropId={UNCATEGORIZED_DROP_ID}
            icon={<Tags className="size-3.5" aria-hidden />}
            name="未分类"
            count={uncategorizedCount}
            selected={selectedCategoryId === null}
            onSelect={() => onSelectCategory(null)}
          />
        ) : null}
        {filteredCategories.map((c) => (
          <CategoryRow
            key={c.id}
            dropId={`tm-drop-${c.id}`}
            icon={<Folder className="size-3.5" aria-hidden />}
            name={c.name}
            count={categoryCounts.get(c.id) ?? 0}
            selected={selectedCategoryId === c.id}
            onSelect={() => onSelectCategory(c.id)}
            menu={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`分类 ${c.name} 操作`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onRenameCategory(c)}>重命名</DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => onDeleteCategory(c)}
                  >
                    删除分类
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
        ))}
        {filteredCategories.length === 0 && !showUncategorized ? (
          <p className="text-muted-foreground px-2 py-4 text-center text-xs">无匹配分类</p>
        ) : null}
      </nav>

      <div className="border-border border-t p-3">
        <Button
          type="button"
          variant="outline"
          className="border-dashed h-8 w-full gap-1.5 text-xs"
          onClick={onCreateCategory}
        >
          <Plus className="size-3.5" aria-hidden />
          新建分类
        </Button>
      </div>
    </aside>
  )
}
