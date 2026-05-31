import { useCallback } from "react"

function isFileDrag(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes("Files")
}

function pickJsonFile(e: React.DragEvent): File | null {
  const file = e.dataTransfer.files[0]
  if (!file) {
    return null
  }
  const lower = file.name.toLowerCase()
  if (!lower.endsWith(".json") && !lower.endsWith(".ppb.json")) {
    return null
  }
  return file
}

/** 原生文件拖放到 nest 区域；与 @dnd-kit 并存时仅在 Files 类型时拦截。 */
export function useFolderBundleFileDrop(onFile: (file: File) => void) {
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!isFileDrag(e)) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "copy"
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!isFileDrag(e)) {
        return
      }
      const file = pickJsonFile(e)
      if (!file) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      onFile(file)
    },
    [onFile]
  )

  return { onDragOver, onDrop, isFileDrag }
}
