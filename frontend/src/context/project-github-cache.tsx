import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query"
import { toast } from "sonner"

import { invalidateProjectRelated } from "@/lib/invalidate-project-queries"
import { fetchProjectReadme } from "@/lib/project-readme"
import { fetchProjectReleases } from "@/lib/project-releases"
import type { ProjectDetailTab } from "@/types/project-github"
import type { ProjectReadme, ProjectReleasesResponse } from "@/types/project-github"

export type ReadmeSyncState = "idle" | "syncing" | "synced" | "error"
export type ReleasesSyncState = ReadmeSyncState

export function defaultReadmeQueryKey(projectId: number) {
  return ["projects", projectId, "readme", "default"] as const
}

export function releasesQueryKey(projectId: number) {
  return ["projects", projectId, "releases"] as const
}

type ProjectGithubCacheContextValue = {
  readmeRequested: boolean
  releasesRequested: boolean
  readmeSyncState: ReadmeSyncState
  readmeSyncError: string | null
  defaultReadmeQuery: UseQueryResult<ProjectReadme, Error>
  syncReadmeFromGithub: (options?: { manual?: boolean }) => Promise<void>
  releasesSyncState: ReleasesSyncState
  releasesSyncError: string | null
  releasesQuery: UseQueryResult<ProjectReleasesResponse, Error>
  syncReleasesFromGithub: (options?: { manual?: boolean }) => Promise<void>
}

const ProjectGithubCacheContext = createContext<ProjectGithubCacheContextValue | null>(null)

export type ProjectGithubCacheProviderProps = {
  projectId: number
  /** 当前详情 Tab；用于仅在打开 README / Release 时拉取与同步 GitHub。 */
  activeTab: ProjectDetailTab
  children: ReactNode
}

/** 避免窗口聚焦、路由重挂载等触发重复读缓存。 */
const githubTabQueryOptions = {
  staleTime: Number.POSITIVE_INFINITY,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
} as const

