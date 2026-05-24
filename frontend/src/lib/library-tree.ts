import type { FolderTreeNode } from "@/types/library"
import type { Project } from "@/types/project"

function collectProjectsDfs(node: FolderTreeNode, out: Project[]) {
  out.push(...node.projects)
  for (const ch of node.children) {
    collectProjectsDfs(ch, out)
  }
}

/** 全部视图：未归类项目 + 树内各文件夹下的项目（树按深度优先顺序拼接） */
export function flattenAllProjects(roots: FolderTreeNode[], orphans: Project[]): Project[] {
  const fromTree: Project[] = []
  for (const r of roots) {
    collectProjectsDfs(r, fromTree)
  }
  return [...orphans, ...fromTree]
}

/** 当前文件夹节点及其所有后代文件夹内的项目（深度优先顺序） */
export function projectsInFolderSubtree(node: FolderTreeNode): Project[] {
  const out: Project[] = []
  collectProjectsDfs(node, out)
  return out
}

/** 仅树内各文件夹下的项目（不含未归类 orphan） */
export function projectsInFolderTreeOnly(roots: FolderTreeNode[]): Project[] {
  const out: Project[] = []
  for (const r of roots) {
    collectProjectsDfs(r, out)
  }
  return out
}

/** 仅顶层文件夹节点直接挂载的项目（不含更深子文件夹内；与「文件夹总览」下取消勾选「含子文件夹」一致） */
export function projectsDirectInRootFoldersOnly(roots: FolderTreeNode[]): Project[] {
  const out: Project[] = []
  for (const r of roots) {
    out.push(...r.projects)
  }
  return out
}

/** 在树中按 id 查找文件夹节点 */
export function findFolderNode(roots: FolderTreeNode[], id: number): FolderTreeNode | null {
  for (const n of roots) {
    if (n.id === id) {
      return n
    }
    const c = findFolderNode(n.children, id)
    if (c) {
      return c
    }
  }
  return null
}

/** 子树内「项目」总数（本文件夹直接项目 + 所有后代文件夹内项目；侧栏 / 主区文件夹徽标用） */
export function countProjectsInSubtree(node: FolderTreeNode): number {
  let total = node.projects.length
  for (const ch of node.children) {
    total += countProjectsInSubtree(ch)
  }
  return total
}

/** 库内项目总数：未归类条数 + 各根文件夹子树内项目（不重复） */
export function totalProjectsInLibraryTree(roots: FolderTreeNode[], orphanCount: number): number {
  let n = orphanCount
  for (const r of roots) {
    n += countProjectsInSubtree(r)
  }
  return n
}

/** 按文件夹名称过滤树（不区分大小写）；不匹配则剪枝 */
export function filterFolderTreeByName(roots: FolderTreeNode[], query: string): FolderTreeNode[] {
  const q = query.trim().toLowerCase()
  if (!q) {
    return roots
  }

  function filterNode(n: FolderTreeNode): FolderTreeNode | null {
    const nameHit = n.name.toLowerCase().includes(q)
    const filteredChildren = n.children.map(filterNode).filter(Boolean) as FolderTreeNode[]
    if (nameHit) {
      return { ...n, children: n.children, projects: n.projects }
    }
    if (filteredChildren.length > 0) {
      return { ...n, children: filteredChildren, projects: [] }
    }
    return null
  }

  return roots.map(filterNode).filter(Boolean) as FolderTreeNode[]
}

export type FolderFilterEntry = {
  id: number
  name: string
  depth: number
}

function walkFolderEntries(nodes: FolderTreeNode[], depth: number, out: FolderFilterEntry[]) {
  for (const n of nodes) {
    out.push({ id: n.id, name: n.name, depth })
    walkFolderEntries(n.children, depth + 1, out)
  }
}

/** 扁平文件夹列表（含缩进深度），供主区「文件夹」筛选 */
export function collectFolderFilterEntries(roots: FolderTreeNode[]): FolderFilterEntry[] {
  const out: FolderFilterEntry[] = []
  walkFolderEntries(roots, 0, out)
  return out
}

/** 仅下一级子文件夹（不含当前节点与更深层级） */
export function collectDirectChildFolderEntries(node: FolderTreeNode): FolderFilterEntry[] {
  return node.children.map((ch) => ({ id: ch.id, name: ch.name, depth: 0 }))
}
