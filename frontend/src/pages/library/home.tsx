import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"

import { LibraryBrowseToolbar } from "@/components/library/library-browse-toolbar"
import { SubfolderTile } from "@/components/library/subfolder-tile"
import { useLibraryBrowseFilters } from "@/context/library-browse-filters"
import { useLibraryFeatureDrawer } from "@/context/library-feature-drawer"
import { useLibrarySelection } from "@/context/library-selection"
import { useLibraryProjectsLayout } from "@/context/library-projects-layout"
import {
  applyLibraryFilters,
  collectFolderTagIdsMap,
  collectTagIdsFromProjects,
} from "@/lib/library-project-filters"
import { projectUpdatedAtMs } from "@/lib/patch-project-in-library-caches"
import {
  findFolderNode,
  flattenAllProjects,
  countProjectsInSubtree,
  projectsAtLibraryRoot,
  projectsInFolderSubtree,
} from "@/lib/library-tree"
import { ProjectGithubCard } from "@/components/project/project-github-card"
import { useLibraryProjectPreview } from "@/context/library-project-preview"
import { usePlApi } from "@/hooks/use-pl-api"
import { TagManagementPage } from "@/pages/library/tag-management"
import type { LibraryTreeResponse } from "@/types/library"
import type { Project } from "@/types/project"

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json()
    if (data && typeof data === "object" && "detail" in data) {
      const d = (data as { detail: unknown }).detail
      if (typeof d === "string") {
        return d
      }
      return JSON.stringify(d)
    }
  } catch {
    // ignore
  }
  return res.statusText || `HTTP ${res.status}`
}

