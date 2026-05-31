import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { SettingsRow } from "@/components/settings/settings-row"
import { SettingsSection } from "@/components/settings/settings-section"
import { Button } from "@/components/ui/button"
import {
  fetchTranslationSettings,
  postTranslationTest,
  putTranslationSettings,
  TRANSLATION_TARGET_LANG_LABELS,
} from "@/lib/settings-translation"
import { cn } from "@/lib/utils"

export function TranslationSettingsSection() {
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
    <SettingsSection
      id="translation"
      title="翻译"
      description="使用免费 Google 机器翻译通道（非官方 API，无需 Key）。可在项目简介与 README 上点击「翻译」生成译文并保存到本地数据库。"
    >
      {banner ? (
        <div
          role="status"
          className={cn(
            "mb-4 rounded-lg border px-4 py-3 text-sm leading-relaxed",
            banner.type === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          )}
        >
          {banner.text}
        </div>
      ) : null}

      <div className="border-border border-t">
        <SettingsRow
          label="目标语言"
          description={`Provider：${settingsQuery.data?.provider ?? "google"}（首版固定）`}
        >
          <select
            id="translation-target-lang"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            disabled={settingsQuery.isLoading || saveMutation.isPending}
            className="border-input bg-background focus-visible:ring-ring h-10 w-full max-w-xs rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none sm:ml-auto"
          >
            {supported.map((code) => (
              <option key={code} value={code}>
                {TRANSLATION_TARGET_LANG_LABELS[code] ?? code}
              </option>
            ))}
          </select>
        </SettingsRow>

        <div className="flex flex-wrap gap-3 py-6">
          <Button
            type="button"
            disabled={!dirty || saveMutation.isPending || settingsQuery.isLoading}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : null}
            保存
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={testMutation.isPending || settingsQuery.isLoading}
            onClick={() => testMutation.mutate()}
          >
            {testMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : null}
            测试翻译
          </Button>
        </div>

        {settingsQuery.isError ? (
          <p className="text-destructive pb-4 text-sm">
            {settingsQuery.error instanceof Error ? settingsQuery.error.message : "加载失败"}
          </p>
        ) : null}
      </div>
    </SettingsSection>
  )
}
