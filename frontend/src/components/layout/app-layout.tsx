import { PanelRightClose, PanelRightOpen } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type ReactNode, type RefObject } from "react"
import { Group, Panel, Separator, usePanelRef, type PanelImperativeHandle } from "react-resizable-panels"
import { Outlet, useLocation } from "react-router"

import { FunctionRail } from "@/components/layout/function-rail"
import { LibraryFeatureAside } from "@/components/layout/library-feature-aside"
import { LibraryDndProvider } from "@/components/layout/library-dnd-context"
import { LibraryHeaderSearch } from "@/components/library/library-header-search"
import { LibraryPanelChrome } from "@/components/layout/library-panel-chrome"
import { ProjectDetailPanelChrome } from "@/components/layout/project-detail-panel-chrome"
import { LibraryProjectsLayoutToggle } from "@/components/layout/library-projects-layout-toggle"
import { LibrarySidebarCollapseHandle } from "@/components/layout/library-sidebar-collapse-handle"
import { LibrarySidebar } from "@/components/layout/library-sidebar"
import { useLibraryFeatureDrawer } from "@/context/library-feature-drawer"
import { LibraryProjectPreviewProvider, useLibraryProjectPreview } from "@/context/library-project-preview"
import { useLibrarySelection } from "@/context/library-selection"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const FEATURE_DRAWER_OPEN_KEY = "projectPilot.featureDrawerOpen"
const LIBRARY_SIDEBAR_OPEN_KEY = "projectPilot.librarySidebarOpen"

/** 与左侧资料库 `aside` 的 `w-72`（18rem / 288px）一致：右侧栏默认宽度 */
const LIBRARY_RAIL_WIDTH_PX = "288px"

function readFeatureDrawerOpenFromStorage(): boolean {
  if (typeof window === "undefined") {
    return true
  }
  try {
    return window.localStorage.getItem(FEATURE_DRAWER_OPEN_KEY) !== "0"
  } catch {
    return true
  }
}

function readLibrarySidebarOpenFromStorage(): boolean {
  if (typeof window === "undefined") {
    return true
  }
  try {
    return window.localStorage.getItem(LIBRARY_SIDEBAR_OPEN_KEY) !== "0"
  } catch {
    return true
  }
}

/** 仅「资料库 + 存在 GitHub 项目卡片」的主区展示右侧预览栏（排除标签管理、回收站等） */
function useShowLibraryPreviewRail(pathname: string, libraryScopeKind: string): boolean {
  return pathname === "/library" && libraryScopeKind !== "tag_manage" && libraryScopeKind !== "trash"
}

function isProjectDetailPath(pathname: string): boolean {
  return /^\/projects\/\d+$/.test(pathname)
}

