import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { Link, useParams } from "react-router"
import { toast } from "sonner"

import { ProjectDetailHeader } from "@/components/project/detail/project-detail-header"
import { ProjectDetailTabs } from "@/components/project/detail/project-detail-tabs"
import { parseApiErrorMessage } from "@/lib/api-error"
import { invalidateProjectRelated } from "@/lib/invalidate-project-queries"
import type { Project } from "@/types/project"

export function ProjectDetailPage() {
  const queryClient = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const projectId = id ? Number.parseInt(id, 10) : Number.NaN
  const validId = Number.isFinite(projectId)
  const statsSyncStartedRef = useRef(false)

  const query = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: async (): Promise<Project> => {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) {
        throw new Error(await parseApiErrorMessage(res))
      }
      return res.json() as Promise<Project>
    },
    enabled: validId,
  })

  const statsSyncMutation = useMutation({
    mutationFn: async (): Promise<Project> => {
      const res = await fetch(`/api/projects/${projectId}/refresh-github?scope=stats`, {
        method: "POST",
      })
      if (!res.ok) {
        throw new Error(await parseApiErrorMessage(res))
      }
      return res.json() as Promise<Project>
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(["projects", "detail", projectId], data)
      await invalidateProjectRelated(queryClient, projectId)
      toast.success("已从 GitHub 更新统计信息", { duration: 2500 })
    },
    onError: (err) => {
      const msg = (err as Error).message || "同步失败"
      if (msg.includes("Token") || msg.includes("GitHub")) {
        toast.message("未同步 GitHub 统计", {
          description: "可在设置中配置 Token 后刷新页面重试。",
          duration: 3000,
        })
      } else {
        toast.error(msg, { duration: 3000 })
      }
    },
  })

  useEffect(() => {
    statsSyncStartedRef.current = false
  }, [projectId])

  useEffect(() => {
    if (!validId || !query.isSuccess || statsSyncStartedRef.current) {
      return
    }
    statsSyncStartedRef.current = true
    statsSyncMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 进入详情页仅自动同步一次
  }, [validId, query.isSuccess, projectId])

  const handleProjectUpdated = (data: Project) => {
    queryClient.setQueryData(["projects", "detail", projectId], data)
  }

  if (!validId) {
    return (
      <div className="w-full py-8">
        <p className="text-destructive text-sm">无效的项目 ID。</p>
        <Link to="/library" className="text-muted-foreground mt-4 inline-block text-sm hover:underline">
          返回资料库
        </Link>
      </div>
    )
  }

  if (query.isLoading) {
    return (
      <div className="w-full py-8">
        <p className="text-muted-foreground text-sm">加载项目信息…</p>
      </div>
    )
  }

  if (query.isError) {
    const msg = (query.error as Error).message || "加载失败"
    return (
      <div className="w-full py-8">
        <p className="text-destructive text-sm">{msg}</p>
        <Link to="/library" className="text-muted-foreground mt-4 inline-block text-sm hover:underline">
          返回资料库
        </Link>
      </div>
    )
  }

  const p = query.data!

  return (
    <div className="flex w-full flex-col gap-2 pb-12">
      <ProjectDetailHeader
        project={p}
        statsSyncing={statsSyncMutation.isPending}
        onProjectUpdated={handleProjectUpdated}
      />

      <ProjectDetailTabs project={p} />
    </div>
  )
}
