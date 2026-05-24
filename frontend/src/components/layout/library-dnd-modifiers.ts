import { closestCorners, pointerWithin, type CollisionDetection, type Modifier } from "@dnd-kit/core"
import { getEventCoordinates } from "@dnd-kit/utilities"

import { FOLDER_SORT_PREFIX, NEST_PREFIX, PROJECT_DRAG_PREFIX } from "@/components/layout/library-dnd-ids"

/**
 * 拖拽幽灵（DragOverlay）左上角对齐指针：在默认「保留抓取点偏移」的基础上，
 * 改为 `(指针 x/y) - (初始节点左上)`，使预览条左上角落在光标处。
 */
export const snapOverlayTopLeftToCursor: Modifier = ({ activatorEvent, activeNodeRect, transform }) => {
  if (!activeNodeRect || !activatorEvent) {
    return transform
  }
  const start = getEventCoordinates(activatorEvent)
  if (!start) {
    return transform
  }
  return {
    ...transform,
    x: start.x + transform.x - activeNodeRect.left,
    y: start.y + transform.y - activeNodeRect.top,
  }
}

/** 拖动项目时仅以指针落在投放矩形内为准；拖动文件夹时优先判定 nest-* 投放区，便于归入文件夹 */
export const libraryCollisionDetection: CollisionDetection = (args) => {
  const activeId = String(args.active.id)
  if (activeId.startsWith(PROJECT_DRAG_PREFIX)) {
    return pointerWithin(args)
  }
  if (activeId.startsWith(FOLDER_SORT_PREFIX)) {
    const nestContainers = args.droppableContainers.filter((c) => String(c.id).startsWith(NEST_PREFIX))
    if (nestContainers.length > 0) {
      const nestHits = pointerWithin({ ...args, droppableContainers: nestContainers })
      if (nestHits.length > 0) {
        return nestHits
      }
    }
    return closestCorners(args)
  }
  return closestCorners(args)
}