export function ProjectGithubCacheProvider({
  projectId,
  activeTab,
  children,
}: ProjectGithubCacheProviderProps) {
  const queryClient = useQueryClient()
  const readmeQueryKeyFull = defaultReadmeQueryKey(projectId)
  const releasesQueryKeyFull = releasesQueryKey(projectId)

  const [readmeSyncState, setReadmeSyncState] = useState<ReadmeSyncState>("idle")
  const [readmeSyncError, setReadmeSyncError] = useState<string | null>(null)
  const readmeSyncTriggeredRef = useRef(false)

  const [releasesSyncState, setReleasesSyncState] = useState<ReleasesSyncState>("idle")
  const [releasesSyncError, setReleasesSyncError] = useState<string | null>(null)
  const releasesSyncTriggeredRef = useRef(false)

  const [readmeRequested, setReadmeRequested] = useState(activeTab === "readme")
  const [releasesRequested, setReleasesRequested] = useState(activeTab === "release")

  const defaultReadmeQuery = useQuery({
    queryKey: readmeQueryKeyFull,
    queryFn: () => fetchProjectReadme(projectId, null, { fresh: false }),
    enabled: readmeRequested,
    ...githubTabQueryOptions,
  })

  const releasesQuery = useQuery({
    queryKey: releasesQueryKeyFull,
    queryFn: () => fetchProjectReleases(projectId, { fresh: false }),
    enabled: releasesRequested,
    ...githubTabQueryOptions,
  })

  const syncReadmeFromGithub = useCallback(
    async (options?: { manual?: boolean }) => {
      setReadmeSyncState("syncing")
      setReadmeSyncError(null)
      try {
        const fresh = await fetchProjectReadme(projectId, null, { fresh: true })
        queryClient.setQueryData(readmeQueryKeyFull, fresh)
        setReadmeSyncState("synced")
        if (fresh.content_changed) {
          toast.message("README 已更新", {
            description: "仓库原文有变更，已同步最新内容。",
          })
          await invalidateProjectRelated(queryClient, projectId)
        } else if (options?.manual) {
          toast.success("README 已是最新")
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "同步失败"
        setReadmeSyncError(msg)
        setReadmeSyncState("error")
        if (options?.manual) {
          toast.error(msg)
        }
      }
    },
    [projectId, queryClient, readmeQueryKeyFull]
  )

  const syncReleasesFromGithub = useCallback(
    async (options?: { manual?: boolean }) => {
      setReleasesSyncState("syncing")
      setReleasesSyncError(null)
      try {
        const fresh = await fetchProjectReleases(projectId, { fresh: true })
        queryClient.setQueryData(releasesQueryKeyFull, fresh)
        setReleasesSyncState("synced")
        if (fresh.content_changed) {
          toast.message("Release 已更新", {
            description: "已同步 GitHub 最新 Release 列表。",
          })
          await invalidateProjectRelated(queryClient, projectId)
        } else if (options?.manual) {
          toast.success("Release 已是最新")
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "同步失败"
        setReleasesSyncError(msg)
        setReleasesSyncState("error")
        if (options?.manual) {
          toast.error(msg)
        }
      }
    },
    [projectId, queryClient, releasesQueryKeyFull]
  )

  useEffect(() => {
    readmeSyncTriggeredRef.current = false
    releasesSyncTriggeredRef.current = false
    setReadmeSyncState("idle")
    setReadmeSyncError(null)
    setReleasesSyncState("idle")
    setReleasesSyncError(null)
    setReadmeRequested(activeTab === "readme")
    setReleasesRequested(activeTab === "release")
  }, [projectId])

  useEffect(() => {
    if (activeTab === "readme") setReadmeRequested(true)
    if (activeTab === "release") setReleasesRequested(true)
  }, [activeTab])

  useEffect(() => {
    if (!readmeRequested) return
    if (!defaultReadmeQuery.isSuccess || defaultReadmeQuery.data.source !== "cache") return
    if (readmeSyncTriggeredRef.current) return
    readmeSyncTriggeredRef.current = true
    void syncReadmeFromGithub()
  }, [
    readmeRequested,
    defaultReadmeQuery.isSuccess,
    defaultReadmeQuery.data?.source,
    syncReadmeFromGithub,
  ])

  useEffect(() => {
    if (!releasesRequested) return
    if (!releasesQuery.isSuccess || releasesQuery.data.source !== "cache") return
    if (releasesSyncTriggeredRef.current) return
    releasesSyncTriggeredRef.current = true
    void syncReleasesFromGithub()
  }, [
    releasesRequested,
    releasesQuery.isSuccess,
    releasesQuery.data?.source,
    syncReleasesFromGithub,
  ])

  const value = useMemo(
    () => ({
      readmeRequested,
      releasesRequested,
      readmeSyncState,
      readmeSyncError,
      defaultReadmeQuery,
      syncReadmeFromGithub,
      releasesSyncState,
      releasesSyncError,
      releasesQuery,
      syncReleasesFromGithub,
    }),
    [
      readmeRequested,
      releasesRequested,
      readmeSyncState,
      readmeSyncError,
      defaultReadmeQuery,
      syncReadmeFromGithub,
      releasesSyncState,
      releasesSyncError,
      releasesQuery,
      syncReleasesFromGithub,
    ]
  )

  return (
    <ProjectGithubCacheContext.Provider value={value}>{children}</ProjectGithubCacheContext.Provider>
  )
}

/** @deprecated 使用 ProjectGithubCacheProvider */
export const ProjectReadmeProvider = ProjectGithubCacheProvider

export function useProjectGithubCache(): ProjectGithubCacheContextValue {
  const ctx = useContext(ProjectGithubCacheContext)
  if (!ctx) {
    throw new Error("useProjectGithubCache must be used within ProjectGithubCacheProvider")
  }
  return ctx
}

/** README 缓存（兼容旧 hook 名） */
export function useProjectReadmeStatus() {
  const ctx = useProjectGithubCache()
  return {
    syncState: ctx.readmeSyncState,
    syncError: ctx.readmeSyncError,
    defaultReadmeQuery: ctx.defaultReadmeQuery,
    syncFromGithub: ctx.syncReadmeFromGithub,
  }
}

/** Release 缓存 */
export function useProjectReleasesStatus() {
  const ctx = useProjectGithubCache()
  return {
    syncState: ctx.releasesSyncState,
    syncError: ctx.releasesSyncError,
    releasesQuery: ctx.releasesQuery,
    syncFromGithub: ctx.syncReleasesFromGithub,
  }
}
