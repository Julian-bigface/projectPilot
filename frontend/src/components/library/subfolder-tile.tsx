import { Folder } from "lucide-react"

import { cn } from "@/lib/utils"

export type SubfolderTileProps = {
  name: string
  projectCount: number
  selected?: boolean
  /** 单击：仅选中 / 待定高亮 */
  onSelect: () => void
  /** 双击：进入该文件夹（可选；不传则无双击行为） */
  onOpen?: () => void
}

/** 资料库子文件夹：Lucide 文件夹图标在上、名称在下（与原先线框风格一致） */
export function SubfolderTile({ name, projectCount, selected, onSelect, onOpen }: SubfolderTileProps) {
  const title =
    onOpen !== undefined ? `${name} · ${projectCount} 项 · 双击进入` : `${name} · ${projectCount} 项`

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={selected}
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.preventDefault()
        onOpen?.()
      }}
      className={cn(
        "hover:bg-muted/50 flex min-w-0 max-w-[6.75rem] flex-col items-center gap-1.5 rounded-lg border border-transparent px-1 py-1.5 text-center transition-colors",
        selected && "ring-ring ring-2 ring-offset-2 ring-offset-background"
      )}
    >
      <Folder
        className="text-muted-foreground size-[4.2rem] shrink-0 stroke-[1.25]"
        aria-hidden
      />
      <span className="text-foreground w-full truncate px-0.5 text-center text-xs font-medium">{name}</span>
    </button>
  )
}
