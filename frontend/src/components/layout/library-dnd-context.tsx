/**
 * 资料库全局 DndContext：包裹侧栏文件夹树与主区 Outlet，使主区项目卡片可拖入侧栏文件夹。
 */

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  libraryCollisionDetection,
  snapOverlayTopLeftToCursor,
} from "@/components/layout/library-dnd-modifiers"
import {
  FOLDER_SORT_PREFIX,
  LIBRARY_NEST_ROOT_ID,
  NEST_PREFIX,
  parseFolderSortId,
  parseProjectDragId,
} from "@/components/layout/library-dnd-ids"
import { findFolderNode } from "@/lib/library-tree"
import type { FolderTreeNode as FolderNodeModel } from "@/types/library"
import type { LibraryTreeResponse } from "@/types/library"
import type { Project } from "@/types/project"

const NEST_ROOT_ID = LIBRARY_NEST_ROOT_ID

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json()
    if (data && typeof data === "object" && "detail" in data) {
      const d = (data as { detail: unknown }).detail
      if (typeof d === "string") {
        return d
      }
      return JSON.stringify(d)
    }
  } catch {
    // ignore
  }
  return res.statusText || `HTTP ${res.status}`
}

async function invalidateLibrary(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: ["library", "tree"] })
  await queryClient.invalidateQueries({ queryKey: ["folders", "flat"] })
  await queryClient.invalidateQueries()
}

function findFolderName(roots: FolderNodeModel[], id: number): string {
  return findFolderNode(roots, id)?.name ?? ""
}

/** 拖拽归类成功提示：目标文件夹显示名；根「取消归类」为未归类 */
function projectDropTargetLabel(targetFolderId: number | null, roots: FolderNodeModel[]): string {
  if (targetFolderId === null) {
    return "未归类"
  }
  const name = findFolderName(roots, targetFolderId).trim()
  return name !== "" ? name : `文件夹 #${targetFolderId}`
}

function findProjectNameInTree(roots: FolderNodeModel[], projectId: number): string | undefined {
  for (const n of roots) {
    const hit = n.projects.find((p) => p.id === projectId)
    if (hit) {
      return hit.name
    }
    const inner = findProjectNameInTree(n.children, projectId)
    if (inner !== undefined) {
      return inner
    }
  }
  return undefined
}

function findParentId(
  roots: FolderNodeModel[],
  targetId: number,
  parent: number | null = null
): number | null | undefined {
  for (const n of roots) {
    if (n.id === targetId) {
      return parent
    }
    const inner = findParentId(n.children, targetId, n.id)
    if (inner !== undefined) {
      return inner
    }
  }
  return undefined
}

function siblingFolderIds(roots: FolderNodeModel[], parentId: number | null): number[] {
  if (parentId === null) {
    return roots.map((r) => r.id)
  }
  const pNode = findFolderNode(roots, parentId)
  return pNode ? pNode.children.map((c) => c.id) : []
}

function findProjectFolderId(roots: FolderNodeModel[], projectId: number): number | null | undefined {
  for (const n of roots) {
    if (n.projects.some((p) => p.id === projectId)) {
      return n.id
    }
    const inner = findProjectFolderId(n.children, projectId)
    if (inner !== undefined) {
      return inner
    }
  }
  return undefined
}

function projectCurrentFolderId(
  roots: FolderNodeModel[],
  orphans: Project[],
  projectId: number
): number | null | undefined {
  if (orphans.some((p) => p.id === projectId)) {
    return null
  }
  return findProjectFolderId(roots, projectId)
}

function subtreeContainsFolder(
  roots: FolderNodeModel[],
  ancestorFolderId: number,
  candidateId: number
): boolean {
  const anc = findFolderNode(roots, ancestorFolderId)
  if (!anc) {
    return false
  }
  function dfs(n: FolderNodeModel): boolean {
    if (n.id === candidateId) {
      return true
    }
    return n.children.some(dfs)
  }
  return anc.children.some(dfs)
}

type LibraryDndProviderProps = {
  children: ReactNode
}

