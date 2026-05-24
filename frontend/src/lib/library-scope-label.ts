import { findFolderNode } from "@/lib/library-tree"
import type { FolderTreeNode } from "@/types/library"
import type { LibraryScope } from "@/types/library-scope"

export function scopesEqual(a: LibraryScope, b: LibraryScope): boolean {
  if (a.kind !== b.kind) {
    return false
  }
  if (a.kind === "folder" && b.kind === "folder") {
    return a.folderId === b.folderId
  }
  return true
}

/** 与侧栏「当前：」一致；`folders` 未加载时对非 folder  scope 返回「…」 */
export function getLibraryScopeDisplayLabel(
  scope: LibraryScope,
  folders: FolderTreeNode[] | undefined
): string {
  if (!folders) {
    if (scope.kind === "folder") {
      return `文件夹 #${scope.folderId}`
    }
    return "…"
  }
  switch (scope.kind) {
    case "all":
      return "全部"
    case "folders_all":
      return "文件夹"
    case "uncategorized":
      return "未分类"
    case "no_tags":
      return "无标签"
    case "tag_manage":
      return "标签管理"
    case "trash":
      return "回收站"
    case "folder":
      return findFolderNode(folders, scope.folderId)?.name ?? `文件夹 #${scope.folderId}`
    default:
      return "资料库"
  }
}
