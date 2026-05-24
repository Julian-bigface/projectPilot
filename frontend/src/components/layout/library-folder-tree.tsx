import * as Collapsible from "@radix-ui/react-collapsible"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronRight, Folder } from "lucide-react"
import { useCallback, type ReactNode } from "react"
import { useLocation, useNavigate } from "react-router"

import {
  folderSortId,
  LIBRARY_NEST_ROOT_ID,
  nestDropId,
} from "@/components/layout/library-dnd-ids"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useLibraryProjectPreview } from "@/context/library-project-preview"
import { useLibrarySelection } from "@/context/library-selection"
import { countProjectsInSubtree } from "@/lib/library-tree"
import type { FolderTreeNode as FolderNodeModel } from "@/types/library"
import { cn } from "@/lib/utils"

/** 重新导出，供 `FolderNestDropBar` 与侧栏等使用 */
export { LIBRARY_NEST_ROOT_ID } from "@/components/layout/library-dnd-ids"

/** 每层横向错位仅由此一处决定（避免再给 Collapsible 加按深度的 margin 以免深层加倍） */
const TREE_INDENT_PX = 8
/** 展开箭头列固定宽度，与占位一致以保证对齐 */
const TREE_ARROW_COL_CLASS = "h-7 w-[14px] shrink-0"

type SortableFolderBranchProps = {
  node: FolderNodeModel
  depth: number
  roots: FolderNodeModel[]
  onOpenNewSubfolder: (parentId: number) => void
  onOpenAddGithubProject: (folderId: number) => void
  onOpenRename: (folderId: number, currentName: string) => void
  onOpenDelete: (folderId: number, name: string) => void
}

function SortableFolderBranch({
  node,
  depth,
  roots,
  onOpenNewSubfolder,
  onOpenAddGithubProject,
  onOpenRename,
  onOpenDelete,
}: SortableFolderBranchProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { libraryScope, setLibraryScope } = useLibrarySelection()
  const { setPreviewProject } = useLibraryProjectPreview()

  const pad = depth * TREE_INDENT_PX
  /** 仅子文件夹参与展开；归入本文件夹的项目不在侧栏树中展示 */
  const hasChildFolders = node.children.length > 0

  const entered = libraryScope.kind === "folder" && libraryScope.folderId === node.id

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folderSortId(node.id),
  })
  const { setNodeRef: setNestRef, isOver: isNestDropTarget } = useDroppable({
    id: nestDropId(node.id),
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const mergeNestRef = useCallback(
    (el: HTMLDivElement | null) => {
      setNestRef(el)
    },
    [setNestRef]
  )

  const handleFolderNameClick = () => {
    setPreviewProject(null)
    setLibraryScope({ kind: "folder", folderId: node.id })
    if (location.pathname !== "/library") {
      navigate("/library")
    }
  }

  return (
    <Collapsible.Root defaultOpen={hasChildFolders} className="w-full">
      <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-50")}>
        <div style={{ paddingLeft: pad }} className="py-px">
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div
                ref={mergeNestRef}
                {...listeners}
                {...attributes}
                className={cn(
                  "relative flex w-full min-h-[28px] min-w-0 cursor-grab touch-none items-center gap-0 rounded-md outline-none transition-colors duration-150 active:cursor-grabbing"
                )}
              >
                {hasChildFolders ? (
                  <Collapsible.Trigger
                    type="button"
                    className={cn(
                      "text-muted-foreground hover:bg-accent/60 flex shrink-0 items-center justify-center rounded-sm transition-colors",
                      TREE_ARROW_COL_CLASS,
                      "[&[data-state=open]>svg]:rotate-90"
                    )}
                    aria-label="展开或折叠子文件夹"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <ChevronRight className="size-3 shrink-0 transition-transform duration-200" aria-hidden />
                  </Collapsible.Trigger>
                ) : (
                  <span className={TREE_ARROW_COL_CLASS} aria-hidden />
                )}

                <button
                  type="button"
                  onClick={handleFolderNameClick}
                  className={cn(
                    "flex min-h-[28px] w-full min-w-0 flex-1 items-center justify-between gap-1.5 rounded-md px-1.5 py-0 text-left text-xs transition-colors leading-snug",
                    entered
                      ? "bg-accent text-accent-foreground font-medium"
                      : "hover:bg-accent/80"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1">
                    <Folder className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{node.name}</span>
                  </span>
                  <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-1 py-px text-[10px] tabular-nums leading-none">
                    {countProjectsInSubtree(node)}
                  </span>
                </button>
                {isNestDropTarget ? (
                  <div
                    className="bg-primary/18 pointer-events-none absolute inset-0 z-[5] rounded-md"
                    aria-hidden
                  />
                ) : null}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48">
              <ContextMenuItem onSelect={() => onOpenAddGithubProject(node.id)}>添加 GitHub 项目</ContextMenuItem>
              <ContextMenuItem onSelect={() => onOpenNewSubfolder(node.id)}>新建子文件夹</ContextMenuItem>
              <ContextMenuItem onSelect={() => onOpenRename(node.id, node.name)}>重命名</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onOpenDelete(node.id, node.name)}
              >
                删除
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      </div>

      {hasChildFolders ? (
        <Collapsible.Content className="border-border/70 pb-px border-l pl-1.5">
          <SortableContext
            items={node.children.map((c) => folderSortId(c.id))}
            strategy={verticalListSortingStrategy}
          >
            {node.children.map((c) => (
              <SortableFolderBranch
                key={c.id}
                node={c}
                depth={depth + 1}
                roots={roots}
                onOpenNewSubfolder={onOpenNewSubfolder}
                onOpenAddGithubProject={onOpenAddGithubProject}
                onOpenRename={onOpenRename}
                onOpenDelete={onOpenDelete}
              />
            ))}
          </SortableContext>
        </Collapsible.Content>
      ) : null}
    </Collapsible.Root>
  )
}

type LibraryFolderTreeProps = {
  roots: FolderNodeModel[]
  onOpenNewSubfolder: (parentId: number) => void
  onOpenAddGithubProject: (folderId: number) => void
  onOpenRename: (folderId: number, currentName: string) => void
  onOpenDelete: (folderId: number, name: string) => void
  /** 须包含在 Dnd 内：侧栏「文件夹」行等，其内应使用 `FolderNestDropBar` 作为 `NEST_ROOT` 投放区 */
  folderNestSlot?: ReactNode
  className?: string
}

/** 包裹「文件夹」标题行；拖入项目则取消归类，拖入子文件夹则移至顶层 */
export function FolderNestDropBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id: LIBRARY_NEST_ROOT_ID })
  return (
    <div ref={setNodeRef} className={cn("relative", className)}>
      {children}
      {isOver ? (
        <div className="bg-primary/15 pointer-events-none absolute inset-0 z-[5]" aria-hidden />
      ) : null}
    </div>
  )
}

