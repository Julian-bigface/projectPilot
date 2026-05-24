import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  fetchGithubSettings,
  postGithubTest,
  putGithubSettings,
} from "@/lib/settings-github"
import { cn } from "@/lib/utils"

export function SettingsGithubPage() {
  const queryClient = useQueryClient()
  const [tokenInput, setTokenInput] = useState("")
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  const settingsQuery = useQuery({
    queryKey: ["settings", "github"],
    queryFn: fetchGithubSettings,
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      putGithubSettings({
        token: tokenInput.trim() === "" ? null : tokenInput.trim(),
      }),
    onSuccess: async () => {
      setTokenInput("")
      setBanner({ type: "ok", text: "已保存。" })
      await queryClient.invalidateQueries({ queryKey: ["settings", "github"] })
    },
    onError: (err: Error) => {
      setBanner({ type: "err", text: err.message })
    },
  })

  const clearMutation = useMutation({
    mutationFn: () => putGithubSettings({ token: null }),
    onSuccess: async () => {
      setTokenInput("")
      setBanner({ type: "ok", text: "已清除数据库中的 Token（若设置了环境变量 GITHUB_TOKEN，仍可能生效）。" })
      await queryClient.invalidateQueries({ queryKey: ["settings", "github"] })
    },
    onError: (err: Error) => {
      setBanner({ type: "err", text: err.message })
    },
  })

  const testMutation = useMutation({
    mutationFn: postGithubTest,
    onSuccess: (data) => {
      setBanner({
        type: data.ok ? "ok" : "err",
        text: data.message ?? (data.ok ? "连接成功" : "连接失败"),
      })
    },
    onError: (err: Error) => {
      setBanner({ type: "err", text: err.message })
    },
  })

  const saving = saveMutation.isPending || clearMutation.isPending
  const testing = testMutation.isPending

  return (
    <div className="space-y-12">
      <header className="space-y-5">
        <h1 className="text-3xl font-semibold tracking-tight">GitHub 集成</h1>
        <p className="text-muted-foreground max-w-2xl text-[15px] leading-[1.75] md:text-base md:leading-relaxed">
          配置 Personal Access Token（PAT），用于后续从 GitHub API 拉取仓库描述、Stars、语言等。Token
          保存在本地 SQLite；请勿将数据库文件提交到公开仓库。公开仓库只读一般可使用 classic PAT 的{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">public_repo</code>{" "}
          或 Fine-grained token 的 Contents/metadata 只读权限；访问私有仓库需更高权限。
        </p>
      </header>

      {banner && (
        <div
          role="status"
          className={cn(
            "rounded-lg border px-5 py-4 text-[15px] leading-relaxed",
            banner.type === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          )}
        >
          {banner.text}
        </div>
      )}

      <section className="max-w-2xl space-y-8 rounded-xl border bg-card p-8 shadow-sm md:p-10">
        <div className="space-y-3">
          <p className="text-muted-foreground text-[15px] leading-relaxed">
            {settingsQuery.isLoading && "加载中…"}
            {!settingsQuery.isLoading && settingsQuery.data && (
              <>
                当前状态：
                {settingsQuery.data.has_token ? (
                  <>
                    <span className="text-foreground font-medium"> 已配置</span>
                    {settingsQuery.data.token_preview ? (
                      <span className="text-foreground">
                        {" "}
                        （数据库内 Token 末位：{settingsQuery.data.token_preview}）
                      </span>
                    ) : (
                      <span className="text-foreground"> （可能来自环境变量 GITHUB_TOKEN）</span>
                    )}
                  </>
                ) : (
                  <span className="text-foreground font-medium"> 未配置可用 Token</span>
                )}
              </>
            )}
          </p>
        </div>

        <div className="space-y-3">
          <Label htmlFor="github-pat" className="text-base">
            Personal Access Token
          </Label>
          <Input
            id="github-pat"
            type="password"
            autoComplete="off"
            placeholder="ghp_… 或 github_pat_…"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            disabled={saving || testing}
          />
          <p className="text-muted-foreground text-sm leading-relaxed">
            保存时将写入本地数据库；页面不会显示完整 Token，仅显示末几位用于确认。
          </p>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <Button
            type="button"
            disabled={saving || testing}
            onClick={() => {
              setBanner(null)
              saveMutation.mutate()
            }}
          >
            {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            保存
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving || testing}
            onClick={() => {
              setBanner(null)
              clearMutation.mutate()
            }}
          >
            {clearMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            清除数据库中的 Token
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving || testing}
            onClick={() => {
              setBanner(null)
              testMutation.mutate()
            }}
          >
            {testMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            测试连接
          </Button>
        </div>

        {settingsQuery.isError && (
          <p className="text-destructive text-sm">
            {settingsQuery.error instanceof Error ? settingsQuery.error.message : "加载失败"}
          </p>
        )}
      </section>
    </div>
  )
}