export function LibraryDndProvider({ children }: LibraryDndProviderProps) {
  const queryClient = useQueryClient()
  const [overlayLabel, setOverlayLabel] = useState<string | null>(null)
  /** 按住 Alt 松开时：同级文件夹拖向另一行视为「归入」而非排序 */
  const folderNestAltRef = useRef(false)

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Alt") {
        folderNestAltRef.current = true
      }
    }
    const onKeyUp = (ev: KeyboardEvent) => {
      if (ev.key === "Alt") {
        folderNestAltRef.current = false
      }
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [])

  const treeQuery = useQuery({
    queryKey: ["library", "tree"],
    queryFn: async (): Promise<LibraryTreeResponse> => {
      const res = await fetch("/api/library/tree")
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<LibraryTreeResponse>
    },
  })

  const roots = treeQuery.data?.folders ?? []
  const orphanProjects = treeQuery.data?.orphan_projects ?? []

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  const reorderMutation = useMutation({
    mutationFn: async (body: { parent_id: number | null; ordered_ids: number[] }) => {
      const res = await fetch("/api/folders/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json()
    },
    onSuccess: async () => {
      await invalidateLibrary(queryClient)
    },
  })

  const patchFolderMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/folders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json()
    },
    onSuccess: async () => {
      await invalidateLibrary(queryClient)
    },
  })

  const patchProjectMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json()
    },
    onSuccess: async () => {
      await invalidateLibrary(queryClient)
    },
  })

  const onDragStart = (e: DragStartEvent) => {
    const projId = parseProjectDragId(String(e.active.id))
    if (projId !== null) {
      const label =
        orphanProjects.find((p) => p.id === projId)?.name ??
        findProjectNameInTree(roots, projId) ??
        `项目 #${projId}`
      setOverlayLabel(label)
      return
    }
    const fid = parseFolderSortId(String(e.active.id))
    if (fid !== null) {
      setOverlayLabel(findFolderName(roots, fid))
    }
  }

  const onDragEnd = (e: DragEndEvent) => {
    setOverlayLabel(null)
    const { active, over } = e
    if (!over) {
      return
    }
    const overId = String(over.id)

    const projectId = parseProjectDragId(String(active.id))
    if (projectId !== null) {
      let targetFolderId: number | null | undefined
      if (overId === NEST_ROOT_ID) {
        targetFolderId = null
      } else if (overId.startsWith(NEST_PREFIX)) {
        const raw = overId.slice(NEST_PREFIX.length)
        const n = Number.parseInt(raw, 10)
        targetFolderId = Number.isFinite(n) ? n : undefined
      } else if (overId.startsWith(FOLDER_SORT_PREFIX)) {
        const fid = parseFolderSortId(overId)
        if (fid === null) {
          return
        }
        targetFolderId = fid
      } else {
        return
      }

      if (targetFolderId === undefined) {
        return
      }

      const current = projectCurrentFolderId(roots, orphanProjects, projectId)
      if (current === undefined) {
        return
      }
      if (targetFolderId === current) {
        return
      }

      patchProjectMutation.mutate(
        { id: projectId, body: { folder_id: targetFolderId } },
        {
          onSuccess: () => {
            toast.success(`已归入「${projectDropTargetLabel(targetFolderId, roots)}」`)
          },
        }
      )
      return
    }

    const dragId = parseFolderSortId(String(active.id))
    if (dragId === null) {
      return
    }

    if (overId === NEST_ROOT_ID) {
      const parent = findParentId(roots, dragId)
      if (parent !== undefined && parent !== null) {
        patchFolderMutation.mutate({ id: dragId, body: { parent_id: null } })
      }
      return
    }

    if (overId.startsWith(NEST_PREFIX)) {
      const raw = overId.slice(NEST_PREFIX.length)
      const targetId = Number.parseInt(raw, 10)
      if (!Number.isFinite(targetId) || targetId === dragId) {
        return
      }
      if (subtreeContainsFolder(roots, dragId, targetId)) {
        return
      }
      const parent = findParentId(roots, dragId)
      if (parent === undefined) {
        return
      }
      if (parent === targetId) {
        return
      }
      patchFolderMutation.mutate({ id: dragId, body: { parent_id: targetId } })
      return
    }

    if (overId.startsWith(FOLDER_SORT_PREFIX)) {
      const overFolderId = parseFolderSortId(overId)
      if (overFolderId === null || overFolderId === dragId) {
        return
      }
      const pDrag = findParentId(roots, dragId)
      const pOver = findParentId(roots, overFolderId)
      if (pDrag === undefined || pOver === undefined) {
        return
      }

      // 同一父级：默认同级排序；按住 Alt 则归入目标文件夹（成为其子文件夹）
      if (pDrag === pOver) {
        if (folderNestAltRef.current) {
          if (subtreeContainsFolder(roots, dragId, overFolderId)) {
            toast.error("不能将文件夹移动到其子文件夹下")
            return
          }
          const parentOfDrag = findParentId(roots, dragId)
          if (parentOfDrag !== undefined && parentOfDrag === overFolderId) {
            return
          }
          patchFolderMutation.mutate(
            { id: dragId, body: { parent_id: overFolderId } },
            {
              onSuccess: () => {
                toast.success(`已移入「${findFolderName(roots, overFolderId) || `文件夹 #${overFolderId}`}」`)
              },
              onError: (err) => {
                toast.error(err instanceof Error ? err.message : "移动失败")
              },
            }
          )
          return
        }
        const siblings = siblingFolderIds(roots, pDrag)
        const oldIndex = siblings.indexOf(dragId)
        const newIndex = siblings.indexOf(overFolderId)
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
          return
        }
        reorderMutation.mutate({
          parent_id: pDrag,
          ordered_ids: arrayMove(siblings, oldIndex, newIndex),
        })
        return
      }

      // 碰撞检测常命中 sortable 的 folder-* 而非 nest-*：非同父级时改为归入目标文件夹（嵌套）
      if (subtreeContainsFolder(roots, dragId, overFolderId)) {
        toast.error("不能将文件夹移动到其子文件夹下")
        return
      }
      const parentOfDrag = findParentId(roots, dragId)
      if (parentOfDrag !== undefined && parentOfDrag === overFolderId) {
        return
      }
      patchFolderMutation.mutate(
        { id: dragId, body: { parent_id: overFolderId } },
        {
          onSuccess: () => {
            toast.success(`已移入「${findFolderName(roots, overFolderId) || `文件夹 #${overFolderId}`}」`)
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : "移动失败")
          },
        }
      )
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={libraryCollisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {children}
      <DragOverlay dropAnimation={null} modifiers={[snapOverlayTopLeftToCursor]}>
        {overlayLabel ? (
          <div className="bg-accent text-accent-foreground border-border max-w-[240px] truncate rounded-md border px-2 py-1.5 text-sm shadow-md">
            {overlayLabel}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
