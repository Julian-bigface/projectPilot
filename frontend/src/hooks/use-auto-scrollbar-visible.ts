import { useCallback, useEffect, useRef, useState } from "react"

/** 滚动时短暂显示 `main-auto-scrollbar--visible`，与主内容区行为一致 */
export function useAutoScrollbarVisible(hideDelayMs = 900) {
  const [scrollbarVisible, setScrollbarVisible] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onScroll = useCallback(() => {
    setScrollbarVisible(true)
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
    }
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null
      setScrollbarVisible(false)
    }, hideDelayMs)
  }, [hideDelayMs])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
    }
  }, [])

  return { scrollbarVisible, onScroll }
}
