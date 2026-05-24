import { cn } from "@/lib/utils"

/** Steam 式：激活 Tab 与下方内容区连成一体 */
export const projectDetailTabsBarClass = cn(
  "flex w-full items-end justify-between gap-2 overflow-visible border-b border-border"
)

export const projectDetailTabsListClass = cn(
  "h-auto min-w-0 flex-1 justify-start gap-0 overflow-visible rounded-none border-0",
  "bg-transparent p-0 shadow-none"
)

export const projectDetailTabTriggerClass = cn(
  "relative z-[1] overflow-visible rounded-none rounded-t-md border border-transparent",
  "h-8 bg-transparent px-3 py-1 text-sm font-normal leading-none shadow-none",
  "text-muted-foreground/50 transition-colors",
  "hover:text-muted-foreground",
  "data-[state=active]:z-[2] data-[state=active]:-mb-0.5",
  "data-[state=active]:border-border data-[state=active]:border-b-transparent",
  "data-[state=active]:border-t-2 data-[state=active]:border-t-sky-500",
  "data-[state=active]:border-l-sky-500/70 data-[state=active]:border-r-sky-500/70",
  "data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground",
  "data-[state=active]:after:pointer-events-none data-[state=active]:after:absolute",
  "data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:z-[5]",
  "data-[state=active]:after:h-1 data-[state=active]:after:bg-background data-[state=active]:after:content-['']",
  "data-[state=active]:shadow-[0_2px_0_0_hsl(var(--background))]",
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
)

export const projectDetailTabContentClass = cn(
  "mt-0 min-h-[320px] pt-4 focus-visible:outline-none focus-visible:ring-0"
)
