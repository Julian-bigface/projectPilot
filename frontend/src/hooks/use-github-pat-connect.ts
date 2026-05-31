import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"

import {
  postGithubTest,
  putGithubSettings,
  type GithubSettingsRead,
} from "@/lib/settings-github"

export type UseGithubPatConnectOptions = {
  /** 连接成功后回调（欢迎页用于 invalidate 后自动进入主界面） */
  onSuccess?: (data: GithubSettingsRead) => void | Promise<void>
  onError?: (message: string) => void
}

export function useGithubPatConnect(options: UseGithubPatConnectOptions = {}) {
  const queryClient = useQueryClient()
  const [tokenInput, setTokenInput] = useState("")
  const [error, setError] = useState<string | null>(null)

  const connectMutation = useMutation({
    mutationFn: async (token: string) => {
      const trimmed = token.trim()
      const testResult = await postGithubTest(trimmed)
      if (!testResult.ok) {
        throw new Error(testResult.message ?? "GitHub Token 校验失败")
      }
      return putGithubSettings({ token: trimmed })
    },
    onSuccess: async (data) => {
      setTokenInput("")
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ["settings", "github"] })
      await queryClient.invalidateQueries({ queryKey: ["settings", "github", "profile"] })
      await options.onSuccess?.(data)
    },
    onError: (err: Error) => {
      setError(err.message)
      options.onError?.(err.message)
    },
  })

  const connect = useCallback(() => {
    const trimmed = tokenInput.trim()
    if (!trimmed) {
      const message = "请输入有效的 GitHub Personal Access Token"
      setError(message)
      options.onError?.(message)
      return
    }
    setError(null)
    connectMutation.mutate(trimmed)
  }, [connectMutation, tokenInput, options])

  return {
    tokenInput,
    setTokenInput,
    error,
    setError,
    connect,
    isConnecting: connectMutation.isPending,
  }
}
