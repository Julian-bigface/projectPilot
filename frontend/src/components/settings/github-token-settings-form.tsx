import { useMutation, useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ExternalLink } from "@/components/common/external-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useGithubPatConnect } from "@/hooks/use-github-pat-connect"
import { buildSavedGithubTokenMask } from "@/lib/github-token-mask"
import { fetchGithubSettings, postGithubTest } from "@/lib/settings-github"

const GITHUB_TOKEN_URL = "https://github.com/settings/tokens"

export function GithubTokenSettingsForm() {
  const [isEditing, setIsEditing] = useState(false)

  const settingsQuery = useQuery({
    queryKey: ["settings", "github"],
    queryFn: fetchGithubSettings,
  })

  const hasSavedToken = settingsQuery.data?.has_token ?? false

  const {
    tokenInput,
    setTokenInput,
    error: connectError,
    setError: setConnectError,
    connect,
    isConnecting,
  } = useGithubPatConnect({
    onSuccess: async () => {
      setIsEditing(false)
      toast.success("已更新并验证。")
    },
    onError: (message) => {
      toast.error(message)
    },
  })

  const testMutation = useMutation({
    mutationFn: () => postGithubTest(),
    onSuccess: (data) => {
      if (data.ok) {
        toast.success(data.message ?? "连接成功")
      } else {
        toast.error(data.message ?? "连接失败")
      }
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const busy = isConnecting || testMutation.isPending
  const showSavedMask = hasSavedToken && !isEditing && !tokenInput
  const savedTokenMask = buildSavedGithubTokenMask(settingsQuery.data?.token_length)
  const inputValue = showSavedMask ? savedTokenMask : tokenInput
  const canUpdate = isEditing && tokenInput.trim().length > 0

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="github-pat-dialog">Personal Access Token</Label>
          <ExternalLink
            href={GITHUB_TOKEN_URL}
            className="text-primary shrink-0 text-sm underline-offset-4 hover:underline"
          >
            在 GitHub 创建 Token
          </ExternalLink>
        </div>
        <Input
          id="github-pat-dialog"
          type="password"
          autoComplete="off"
          placeholder={hasSavedToken ? undefined : "ghp_… 或 github_pat_…"}
          value={inputValue}
          readOnly={showSavedMask}
          onFocus={() => {
            if (showSavedMask) {
              setIsEditing(true)
              setTokenInput("")
            }
          }}
          onBlur={() => {
            if (!tokenInput.trim() && hasSavedToken) {
              setIsEditing(false)
            }
          }}
          onChange={(e) => {
            setTokenInput(e.target.value)
            if (connectError) setConnectError(null)
          }}
          disabled={busy || settingsQuery.isLoading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy && canUpdate) {
              connect()
            }
          }}
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1"
          disabled={busy || !canUpdate}
          onClick={() => connect()}
        >
          {isConnecting ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
          更新
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={busy || !hasSavedToken}
          onClick={() => testMutation.mutate()}
        >
          {testMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : null}
          测试连接
        </Button>
      </div>

      {settingsQuery.isError ? (
        <p className="text-destructive text-sm">
          {settingsQuery.error instanceof Error ? settingsQuery.error.message : "加载失败"}
        </p>
      ) : null}
    </div>
  )
}
