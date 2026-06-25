import * as Collapsible from "@radix-ui/react-collapsible"
import { ChevronRight, Folder } from "lucide-react"

import { formatStars } from "@/lib/content-factory-api"
import { countProjectsInSubtree } from "@/lib/library-tree"
import { cn } from "@/lib/utils"
import type { FolderTreeNode, LibraryTreeResponse } from "@/types/library"
import type { Project } from "@/types/project"

const TREE_INDENT_PX = 8
const TREE_ARROW_COL_CLASS = "h-7 w-[14px] shrink-0"

function projectMatchesQuery(project: Project, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) {
    return true
  }
  return (
    project.name.toLowerCase().includes(q) ||
    project.full_name.toLowerCase().includes(q) ||
    (project.description?.toLowerCase().includes(q) ?? false)
  )
}

function filterFolderNode(node: FolderTreeNode, query: string): FolderTreeNode | null {
  const q = query.trim().toLowerCase()
  if (!q) {
    return node
  }

  const matchingProjects = node.projects.filter((p) => projectMatchesQuery(p, query))
  const filteredChildren = node.children
    .map((child) => filterFolderNode(child, query))
    .filter(Boolean) as FolderTreeNode[]
  const folderNameHit = node.name.toLowerCase().includes(q)

  if (folderNameHit) {
    return node
  }
  if (matchingProjects.length > 0 || filteredChildren.length > 0) {
    return { ...node, projects: matchingProjects, children: filteredChildren }
  }
  return null
}

export function filterLibraryTreeForPicker(
  tree: LibraryTreeResponse,
  query: string
): { folders: FolderTreeNode[]; orphans: Project[] } {
  const q = query.trim().toLowerCase()
  if (!q) {
    return { folders: tree.folders, orphans: tree.orphan_projects }
  }
  return {
    folders: tree.folders.map((n) => filterFolderNode(n, query)).filter(Boolean) as FolderTreeNode[],
    orphans: tree.orphan_projects.filter((p) => projectMatchesQuery(p, query)),
  }
}

type ProjectTreePickerListProps = {
  folders: FolderTreeNode[]
  orphans: Project[]
  loading?: boolean
  disabled?: boolean
  onSelect: (projectId: number) => void
}

function ProjectPickerRow({
  project,
  depth,
  disabled,
  onSelect,
}: {
  project: Project
  depth: number
  disabled?: boolean
  onSelect: (projectId: number) => void
}) {
  const pad = depth * TREE_INDENT_PX + 22

  return (
    <button
      type="button"
      disabled={disabled}
      style={{ paddingLeft: pad }}
      className={cn(
        "hover:bg-muted/60 flex w-full flex-col gap-0.5 py-2 pr-3 text-left transition-colors",
        disabled && "pointer-events-none opacity-60"
      )}
      onClick={() => onSelect(project.id)}
    >
      <span className="truncate text-sm font-medium">{project.name}</span>
      <span className="text-muted-foreground truncate text-xs">
        {project.full_name} · {formatStars(project.stars)} stars
      </span>
    </button>
  )
}

function FolderBranch({
  node,
  depth,
  disabled,
  onSelect,
}: {
  node: FolderTreeNode
  depth: number
  disabled?: boolean
  onSelect: (projectId: number) => void
}) {
  const pad = depth * TREE_INDENT_PX
  const hasChildFolders = node.children.length > 0
  const hasProjects = node.projects.length > 0
  const defaultOpen = hasChildFolders || hasProjects

  return (
    <Collapsible.Root defaultOpen={defaultOpen} className="w-full">
      <div style={{ paddingLeft: pad }} className="py-px">
        <div className="flex min-h-[28px] w-full min-w-0 items-center gap-0">
          {hasChildFolders || hasProjects ? (
            <Collapsible.Trigger
              type="button"
              className={cn(
                "text-muted-foreground hover:bg-accent/60 flex shrink-0 items-center justify-center rounded-sm transition-colors",
                TREE_ARROW_COL_CLASS,
                "[&[data-state=open]>svg]:rotate-90"
              )}
              aria-label={`展开或折叠 ${node.name}`}
            >
              <ChevronRight className="size-3 shrink-0 transition-transform duration-200" aria-hidden />
            </Collapsible.Trigger>
          ) : (
            <span className={TREE_ARROW_COL_CLASS} aria-hidden />
          )}
          <div className="text-muted-foreground flex min-h-[28px] min-w-0 flex-1 items-center justify-between gap-1.5 rounded-md px-1.5 text-xs">
            <span className="flex min-w-0 items-center gap-1">
              <Folder className="size-3.5 shrink-0" aria-hidden />
              <span className="text-foreground truncate font-medium">{node.name}</span>
            </span>
            <span className="bg-muted shrink-0 rounded-full px-1 py-px text-[10px] tabular-nums leading-none">
              {countProjectsInSubtree(node)}
            </span>
          </div>
        </div>
      </div>

      {hasChildFolders || hasProjects ? (
        <Collapsible.Content className="border-border/70 border-l pb-px pl-1.5">
          {node.projects.map((project) => (
            <ProjectPickerRow
              key={project.id}
              project={project}
              depth={depth + 1}
              disabled={disabled}
              onSelect={onSelect}
            />
          ))}
          {node.children.map((child) => (
            <FolderBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              disabled={disabled}
              onSelect={onSelect}
            />
          ))}
        </Collapsible.Content>
      ) : null}
    </Collapsible.Root>
  )
}

export function ProjectTreePickerList({
  folders,
  orphans,
  loading = false,
  disabled = false,
  onSelect,
}: ProjectTreePickerListProps) {
  if (loading) {
    return null
  }

  const hasOrphans = orphans.length > 0
  const hasFolders = folders.length > 0
  const isEmpty = !hasOrphans && !hasFolders

  if (isEmpty) {
    return null
  }

  return (
    <div className="py-1">
      {hasOrphans ? (
        <Collapsible.Root defaultOpen className="w-full">
          <div className="py-px">
            <div className="flex min-h-[28px] w-full min-w-0 items-center gap-0 px-2">
              <Collapsible.Trigger
                type="button"
                className={cn(
                  "text-muted-foreground hover:bg-accent/60 flex shrink-0 items-center justify-center rounded-sm transition-colors",
                  TREE_ARROW_COL_CLASS,
                  "[&[data-state=open]>svg]:rotate-90"
                )}
                aria-label="展开或折叠未归类"
              >
                <ChevronRight className="size-3 shrink-0 transition-transform duration-200" aria-hidden />
              </Collapsible.Trigger>
              <div className="text-muted-foreground flex min-h-[28px] min-w-0 flex-1 items-center justify-between gap-1.5 rounded-md px-1.5 text-xs">
                <span className="flex min-w-0 items-center gap-1">
                  <Folder className="size-3.5 shrink-0" aria-hidden />
                  <span className="text-foreground truncate font-medium">未归类（库根层）</span>
                </span>
                <span className="bg-muted shrink-0 rounded-full px-1 py-px text-[10px] tabular-nums leading-none">
                  {orphans.length}
                </span>
              </div>
            </div>
          </div>
          <Collapsible.Content className="border-border/70 border-l pb-px pl-3">
            {orphans.map((project) => (
              <ProjectPickerRow
                key={project.id}
                project={project}
                depth={0}
                disabled={disabled}
                onSelect={onSelect}
              />
            ))}
          </Collapsible.Content>
        </Collapsible.Root>
      ) : null}

      {folders.map((folder) => (
        <FolderBranch
          key={folder.id}
          node={folder}
          depth={0}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
