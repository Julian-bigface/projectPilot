import { useEffect, useMemo } from "react"
import { useLocation } from "react-router"

import { LibraryFolderInfoPanel } from "@/components/library/library-folder-info-panel"
import {
  LibraryScopeSummaryPanel,
  type LibraryScopeSummaryScope,
} from "@/components/library/library-scope-summary-panel"
import { ProjectLibraryPreviewPanel } from "@/components/project/project-library-preview-panel"
import { useLibrarySelection } from "@/context/library-selection"
import { useLibraryProjectPreview } from "@/context/library-project-preview"
import type { LibraryScope } from "@/types/library-scope"

function isLibraryScopeSummary(scope: LibraryScope): scope is LibraryScopeSummaryScope {
  return (
    scope.kind === "all" ||
    scope.kind === "folders_all" ||
    scope.kind === "uncategorized" ||
    scope.kind === "no_tags" ||
    scope.kind === "trash"
  )
}

export function LibraryFeatureAside() {
  const location = useLocation()
  const { libraryScope, pendingFolderId } = useLibrarySelection()
  const { previewProject, setPreviewProject } = useLibraryProjectPreview()
  const onLibrary = location.pathname === "/library"

  const folderScopeId = libraryScope.kind === "folder" ? libraryScope.folderId : null

  useEffect(() => {
    if (!onLibrary) {
      setPreviewProject(null)
    }
  }, [onLibrary, setPreviewProject])

  /** 侧栏或顶栏切换 `libraryScope` 时收起项目预览，避免挡住板块摘要 / 文件夹信息 */
  useEffect(() => {
    if (!onLibrary) {
      return
    }
    setPreviewProject(null)
  }, [onLibrary, libraryScope.kind, folderScopeId, setPreviewProject])

  const main = useMemo(() => {
    if (!onLibrary) {
      return (
        <div className="text-muted-foreground flex flex-1 flex-col justify-center p-3 text-sm">
          <p>功能待定</p>
        </div>
      )
    }
    if (previewProject) {
      return <ProjectLibraryPreviewPanel key={previewProject.id} project={previewProject} />
    }
    if (pendingFolderId !== null) {
      return <LibraryFolderInfoPanel key={`pending-${pendingFolderId}`} folderId={pendingFolderId} />
    }
    if (libraryScope.kind === "folder") {
      return <LibraryFolderInfoPanel folderId={libraryScope.folderId} />
    }
    if (isLibraryScopeSummary(libraryScope)) {
      return <LibraryScopeSummaryPanel scope={libraryScope} />
    }
    return (
      <div className="text-muted-foreground flex flex-1 flex-col gap-2 p-3 text-sm">
        <p>此处暂无板块摘要。</p>
      </div>
    )
  }, [onLibrary, previewProject, libraryScope, pendingFolderId])

  return (
    <aside className="border-border bg-muted/25 flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border-l">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{main}</div>
    </aside>
  )
}
