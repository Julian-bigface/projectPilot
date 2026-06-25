# 更新日志（2026-06-02）

## 范围

- **P0 标签 AI 分类** + **MiniMax 默认 AI 供应商配置**（RedBox 风格设置页）。
- **文档**：[`README.md`](../README.md) 补充 AI 设置与标签 AI API；路线见 [`docs/PROJECT_PILOT_AI_Agent_接入分析.md`](../docs/PROJECT_PILOT_AI_Agent_接入分析.md) v2。

---

## 代码变更

### 1) LLM 基础设施与 AI 设置 API

- **新建**：[`backend/app/services/llm/`](../backend/app/services/llm/) — `LlmProvider` 协议与 OpenAI 兼容 `httpx` 实现。
- **新建**：[`backend/app/services/settings_ai.py`](../backend/app/services/settings_ai.py) — SQLite KV（provider / base_url / model / api_key）；环境变量 `OPENAI_API_KEY` 回退。
- **新建**：[`backend/app/schemas/settings_ai.py`](../backend/app/schemas/settings_ai.py)。
- **修改**：[`backend/app/api/settings.py`](../backend/app/api/settings.py) — `GET/PUT /api/settings/ai`、`POST /api/settings/ai/test`。
- **新建**：[`backend/tests/test_settings_ai.py`](../backend/tests/test_settings_ai.py)。

### 2) 标签 AI 分类服务与 API

- **新建**：[`backend/app/services/tag_category_suggest.py`](../backend/app/services/tag_category_suggest.py) — 分批（60）、重试、结构化 JSON 解析；apply 支持 get-or-create 分类。
- **新建**：[`backend/app/schemas/tag_ai.py`](../backend/app/schemas/tag_ai.py)。
- **修改**：[`backend/app/api/tags.py`](../backend/app/api/tags.py) — `POST /suggest-categories`、`POST /apply-category-suggestions`（scoped 至项目库）。
- **新建**：[`backend/tests/test_tag_category_suggest.py`](../backend/tests/test_tag_category_suggest.py) — Mock LLM 批处理与 apply。

### 3) Web UI

- **新建**：[`frontend/src/lib/settings-ai.ts`](../frontend/src/lib/settings-ai.ts)、[`frontend/src/components/settings/ai-settings-section.tsx`](../frontend/src/components/settings/ai-settings-section.tsx)。
- **修改**：[`frontend/src/pages/settings/index.tsx`](../frontend/src/pages/settings/index.tsx)、[`frontend/src/lib/settings-sections.ts`](../frontend/src/lib/settings-sections.ts) — 锚点 `#ai`。
- **新建**：[`frontend/src/lib/tag-ai-suggest.ts`](../frontend/src/lib/tag-ai-suggest.ts)、[`frontend/src/components/library/tag-ai-suggest-dialog.tsx`](../frontend/src/components/library/tag-ai-suggest-dialog.tsx)、[`frontend/src/types/tag-ai.ts`](../frontend/src/types/tag-ai.ts)。
- **修改**：[`frontend/src/pages/library/tag-management.tsx`](../frontend/src/pages/library/tag-management.tsx) — 「标签分类」且选中 **未分类** 时显示 **AI 整理未分类**。

### 4) MiniMax 供应商预设（RedBox 风格 UI）

- **新建**：[`frontend/src/lib/ai-provider-presets.ts`](../frontend/src/lib/ai-provider-presets.ts) — 默认 **MiniMax（国内）**；含国际版 / OpenAI / DeepSeek / Ollama / 自定义。
- **修改**：[`frontend/src/components/settings/ai-settings-section.tsx`](../frontend/src/components/settings/ai-settings-section.tsx) — 平台预设、协议类型、Base URL、模型下拉、API Key 显隐。
- **修改**：后端默认 `https://api.minimaxi.com/v1` + `MiniMax-M2.5-highspeed`；`GET/PUT /api/settings/ai` 增加 `preset_id`；LLM 不支持 `json_object` 时自动重试。

### 5) 契约

- **契约**：[`contracts/openapi.json`](../contracts/openapi.json) — 已执行 `python scripts/export_openapi.py`（含 `preset_id`）。

### 6) AI 配置独立页 + 多供应商 / 场景映射（RedBox 风格）

- **后端**：[`backend/app/services/settings_ai.py`](../backend/app/services/settings_ai.py) — `ai_providers_json` / `ai_scenarios_json`；旧单 KV 首次读取自动迁移；标签整理读 `tag_classification` 场景。
- **API**：`GET/PUT /api/settings/ai/config`；`POST /api/settings/ai/test?provider_id=&scenario_id=`；保留 `GET/PUT /api/settings/ai` 兼容默认供应商。
- **Web**：独立路由 **`/settings/ai`**（设置左侧导航「AI」）；旧 `/ai` 重定向至该路径。
- **设置页**：[`frontend/src/pages/settings/index.tsx`](../frontend/src/pages/settings/index.tsx) 仅保留通用/翻译；AI 不在功能轨单独入口。
- **契约**：已重新导出 [`contracts/openapi.json`](../contracts/openapi.json)。

### 7) 修复：删除分类后标签未回到「未分类」

- **根因**：SQLite 默认未启用 `PRAGMA foreign_keys=ON`，`Tag.category_id` 的 `ON DELETE SET NULL` 不生效；标签仍指向已删分类 ID，前端按 `category_id IS NULL` 过滤时不可见。
- **修改**：[`backend/app/core/database.py`](../backend/app/core/database.py) — 连接级启用外键；启动迁移 `_migrate_sqlite_repair_orphan_tag_categories` 修复历史脏数据。
- **修改**：[`backend/app/api/tag_categories.py`](../backend/app/api/tag_categories.py) — 删除分类前显式 `UPDATE tags SET category_id = NULL`。
- **测试**：[`backend/tests/test_tag_categories.py`](../backend/tests/test_tag_categories.py)。

### 8) 标签 AI 整理：流式返回推荐结果

- **后端**：`POST /tags/suggest-categories/stream` — NDJSON 流，每完成一批 LLM（60 标签）即推送 `start` / `batch` / `done` 事件；原 `/suggest-categories` 保留。
- **前端**：[`tag-ai-suggest-dialog.tsx`](../frontend/src/components/library/tag-ai-suggest-dialog.tsx) — 逐批渲染推荐卡片、进度条与批次计数；关闭 Dialog 时中止请求。
- **测试**：[`test_tag_category_suggest.py`](../backend/tests/test_tag_category_suggest.py) 新增 `test_suggest_stream_ndjson`。

---

## 验证记录

- **自动化**：`cd backend && python -m pytest tests/test_settings_ai.py tests/test_tag_category_suggest.py tests/test_tag_categories.py -q` → 通过；`cd frontend && npm run build` → 通过。
- **手工**：设置 → 左侧 **AI** → 添加 MiniMax 供应商并保存；场景「标签整理」选模型；标签管理 → AI 整理未分类。
- **标签 AI UI**：推荐按分类聚合卡片展示；Ctrl/Shift 多选删除块；粗粒度归并（如 AI 子类 → AI）。

---

## 后续建议

- Step 3（可选）：suggest 时附带关联项目 `description`；Dialog 导出 JSON / 本地 snapshot 撤销。
- P1：GitHub 项目推荐工作台（话术生成），复用 `recommend_copy` 场景配置。
