import { Link } from "react-router"

import { AiConnectedBadge, AiStatCard } from "@/components/ai-settings/ai-studio-shared"
import {
  countReadyScenarios,
  getDefaultProvider,
  providerHealthSummary,
} from "@/lib/ai-config-status"
import { AI_STUDIO_ROUTES } from "@/lib/ai-studio-routes"
import type { AiConfigRead } from "@/lib/settings-ai"

export type AiOverviewStatCardsProps = {
  config: AiConfigRead
}

export function AiOverviewStatCards({ config }: AiOverviewStatCardsProps) {
  const defaultProvider = getDefaultProvider(config)
  const { ready, total } = countReadyScenarios(config)
  const health = providerHealthSummary(config.providers)
  const allHealthy = health.missingKey === 0

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AiStatCard
        title="当前默认 AI"
        footer={
          <Link
            to={AI_STUDIO_ROUTES.providers}
            className="text-primary hover:underline underline-offset-4"
          >
            更改默认 →
          </Link>
        }
      >
        {defaultProvider ? (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold leading-tight">{defaultProvider.name}</p>
              <AiConnectedBadge connected={defaultProvider.has_api_key} className="shrink-0" />
            </div>
            <p className="text-muted-foreground text-sm">{defaultProvider.default_model}</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">尚未配置供应商</p>
        )}
      </AiStatCard>

      <AiStatCard
        title="可用能力"
        footer={
          ready === total ? (
            <span className="text-emerald-600 dark:text-emerald-400">全部可用</span>
          ) : (
            <Link
              to={AI_STUDIO_ROUTES.capabilities}
              className="text-primary hover:underline underline-offset-4"
            >
              配置能力 →
            </Link>
          )
        }
      >
        <p className="text-2xl font-semibold tracking-tight">
          {ready}
          <span className="text-muted-foreground text-lg font-normal"> / {total}</span>
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {ready === total ? "所有 AI 能力已就绪" : `${total - ready} 个能力待配置`}
        </p>
      </AiStatCard>

      <AiStatCard title="今日用量">
        <p className="text-muted-foreground text-sm">暂未统计</p>
        <p className="text-muted-foreground/70 mt-1 text-xs">Token 与费用统计将在后续版本提供</p>
      </AiStatCard>

      <AiStatCard
        title="健康状态"
        footer={
          <Link
            to={AI_STUDIO_ROUTES.providers}
            className="text-primary hover:underline underline-offset-4"
          >
            查看详情 →
          </Link>
        }
      >
        {allHealthy ? (
          <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">全部正常</p>
        ) : (
          <div>
            <p className="text-lg font-semibold">{health.missingKey} 个待配置</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {health.ok}/{health.total} 个供应商已配置 Key
            </p>
          </div>
        )}
      </AiStatCard>
    </div>
  )
}