export function LibraryHomePage() {
  const { libraryScope, selectedFolderId, pendingFolderId, setBrowsePendingFolderId, setLibraryScope } =
    useLibrarySelection()
  const { layout } = useLibraryProjectsLayout()
  const [includeSubfolderProjects, setIncludeSubfolderProjects] = useState(true)
  const { previewProject, setPreviewProject } = useLibraryProjectPreview()
  const { ensureFeatureDrawerOpen } = useLibraryFeatureDrawer()
  const { setSelectedTagIds, ...browseFilters } = useLibraryBrowseFilters()
  const plApi = usePlApi()

  const treeQuery = useQuery({
    queryKey: ["library", plApi.libraryId, "tree"],
    queryFn: async (): Promise<LibraryTreeResponse> => {
      const res = await fetch(plApi.path("/library/tree"))
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<LibraryTreeResponse>
    },
    enabled: libraryScope.kind !== "no_tags" && libraryScope.kind !== "trash",
  })

  const trashProjectsQuery = useQuery({
    queryKey: ["projects", plApi.libraryId, "trash"],
    queryFn: async (): Promise<Project[]> => {
      const res = await fetch(`${plApi.path("/projects")}?deleted_only=true&_start=0&_end=500`)
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<Project[]>
    },
    enabled: libraryScope.kind === "trash",
  })

  const noTagsProjectsQuery = useQuery({
    queryKey: ["projects", plApi.libraryId, "missing-tags"],
    queryFn: async (): Promise<Project[]> => {
      const res = await fetch(`${plApi.path("/projects")}?missing_tags=true&_start=0&_end=500`)
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      return res.json() as Promise<Project[]>
    },
    enabled: libraryScope.kind === "no_tags",
  })

  const tree = treeQuery.data
  const node =
    libraryScope.kind === "folder" && tree ? findFolderNode(tree.folders, libraryScope.folderId) : null

  const folderIdWhenFolder =
    libraryScope.kind === "folder" ? libraryScope.folderId : null
  useEffect(() => {
    setIncludeSubfolderProjects(true)
  }, [folderIdWhenFolder, libraryScope.kind])

  const rootLevelFolders = tree?.folders ?? []
  const childFolders = libraryScope.kind === "folder" ? (node?.children ?? []) : []

  const files: Project[] = useMemo(() => {
    if (libraryScope.kind === "trash") {
      return trashProjectsQuery.data ?? []
    }
    if (libraryScope.kind === "no_tags") {
      return noTagsProjectsQuery.data ?? []
    }
    if (libraryScope.kind === "all" && tree) {
      return flattenAllProjects(tree.folders, tree.orphan_projects)
    }
    if (libraryScope.kind === "folders_all" && tree) {
      return projectsAtLibraryRoot(
        tree.folders,
        tree.orphan_projects,
        includeSubfolderProjects
      )
    }
    if (libraryScope.kind === "uncategorized") {
      return tree?.orphan_projects ?? []
    }
    if (libraryScope.kind === "folder" && node) {
      return includeSubfolderProjects ? projectsInFolderSubtree(node) : [...node.projects]
    }
    return []
  }, [
    libraryScope.kind,
    tree,
    node,
    includeSubfolderProjects,
    noTagsProjectsQuery.data,
    trashProjectsQuery.data,
  ])

  const folderTagIdsByFolderId = useMemo(
    () => (tree ? collectFolderTagIdsMap(tree.folders) : new Map<number, number[]>()),
    [tree]
  )

  const scopeKey =
    libraryScope.kind === "folder" ? `folder:${libraryScope.folderId}` : libraryScope.kind

  useEffect(() => {
    const allowed = collectTagIdsFromProjects(files, folderTagIdsByFolderId)
    setSelectedTagIds((prev) => {
      const next = prev.filter((id) => allowed.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [scopeKey, files, folderTagIdsByFolderId, setSelectedTagIds])

  const displayFiles = useMemo(
    () =>
      applyLibraryFilters(
        files,
        {
          searchQuery: browseFilters.searchQuery,
          selectedTagIds: browseFilters.selectedTagIds,
          tagMatchMode: browseFilters.tagMatchMode,
          selectedFolderIds: browseFilters.selectedFolderIds,
          addedTimePreset: browseFilters.addedTimePreset,
        },
        folderTagIdsByFolderId
      ),
    [
      files,
      browseFilters.searchQuery,
      browseFilters.selectedTagIds,
      browseFilters.tagMatchMode,
      browseFilters.selectedFolderIds,
      browseFilters.addedTimePreset,
      folderTagIdsByFolderId,
    ]
  )

  const showBrowseToolbar =
    libraryScope.kind !== "tag_manage" &&
    libraryScope.kind !== "trash" &&
    (libraryScope.kind === "all" ||
      libraryScope.kind === "folders_all" ||
      libraryScope.kind === "uncategorized" ||
      libraryScope.kind === "folder" ||
      libraryScope.kind === "no_tags")

  const showFolderGrid =
    libraryScope.kind === "folder" || libraryScope.kind === "folders_all"
  const catalogFolders =
    libraryScope.kind === "folders_all" ? rootLevelFolders : childFolders
  const simplifyFolderDetail = showFolderGrid && catalogFolders.length === 0
  const showFilesSection =
    libraryScope.kind === "all" ||
    libraryScope.kind === "folders_all" ||
    libraryScope.kind === "uncategorized" ||
    libraryScope.kind === "folder" ||
    libraryScope.kind === "no_tags" ||
    libraryScope.kind === "trash"

  const mainLoading =
    libraryScope.kind === "no_tags"
      ? noTagsProjectsQuery.isLoading
      : libraryScope.kind === "trash"
        ? trashProjectsQuery.isLoading
        : treeQuery.isLoading
  const mainError =
    libraryScope.kind === "no_tags"
      ? noTagsProjectsQuery.isError
      : libraryScope.kind === "trash"
        ? trashProjectsQuery.isError
        : treeQuery.isError
  const mainErrorMessage =
    libraryScope.kind === "no_tags"
      ? (noTagsProjectsQuery.error as Error)?.message
      : libraryScope.kind === "trash"
        ? (trashProjectsQuery.error as Error)?.message
        : (treeQuery.error as Error)?.message

  const subfolderGridRef = useRef<HTMLDivElement>(null)
  /** 主区项目列表（含空状态）：点击此处不应先清 `pendingFolderId`，否则会在卡片 280ms 预览延迟内闪回当前 scope 文件夹 */
  const libraryFilesListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!previewProject) {
      return
    }
    const next = displayFiles.find((x) => x.id === previewProject.id)
    if (!next) {
      setPreviewProject(null)
      return
    }
    if (next === previewProject) {
      return
    }
    // 列表缓存刷新后同步预览；若列表项比当前预览更旧（例如刚翻译完尚未 refetch），不要用旧数据覆盖
    if (projectUpdatedAtMs(next) >= projectUpdatedAtMs(previewProject)) {
      setPreviewProject(next)
    }
  }, [displayFiles, previewProject, setPreviewProject])

  useEffect(() => {
    if (!showFilesSection && previewProject) {
      setPreviewProject(null)
    }
  }, [previewProject, setPreviewProject, showFilesSection])

  useEffect(() => {
    if (pendingFolderId === null) {
      return
    }
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target
      if (!(target instanceof Node)) {
        return
      }
      const root = subfolderGridRef.current
      if (root?.contains(target)) {
        return
      }
      const filesRoot = libraryFilesListRef.current
      if (filesRoot?.contains(target)) {
        return
      }
      const el = target instanceof Element ? target : null
      if (el?.closest('[role="dialog"]')) {
        return
      }
      const featureDrawer = document.getElementById("feature-drawer")
      if (featureDrawer?.contains(target)) {
        return
      }
      setBrowsePendingFolderId(null)
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => document.removeEventListener("pointerdown", onPointerDown, true)
  }, [pendingFolderId, setBrowsePendingFolderId])

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 pb-8">
      {libraryScope.kind === "tag_manage" ? (
        <TagManagementPage />
      ) : mainLoading ? (
        <p className="text-muted-foreground text-sm">加载资料库…</p>
      ) : mainError ? (
        <p className="text-destructive text-sm">
          {mainErrorMessage || "加载失败（请确认后端已启动）"}
        </p>
      ) : (
        <>
          {showBrowseToolbar ? <LibraryBrowseToolbar tree={tree} scopeFiles={files} /> : null}

          {showFolderGrid && tree && catalogFolders.length > 0 ? (
            <section aria-labelledby="lib-subfolders-heading" className="flex flex-col gap-2">
              <h2 id="lib-subfolders-heading" className="text-sm font-semibold tracking-tight">
                子文件夹 ({catalogFolders.length})
              </h2>
              <div
                ref={subfolderGridRef}
                className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,4.5rem),1fr))] gap-x-2 gap-y-3"
              >
                {catalogFolders.map((f) => (
                  <SubfolderTile
                    key={f.id}
                    name={f.name}
                    projectCount={countProjectsInSubtree(f)}
                    selected={selectedFolderId === f.id || pendingFolderId === f.id}
                    onSelect={() => {
                      setPreviewProject(null)
                      setBrowsePendingFolderId(f.id)
                      ensureFeatureDrawerOpen()
                    }}
                    onOpen={() => setLibraryScope({ kind: "folder", folderId: f.id })}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {showFilesSection ? (
            <section
              aria-label={simplifyFolderDetail ? "项目" : undefined}
              aria-labelledby={simplifyFolderDetail ? undefined : "lib-files-heading"}
            >
              {libraryScope.kind === "folder" || libraryScope.kind === "folders_all" ? (
                simplifyFolderDetail ? null : (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h2 id="lib-files-heading" className="text-sm font-semibold tracking-tight">
                      项目 ({displayFiles.length}
                      {displayFiles.length !== files.length ? ` / ${files.length}` : ""})
                    </h2>
                    <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={includeSubfolderProjects}
                        onChange={(e) => setIncludeSubfolderProjects(e.target.checked)}
                        className="border-input text-primary focus-visible:ring-ring size-4 shrink-0 rounded border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      />
                      显示子文件夹内项目
                    </label>
                  </div>
                )
              ) : (
                <h2 id="lib-files-heading" className="mb-3 text-sm font-semibold tracking-tight">
                  {libraryScope.kind === "uncategorized"
                    ? "未归类项目"
                    : libraryScope.kind === "no_tags"
                      ? `无标签项目 (${displayFiles.length})`
                      : libraryScope.kind === "trash"
                        ? `回收站中的项目 (${displayFiles.length})`
                        : libraryScope.kind === "all"
                          ? `项目 (${displayFiles.length})`
                          : `文件 (${displayFiles.length})`}
                </h2>
              )}
            <div ref={libraryFilesListRef} className="min-w-0">
              {files.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {libraryScope.kind === "trash"
                    ? "回收站为空。从资料库删除的项目会出现在这里，可恢复或彻底删除。"
                    : "此处暂无 GitHub 项目条目。"}
                </p>
              ) : displayFiles.length === 0 ? (
                <p className="text-muted-foreground text-sm">没有符合当前搜索或筛选条件的项目。</p>
              ) : (
                <div
                  className={
                    layout === "grid"
                      ? "grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3"
                      : "columns-1 [column-gap:theme(spacing.3)] sm:columns-2 xl:columns-3"
                  }
                >
                  {displayFiles.map((p) => {
                    const inTrash = libraryScope.kind === "trash"
                    return layout === "masonry" ? (
                      <div key={p.id} className="mb-3 break-inside-avoid">
                        <ProjectGithubCard
                          project={p}
                          trashMode={inTrash}
                          draggableProjectId={inTrash ? undefined : p.id}
                          fillGridCell={false}
                        />
                      </div>
                    ) : (
                      <ProjectGithubCard
                        key={p.id}
                        project={p}
                        trashMode={inTrash}
                        draggableProjectId={inTrash ? undefined : p.id}
                      />
                    )
                  })}
                </div>
              )}
            </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
