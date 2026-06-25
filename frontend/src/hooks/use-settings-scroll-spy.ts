import { useCallback, useEffect, useState, type RefObject } from "react"
import { useLocation, useNavigate } from "react-router"

import {
  isSettingsScrollSectionId,
  SETTINGS_SCROLL_SECTIONS,
  type SettingsScrollSectionId,
} from "@/lib/settings-sections"

const SECTION_IDS = SETTINGS_SCROLL_SECTIONS.map((section) => section.id)

type UseSettingsScrollSpyOptions = {
  enabled?: boolean
}

export function useSettingsScrollSpy(
  scrollRootRef: RefObject<HTMLElement | null>,
  options: UseSettingsScrollSpyOptions = {}
) {
  const { enabled = true } = options
  const navigate = useNavigate()
  const { hash } = useLocation()
  const [activeId, setActiveId] = useState<SettingsScrollSectionId>("general")

  const scrollToSection = useCallback(
    (id: SettingsScrollSectionId) => {
      setActiveId(id)
      navigate({ pathname: "/settings", hash: id }, { replace: true })
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    },
    [navigate]
  )

  useEffect(() => {
    if (!enabled) return
    const id = hash.replace(/^#/, "")
    if (!isSettingsScrollSectionId(id)) {
      return
    }
    setActiveId(id)
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [enabled, hash])

  useEffect(() => {
    if (!enabled) return
    const root = scrollRootRef.current
    if (!root) {
      return
    }

    const elements = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (element): element is HTMLElement => element != null
    )
    if (elements.length === 0) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const nextId = visible[0]?.target.id
        if (isSettingsScrollSectionId(nextId)) {
          setActiveId(nextId)
        }
      },
      { root, rootMargin: "-12% 0px -55% 0px", threshold: [0, 0.25, 0.5] }
    )

    for (const element of elements) {
      observer.observe(element)
    }
    return () => observer.disconnect()
  }, [enabled, scrollRootRef])

  return { activeId, scrollToSection }
}
