import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { uncollectDiscoveryProject } from "@/lib/discovery-collect"
import { invalidateProjectRelated } from "@/lib/invalidate-project-queries"

export function useDiscoveryUncollect(options?: { onSuccess?: (projectId: number) => void }) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uncollectDiscoveryProject,
    onSuccess: async (_, projectId) => {
      toast.success("已取消收藏")
      await queryClient.invalidateQueries({ queryKey: ["discovery-imported-map"] })
      await invalidateProjectRelated(queryClient, projectId)
      options?.onSuccess?.(projectId)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "取消收藏失败")
    },
  })
}
