/** 与资料库 @dnd-kit 拖拽 id 约定一致，供侧栏树与主区项目卡片共用 */

export const FOLDER_SORT_PREFIX = "folder-"
export const PROJECT_DRAG_PREFIX = "project-"
export const NEST_PREFIX = "nest-"

/** 拖入项目则取消文件夹归类（folder_id: null）；拖入文件夹则移至顶层（parent_id: null） */
export const LIBRARY_NEST_ROOT_ID = "nest-root"

export function folderSortId(id: number): string {
  return `${FOLDER_SORT_PREFIX}${id}`
}

export function nestDropId(folderId: number): string {
  return `${NEST_PREFIX}${folderId}`
}

export function projectDragId(projectId: number): string {
  return `${PROJECT_DRAG_PREFIX}${projectId}`
}

export function parseProjectDragId(s: string): number | null {
  if (!s.startsWith(PROJECT_DRAG_PREFIX)) {
    return null
  }
  const n = Number.parseInt(s.slice(PROJECT_DRAG_PREFIX.length), 10)
  return Number.isFinite(n) ? n : null
}

export function parseFolderSortId(s: string): number | null {
  if (!s.startsWith(FOLDER_SORT_PREFIX)) {
    return null
  }
  const n = Number.parseInt(s.slice(FOLDER_SORT_PREFIX.length), 10)
  return Number.isFinite(n) ? n : null
}
