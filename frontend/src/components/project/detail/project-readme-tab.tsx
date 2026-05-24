import { useQuery } from "@tanstack/react-query"
import { ExternalLink, Loader2 } from "lucide-react"
import { Link } from "react-router"

import { MarkdownContent } from "@/components/project/detail/markdown-content"
import { Button } from "@/components/ui/button"
import { parseApiErrorMessage } from "@/lib/api-error"
import type { ProjectReadme } from "@/types/project-github"

export type ProjectReadmeTabProps = {
  projectId: number
  githubUrl: string
  enabled: boolean
}

export function ProjectReadmeTab({ projectId, githubUrl, enabled }: ProjectReadmeTabProps) {
  const query = useQuery({
    queryKey: ["projects", projectId, "readme"],
    queryFn: async (): Promise<ProjectReadme> => {
      const res = await fetch(`/api/projects/${projectId}/readme`)
      if (!res.ok) {
        throw new Error(await parseApiErrorMessage(res))
      }
      return res.json() as Promise<ProjectReadme>
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  if (query.isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        正在加载 README…
      </div>
    )
  }

  if (query.isError) {
    const msg = (query.error as Error).message || "加载失败"
    const is424 = msg.includes("Token") || msg.includes("GitHub")
    return (
      <div className="text-muted-foreground border-border rounded-xl border border-dashed px-6 py-10 text-center">
        <p className="text-destructive text-sm">{msg}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {is424 ? (
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings/github">配置 GitHub Token</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              重试
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <a href={githubUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden />
              在 GitHub 查看
            </a>
          </Button>
        </div>
      </div>
    )
  }

  const content = query.data?.content?.trim()
  if (!content) {
    return (
      <p className="text-muted-foreground border-border rounded-xl border border-dashed px-6 py-10 text-center text-sm">
        该仓库暂无 README。
      </p>
    )
  }

  return <MarkdownContent content={content} />
}
