# 更新日志（2026-06-28）

## 范围

- **AI 工作室信息架构**：原单页「AI 配置」拆为 **总览 / 供应商 / 能力 / 供应商详情** 子路由（`/settings/ai/*`），UI 对齐参考设计分区；复用现有 `/api/settings/ai/config`，无 API 变更。
- **标签 AI 整理**：配置检测改为 `fetchAiConfig`，按「标签整理」场景绑定供应商检查 Key。
- **设置页 IA 瘦身（Phase 1–2）**：通用/翻译迁入 Account menu；AI 工作室独立壳层；内置 **Project Pilot AI** 官方供应商；**AI 积分** 占位页与 stub billing API。

---

## 代码变更

### 1) AI 工作室子路由与布局

- **新建**：[`frontend/src/pages/ai-settings/layout.tsx`](../frontend/src/pages/ai-settings/layout.tsx) — `AiStudioLayout`、二级 Tab 导航、`AiConfigDraftProvider`。
- **新建**：[`frontend/src/pages/ai-settings/overview.tsx`](../frontend/src/pages/ai-settings/overview.tsx) — 摘要卡 + 能力网格。
- **新建**：[`frontend/src/pages/ai-settings/providers/index.tsx`](../frontend/src/pages/ai-settings/providers/index.tsx) — 供应商卡片网格。
- **新建**：[`frontend/src/pages/ai-settings/providers/detail.tsx`](../frontend/src/pages/ai-settings/providers/detail.tsx) — 通用设置 / 模型管理 Tabs。
- **新建**：[`frontend/src/pages/ai-settings/capabilities.tsx`](../frontend/src/pages/ai-settings/capabilities.tsx) — 场景模型绑定。
- **修改**：[`frontend/src/components/layout/settings-layout.tsx`](../frontend/src/components/layout/settings-layout.tsx) — `Route path="ai/*"`、AI 页 `max-w-5xl`。
- **修改**：[`frontend/src/lib/settings-sections.ts`](../frontend/src/lib/settings-sections.ts) — 侧栏标签「AI 工作室」。

### 2) 共享状态与派生逻辑

- **新建**：[`frontend/src/context/ai-config-draft.tsx`](../frontend/src/context/ai-config-draft.tsx) — draft / save / test 共享 Context。
- **新建**：[`frontend/src/lib/ai-config-status.ts`](../frontend/src/lib/ai-config-status.ts) — 能力就绪、健康状态派生。
- **新建**：[`frontend/src/lib/ai-scenario-meta.ts`](../frontend/src/lib/ai-scenario-meta.ts) — 场景 hint、badge、图标。
- **新建**：[`frontend/src/lib/ai-studio-routes.ts`](../frontend/src/lib/ai-studio-routes.ts) — 路由常量。
- **新建**：[`frontend/src/lib/ai-config-status.test.ts`](../frontend/src/lib/ai-config-status.test.ts) — 单测 7 例。

### 3) AI 工作室 UI 组件

- **新建**：[`frontend/src/components/ai-settings/`](../frontend/src/components/ai-settings/) 下 `ai-studio-breadcrumb`、`ai-overview-stat-cards`、`ai-capability-card`、`ai-provider-card`、`provider-general-form`、`provider-models-form`、`ai-studio-shared`。

### 4) 标签 AI 配置检测

- **修改**：[`frontend/src/components/library/tag-ai-suggest-dialog.tsx`](../frontend/src/components/library/tag-ai-suggest-dialog.tsx) — `fetchAiConfig` 替代废弃 `fetchAiSettings`。

### 5) 设置页 IA 瘦身 + 官方供应商 + Billing 占位

- **新建**：[`frontend/src/components/layout/ai-studio-shell-layout.tsx`](../frontend/src/components/layout/ai-studio-shell-layout.tsx) — 无侧栏 AI 工作室壳层。
- **新建**：[`frontend/src/components/settings/translation-settings-dialog.tsx`](../frontend/src/components/settings/translation-settings-dialog.tsx)、[`frontend/src/context/translation-settings-dialog.tsx`](../frontend/src/context/translation-settings-dialog.tsx)。
- **修改**：[`frontend/src/components/layout/rail-user-menu.tsx`](../frontend/src/components/layout/rail-user-menu.tsx) — AI 工作室 / AI 积分 / 翻译偏好；移除「设置」入口。
- **修改**：[`frontend/src/components/layout/settings-layout.tsx`](../frontend/src/components/layout/settings-layout.tsx) — `/settings` 重定向至 `/settings/ai`。
- **新建**：[`frontend/src/pages/ai-settings/billing.tsx`](../frontend/src/pages/ai-settings/billing.tsx)、[`frontend/src/lib/ai-official-provider.ts`](../frontend/src/lib/ai-official-provider.ts)、[`frontend/src/lib/settings-ai-billing.ts`](../frontend/src/lib/settings-ai-billing.ts)。
- **后端**：[`backend/app/services/settings_ai.py`](../backend/app/services/settings_ai.py) 注入 `project-pilot-official`；`AiProviderRead.is_official`；`GET /api/settings/ai/billing` stub。
- **契约**：更新 [`contracts/openapi.json`](../contracts/openapi.json)。

---

## 验证记录

- **自动化**：前端 `ai-config-status` 单测 9 例、`npm run build`；后端 `pytest tests/test_settings_ai.py`（8 passed）；`python scripts/export_openapi.py`。
- **手工**：Account menu 翻译 Dialog / AI 积分 badge / AI 工作室；`/settings` 重定向；供应商列表见 Project Pilot AI；billing 充值按钮 disabled。

---

## 后续建议

- Phase 3：真实充值、调用记录、官方 provider 运行时扣费。
- 用量/费用统计与健康详情 API 留待后续迭代。

---

## 撤回官方 API + 总览能力卡优化（同日追加）

### 范围

- **移除** Project Pilot 官方中转 / AI 积分 / billing 相关前后端模块（上线周期较长，当前以用户自配 Key 为主）。
- **AI 总览**：去掉顶部「添加供应商」行；能力卡片内直接切换模型并保存。
- **消费端门禁**：标签整理、内容工厂配图/封面风格统一引导至 AI 工作室配置 Key。

### 代码变更

- **删除**：`billing.tsx`、`settings-ai-billing.ts`、`ai-official-provider.ts`、`ai-scenario-gate.ts`；后端 `settings_ai_billing` schema/service 与 `GET /ai/billing`。
- **修改**：`ai-capability-card.tsx`（卡片内模型 `<select>` + 保存）；`overview.tsx`（无添加供应商行）；供应商页/详情恢复普通 CRUD；`ai-config-status.ts` 就绪判定仅看 Key + 模型。
- **契约**：`contracts/openapi.json` 移除 billing 与 `is_official`。

### 验证记录

- 前端 `npm run build`、`ai-config-status` 单测 7 例；后端 `pytest tests/test_settings_ai.py` 7 passed；`export_openapi.py`。
