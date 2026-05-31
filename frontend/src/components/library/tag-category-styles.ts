/** 标签分类双栏滚动区：与资料库侧栏文件夹树 nav 一致 */
export const TAG_CATEGORY_NAV_CLASS = "min-h-0 flex-1 overflow-y-auto px-2 py-2"

/** 默认隐藏拇指，滚动时由 JS 加上 `main-auto-scrollbar--visible` */
export const TAG_CATEGORY_SCROLL_BASE_CLASS = "main-auto-scrollbar overscroll-contain"

/** 标签分类面板内搜索框样式 */
export const TAG_CATEGORY_SEARCH_INPUT_CLASS =
  "bg-muted/40 h-8 border-0 pl-8 text-xs shadow-none"

/** 标签分类面板标题 */
export const TAG_CATEGORY_PANEL_TITLE_CLASS = "text-foreground text-sm font-semibold"

/** 与 [`library-folder-tree.tsx`](../layout/library-folder-tree.tsx) 文件夹行一致 */
export const TAG_CATEGORY_NAV_ITEM_BASE =
  "flex min-h-[28px] min-w-0 flex-1 items-center justify-between gap-1.5 rounded-md px-1.5 py-1 text-left text-xs leading-snug transition-colors"

export function tagCategoryNavItemClass(selected: boolean): string {
  return selected
    ? "bg-accent text-accent-foreground font-medium"
    : "text-muted-foreground hover:bg-accent/80 hover:text-foreground"
}

export const TAG_CATEGORY_NAV_COUNT_CLASS =
  "bg-muted text-muted-foreground shrink-0 rounded-full px-1 py-px text-[10px] tabular-nums leading-none"

/** 右侧标签网格滚动区 */
export const TAG_CATEGORY_GRID_SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto p-3"

/** 与「所有标签」Tab 中 TagChip 一致 */
export const TAG_CHIP_SURFACE_CLASS =
  "bg-background text-foreground border-border inline-flex min-w-[68px] max-w-[min(100%,10.8rem)] items-stretch overflow-hidden rounded-md border text-sm shadow-sm"

/** 分类网格内选中标签：与侧栏 [`tagCategoryNavItemClass`](./tag-category-styles.ts) 未选中行的 muted 灰度一致 */
export const TAG_CHIP_SELECTED_CLASS =
  "bg-muted/80 border-muted-foreground/25 text-muted-foreground shadow-none"
