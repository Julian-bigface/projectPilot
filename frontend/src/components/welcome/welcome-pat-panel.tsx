import { ArrowRight, Key, KeyRound, Loader2 } from "lucide-react"

import { ExternalLink } from "@/components/common/external-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGithubPatConnect } from "@/hooks/use-github-pat-connect"
import { cn } from "@/lib/utils"

const GITHUB_TOKEN_URL = "https://github.com/settings/tokens"

export function WelcomePatPanel() {
  const { tokenInput, setTokenInput, error, setError, connect, isConnecting } = useGithubPatConnect()

  return (
    <div className="flex h-full flex-col justify-center px-6 py-8 lg:px-10 lg:py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center lg:text-left">
          <KeyRound className="text-muted-foreground mx-auto mb-3 size-10 lg:mx-0" aria-hidden />
          <h2 className="text-xl font-semibold tracking-tight">连接 GitHub</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            配置 Personal Access Token 后进入工具。Token 保存在本地 SQLite，用于拉取仓库元数据、README
            与发现中心数据。
          </p>
        </div>

        <div className="bg-card border-border rounded-xl border p-6 shadow-sm">
          <label htmlFor="welcome-github-pat" className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Key className="size-4" aria-hidden />
            Personal Access Token
          </label>
          <Input
            id="welcome-github-pat"
            type="password"
            autoComplete="off"
            placeholder="ghp_… 或 github_pat_…"
            value={tokenInput}
            disabled={isConnecting}
            onChange={(e) => {
              setTokenInput(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isConnecting && tokenInput.trim()) {
                connect()
              }
            }}
          />
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            公开仓库只读一般可使用 classic PAT 的{" "}
            <code className="bg-muted rounded px-1 py-0.5">public_repo</code>，或 Fine-grained token
            的 Contents / metadata 只读权限。
          </p>

          {error ? (
            <p role="alert" className="text-destructive mt-3 text-sm leading-relaxed">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            className="mt-6 w-full"
            disabled={isConnecting || !tokenInput.trim()}
            onClick={connect}
          >
            {isConnecting ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <ArrowRight className="mr-2 size-4" aria-hidden />
            )}
            连接并进入
          </Button>

          <p className="text-muted-foreground mt-4 text-center text-xs">
            还没有 Token？{" "}
            <ExternalLink
              href={GITHUB_TOKEN_URL}
              className={cn("text-primary underline-offset-4 hover:underline")}
            >
              在 GitHub 创建
            </ExternalLink>
          </p>
        </div>
      </div>
    </div>
  )
}
