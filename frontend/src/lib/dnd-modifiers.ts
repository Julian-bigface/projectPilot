import type { Modifier } from "@dnd-kit/core"

/** DragOverlay 左上角对齐指针（而非保持按下点偏移） */
export const snapOverlayTopLeftToPointer: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  transform,
}) => {
  if (!draggingNodeRect || !activatorEvent || !("clientX" in activatorEvent)) {
    return transform
  }
  const event = activatorEvent as PointerEvent
  const offsetX = event.clientX - draggingNodeRect.left
  const offsetY = event.clientY - draggingNodeRect.top
  return {
    ...transform,
    x: transform.x + offsetX,
    y: transform.y + offsetY,
  }
}
