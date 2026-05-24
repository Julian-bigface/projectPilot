import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  fetchTranslationSettings,
  postTranslationTest,
  putTranslationSettings,
  TRANSLATION_TARGET_LANG_LABELS,
} from "@/lib/settings-translation"
import { cn } from "@/lib/utils"

export function SettingsTranslationPage() {
  const queryClient = useQueryClient()
  const [targetLang, setTargetLang] = useState("zh-CN")
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  const settingsQuery = useQuery({
    queryKey: ["settings", "translation"],
    queryFn: fetchTranslationSettings,
  })

  useEffect(() => {
    if (settingsQuery.data?.target_lang) {
      setTargetLang(settingsQuery.data.target_lang)
    }
  }, [settingsQuery.data?.target_lang])

  const saveMutation = useMutation({
    mutationFn: () => putTranslationSettings({ target_lang: targetLang }),
    onSuccess: async () => {
      setBanner({ type: "ok", text: "目标语言已保存。" })
      await queryClient.invalidateQueries({ queryKey: ["settings", "translation"] })
    },
    onError: (err: Error) => {
      setBanner({ type: "err", text: err.message })
    },
  })

  const testMutation = useMutation({
    mutationFn: postTranslationTest,
    onSuccess: (data) => {
      if (data.ok) {
        setBanner({
          type: "ok",
          text: data.sample
            ? `翻译通道可用。示例：Hello → ${data.sample}`
            : (data.message ?? "翻译通道可用"),
        })
      } else {
        setBanner({ type: "err", text: data.message ?? "翻译测试失败" })
      }
    },
    onError: (err: Error) => {
      setBanner({ type: "err", text: err.message })
    },
  })

  const supported =
    settingsQuery.data?.supported_target_langs ?? Object.keys(TRANSLATION_TARGET_LANG_LABELS)
  const dirty = settingsQuery.data ? targetLang !== settingsQuery.data.target_lang : false

  return (
    <div className="space-y-12">
      <header className="space-y-5">
        <h1 className="text-3xl font-semibold tracking-tight">翻译</h1>
        <p className="text-muted-foreground max-w-2xl text-[15px] leading-[1.75] md:text-base md:leading-relaxed">
          使用免费 Google 机器翻译通道（非官方 API，无需 Key）。可在项目简介与 README 上点击「翻译」生成译文并保存到本地数据库。
          该通道可能被限流或临时不可用；README 较长时会分段请求，耗时更久。
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
          <Label htmlFor="translation-target-lang">目标语言</Label>
          <select
            id="translation-target-lang"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            disabled={settingsQuery.isLoading || saveMutation.isPending}
            className="border-input bg-background focus-visible:ring-ring h-10 w-full max-w-xs rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            {supported.map((code) => (
              <option key={code} value={code}>
                {TRANSLATION_TARGET_LANG_LABELS[code] ?? code}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-sm">
            Provider：{settingsQuery.data?.provider ?? "google"}（首版固定）
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={!dirty || saveMutation.isPending || settingsQuery.isLoading}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                保存中…
              </>
            ) : (
              "保存"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={testMutation.isPending || settingsQuery.isLoading}
            onClick={() => testMutation.mutate()}
          >
            {testMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                测试中…
              </>
            ) : (
              "测试翻译"
            )}
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