function AppLayoutMainShell({
  hideMainChrome,
  showPreviewRail,
  isProjectDetail,
  featureDrawerOpen,
  featurePanelRef,
  setFeatureDrawerOpen,
  children,
}: {
  hideMainChrome: boolean
  showPreviewRail: boolean
  isProjectDetail: boolean
  featureDrawerOpen: boolean
  featurePanelRef: RefObject<PanelImperativeHandle | null>
  setFeatureDrawerOpen: Dispatch<React.SetStateAction<boolean>>
  children: ReactNode
}) {
  const [mainScrollbarVisible, setMainScrollbarVisible] = useState(false)
  const mainScrollHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleHideMainScrollbar = useCallback(() => {
    if (mainScrollHideTimerRef.current) {
      clearTimeout(mainScrollHideTimerRef.current)
    }
    mainScrollHideTimerRef.current = setTimeout(() => {
      mainScrollHideTimerRef.current = null
      setMainScrollbarVisible(false)
    }, 900)
  }, [])

  const handleMainScroll = useCallback(() => {
    setMainScrollbarVisible(true)
    scheduleHideMainScrollbar()
  }, [scheduleHideMainScrollbar])

  useEffect(() => {
    return () => {
      if (mainScrollHideTimerRef.current) {
        clearTimeout(mainScrollHideTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="border-border relative flex shrink-0 items-center gap-2 border-b px-4 py-2">
        {isProjectDetail ? (
          <ProjectDetailPanelChrome />
        ) : hideMainChrome ? (
          <div className="flex min-w-0 shrink-0 items-center gap-1">
            <LibraryPanelChrome />
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">主内容区</span>
        )}
        {hideMainChrome && showPreviewRail ? (
          <div className="pointer-events-none absolute inset-x-4 top-1/2 flex -translate-y-1/2 justify-center">
            <div className="pointer-events-auto w-full max-w-md min-w-[10rem]">
              <LibraryHeaderSearch />
            </div>
          </div>
        ) : null}
        {hideMainChrome && showPreviewRail ? (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <LibraryProjectsLayoutToggle />
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground size-8 shrink-0 rounded-md"
                  aria-label={featureDrawerOpen ? "收起右侧栏" : "展开右侧栏"}
                  aria-pressed={featureDrawerOpen}
                  onClick={() => {
                    const api = featurePanelRef.current
                    if (!api) {
                      return
                    }
                    if (api.isCollapsed()) {
                      api.expand()
                      setFeatureDrawerOpen(true)
                    } else {
                      api.collapse()
                      setFeatureDrawerOpen(false)
                    }
                  }}
                >
                  {featureDrawerOpen ? (
                    <PanelRightClose className="size-4" aria-hidden />
                  ) : (
                    <PanelRightOpen className="size-4" aria-hidden />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                {featureDrawerOpen
                  ? "收起右侧栏：为主列表腾出更多横向空间。"
                  : "展开右侧栏：查看项目预览、板块摘要或文件夹信息。"}
              </TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </header>
      <main
        className={cn(
          "main-auto-scrollbar min-h-0 flex-1 overflow-auto p-4",
          mainScrollbarVisible && "main-auto-scrollbar--visible"
        )}
        onScroll={handleMainScroll}
      >
        {children}
      </main>
    </div>
  )
}

function AppLayoutInner() {
  const location = useLocation()
  const { libraryScope } = useLibrarySelection()
  const { setPreviewProject } = useLibraryProjectPreview()
  const { setEnsureOpenImpl } = useLibraryFeatureDrawer()

  const hideMainChrome = location.pathname === "/library"
  const isProjectDetail = isProjectDetailPath(location.pathname)
  const showPreviewRail = useShowLibraryPreviewRail(location.pathname, libraryScope.kind)

  const featurePanelRef = usePanelRef()
  const [featureDrawerOpen, setFeatureDrawerOpen] = useState(readFeatureDrawerOpenFromStorage)
  const [librarySidebarOpen, setLibrarySidebarOpen] = useState(readLibrarySidebarOpenFromStorage)
  const didApplyInitialCollapse = useRef(false)

  const toggleLibrarySidebar = useCallback(() => {
    setLibrarySidebarOpen((prev) => !prev)
  }, [])

  const openFeatureDrawer = useCallback(() => {
    const api = featurePanelRef.current
    if (api?.isCollapsed()) {
      api.expand()
    }
    setFeatureDrawerOpen(true)
  }, [featurePanelRef])

  useLayoutEffect(() => {
    if (!showPreviewRail) {
      return
    }
    if (didApplyInitialCollapse.current) {
      return
    }
    didApplyInitialCollapse.current = true
    if (!featureDrawerOpen) {
      featurePanelRef.current?.collapse()
    }
  }, [showPreviewRail, featureDrawerOpen, featurePanelRef])

  useEffect(() => {
    if (!showPreviewRail) {
      didApplyInitialCollapse.current = false
    }
  }, [showPreviewRail])

  useLayoutEffect(() => {
    if (!showPreviewRail) {
      setEnsureOpenImpl(null)
      return () => {
        setEnsureOpenImpl(null)
      }
    }
    setEnsureOpenImpl(openFeatureDrawer)
    return () => {
      setEnsureOpenImpl(null)
    }
  }, [showPreviewRail, setEnsureOpenImpl, openFeatureDrawer])

  useEffect(() => {
    if (!showPreviewRail) {
      setPreviewProject(null)
    }
  }, [showPreviewRail, setPreviewProject])

  useEffect(() => {
    try {
      window.localStorage.setItem(FEATURE_DRAWER_OPEN_KEY, featureDrawerOpen ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [featureDrawerOpen])

  useEffect(() => {
    try {
      window.localStorage.setItem(LIBRARY_SIDEBAR_OPEN_KEY, librarySidebarOpen ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [librarySidebarOpen])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.altKey || e.key !== ",") {
        return
      }
      const target = e.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return
      }
      e.preventDefault()
      toggleLibrarySidebar()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggleLibrarySidebar])

  const mainContent = showPreviewRail ? (
        <Group
          id="main-drawer-layout"
          orientation="horizontal"
          className="flex min-h-0 min-w-0 flex-1"
          resizeTargetMinimumSize={{ fine: 18, coarse: 28 }}
        >
          <Panel id="main-content" defaultSize="68%" minSize="40%" className="flex min-h-0 min-w-0 flex-col">
            <AppLayoutMainShell
              hideMainChrome={hideMainChrome}
              showPreviewRail={showPreviewRail}
              isProjectDetail={isProjectDetail}
              featureDrawerOpen={featureDrawerOpen}
              featurePanelRef={featurePanelRef}
              setFeatureDrawerOpen={setFeatureDrawerOpen}
            >
              <Outlet />
            </AppLayoutMainShell>
          </Panel>

          <Separator
            className={cn(
              "bg-border/35 hover:bg-border/80 focus-visible:ring-ring",
              "relative z-10 w-px max-w-px shrink-0 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            )}
          />

          <Panel
            id="feature-drawer"
            panelRef={featurePanelRef}
            collapsible
            collapsedSize="0%"
            defaultSize={LIBRARY_RAIL_WIDTH_PX}
            minSize="200px"
            maxSize="85%"
            className="flex min-h-0 min-w-0 flex-col"
            onResize={() => {
              const collapsed = featurePanelRef.current?.isCollapsed() ?? false
              setFeatureDrawerOpen(!collapsed)
            }}
          >
            <LibraryFeatureAside />
          </Panel>
        </Group>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AppLayoutMainShell
            hideMainChrome={hideMainChrome}
            showPreviewRail={showPreviewRail}
            isProjectDetail={isProjectDetail}
            featureDrawerOpen={featureDrawerOpen}
            featurePanelRef={featurePanelRef}
            setFeatureDrawerOpen={setFeatureDrawerOpen}
          >
            <Outlet />
          </AppLayoutMainShell>
        </div>
  )

  return (
    <LibraryDndProvider>
      <div className="relative flex h-full min-h-0 shrink-0 overflow-visible">
        <aside
          className={cn(
            "border-border bg-muted/15 flex flex-col overflow-hidden border-r transition-[width] duration-200 ease-out",
            librarySidebarOpen ? "w-72" : "w-0 border-r-0"
          )}
        >
          <div
            className={cn(
              "flex h-full w-72 min-w-72 flex-col",
              !librarySidebarOpen && "invisible"
            )}
          >
            <LibrarySidebar />
          </div>
        </aside>
        <LibrarySidebarCollapseHandle
          open={librarySidebarOpen}
          onOpenChange={setLibrarySidebarOpen}
        />
      </div>

      {mainContent}
    </LibraryDndProvider>
  )
}

export function AppLayout() {
  return (
    <div className="bg-background flex h-svh min-h-0 flex-col">
      <div className="flex min-h-0 min-w-0 flex-1">
        <FunctionRail />
        <LibraryProjectPreviewProvider>
          <AppLayoutInner />
        </LibraryProjectPreviewProvider>
      </div>
    </div>
  )
}