export function LibraryFolderTree({
  roots,
  onOpenNewSubfolder,
  onOpenAddGithubProject,
  onOpenRename,
  onOpenDelete,
  folderNestSlot,
  className,
}: LibraryFolderTreeProps) {
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      {folderNestSlot ? <div className="shrink-0">{folderNestSlot}</div> : null}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label="资料库文件夹树">
        <LibraryFolderTreeInner
          roots={roots}
          onOpenNewSubfolder={onOpenNewSubfolder}
          onOpenAddGithubProject={onOpenAddGithubProject}
          onOpenRename={onOpenRename}
          onOpenDelete={onOpenDelete}
        />
      </nav>
    </div>
  )
}

type LibraryFolderTreeInnerProps = {
  roots: FolderNodeModel[]
  onOpenNewSubfolder: (parentId: number) => void
  onOpenAddGithubProject: (folderId: number) => void
  onOpenRename: (folderId: number, currentName: string) => void
  onOpenDelete: (folderId: number, name: string) => void
}

function LibraryFolderTreeInner({
  roots,
  onOpenNewSubfolder,
  onOpenAddGithubProject,
  onOpenRename,
  onOpenDelete,
}: LibraryFolderTreeInnerProps) {
  const rootIds = roots.map((r) => folderSortId(r.id))

  return (
    <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
      {roots.map((n) => (
        <SortableFolderBranch
          key={n.id}
          node={n}
          depth={0}
          roots={roots}
          onOpenNewSubfolder={onOpenNewSubfolder}
          onOpenAddGithubProject={onOpenAddGithubProject}
          onOpenRename={onOpenRename}
          onOpenDelete={onOpenDelete}
        />
      ))}
    </SortableContext>
  )
}
