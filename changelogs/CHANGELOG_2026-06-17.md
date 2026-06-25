# 更新日志（2026-06-17）

## 范围

- 内容工厂 **AI 封面 Phase 1 落地**：设置页 `recommend_image` 生图测试、5 内置风格预设、`generate-ai-cover` 全链路、前端封面区 Key 门禁与「生成封面」按钮。
- 方案文档：RootFlowAI Phase B、§8.3 AI 风格库、§13 产品决策定稿（v1.3–v1.5）。

---

## 代码变更

### 1) 后端生图与风格预设

- **新建**：[`backend/app/services/recommend_image.py`](../backend/app/services/recommend_image.py) — OpenAI 兼容 `POST /images/generations`，解析 `b64_json`。
- **新建**：[`backend/app/services/cover_style_presets.py`](../backend/app/services/cover_style_presets.py) — §7 五条内置风格（prompt / 色板 / font_tokens 枚举）。
- **新建**：[`backend/app/services/cover_prompt.py`](../backend/app/services/cover_prompt.py) — 拼装宣传文案 prompt + `prompt_hash`。
- **新建**：[`backend/app/services/cover_size_presets.py`](../backend/app/services/cover_size_presets.py) — 画幅 → `aspect_ratio` 映射。
- **修改**：[`backend/app/services/readme_cover_storage.py`](../backend/app/services/readme_cover_storage.py) — `save_ai_cover_png` / `cover_ai_*` 文件名。
- **修改**：[`backend/app/api/content_factory.py`](../backend/app/api/content_factory.py) — `GET .../cover-styles`、`POST .../generate-ai-cover`、AI/readme 封面 merge 拆分。
- **修改**：[`backend/app/schemas/content_factory.py`](../backend/app/schemas/content_factory.py) — `GenerateAiCoverRequest`、`CoverStyleRead`、`cover_source` 等字段。
- **修改**：[`backend/app/api/settings.py`](../backend/app/api/settings.py) — `scenario_id=recommend_image` 时走生图探测 `probe_image_connection`。

### 2) 前端内容工厂与设置

- **修改**：[`frontend/src/pages/content-factory/project-promotion.tsx`](../frontend/src/pages/content-factory/project-promotion.tsx) — `aiCoverMutation`、双路径封面预览、切换 AI 风格不触发生图。
- **修改**：[`frontend/src/components/content-factory/promotion-image-panel.tsx`](../frontend/src/components/content-factory/promotion-image-panel.tsx) — AI 模板生成/下载、无 Key 禁用、画幅选择器共用。
- **修改**：[`frontend/src/lib/content-factory-api.ts`](../frontend/src/lib/content-factory-api.ts) — `generateContentFactoryAiCover`、`fetchContentFactoryCoverStyles`。
- **新建**：[`frontend/src/lib/recommend-image-ready.ts`](../frontend/src/lib/recommend-image-ready.ts) — 判断 `recommend_image` 是否已配置 Key。
- **修改**：[`frontend/src/pages/ai-settings/index.tsx`](../frontend/src/pages/ai-settings/index.tsx) — 场景级「测试生图/测试场景」按钮。

### 3) 测试与契约

- **新建**：[`backend/tests/test_cover_prompt.py`](../backend/tests/test_cover_prompt.py)、[`test_cover_style_presets.py`](../backend/tests/test_cover_style_presets.py)、[`test_recommend_image.py`](../backend/tests/test_recommend_image.py)。
- **修改**：[`backend/tests/test_content_factory.py`](../backend/tests/test_content_factory.py)、[`test_settings_ai.py`](../backend/tests/test_settings_ai.py) — 生图 API 与设置测试。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json) — 新增 cover-styles、generate-ai-cover。

### 7) 封面按风格/画幅分 variant 存储与命名

- **新建**：[`backend/app/services/cover_variants.py`](../backend/app/services/cover_variants.py) — `cover_variants` 索引（`{风格}::{画幅}` → PNG 路径）。
- **修改**：[`backend/app/services/readme_cover_storage.py`](../backend/app/services/readme_cover_storage.py) — 文件名 `{项目}_{风格}_{比例}_{后缀}.png`；`force` 重生成写入新时间戳文件，不覆盖历史。
- **修改**：[`backend/app/api/content_factory.py`](../backend/app/api/content_factory.py) — GET/POST cover 支持 `style_id` + `size_preset_id` 查询 variant。
- **修改**：[`frontend/src/lib/content-factory-cover-variants.ts`](../frontend/src/lib/content-factory-cover-variants.ts) — 切换模板时读取对应 variant 预览。

---

- **新建**：[`backend/app/services/reveal_in_folder.py`](../backend/app/services/reveal_in_folder.py) — Windows/macOS/Linux 在文件管理器中定位 PNG。
- **修改**：[`backend/app/api/content_factory.py`](../backend/app/api/content_factory.py) — `POST .../reveal-cover`。
- **修改**：[`frontend/src/components/content-factory/promotion-image-panel.tsx`](../frontend/src/components/content-factory/promotion-image-panel.tsx) — 封面预览区右键菜单。

---

- **修改**：[`backend/app/services/recommend_image.py`](../backend/app/services/recommend_image.py) — 请求改用 `size`（比例如 `3:4`），移除 `response_format: b64_json`；支持响应 `url` 下载与 `b64_json` 双路径；GPT 模型传 `quality: high`；超时 900s。
- **修改**：[`frontend/src/lib/ai-provider-presets.ts`](../frontend/src/lib/ai-provider-presets.ts) — RootFlowAI 预设模型改为官方计次名（如 `gemini-3.1-flash-image-count`、`gpt-image-2-count`），补充令牌分组提示与文档链接。
- **修改**：[`backend/tests/test_recommend_image.py`](../backend/tests/test_recommend_image.py) — 覆盖 URL 下载与 GPT quality 请求体。

---

- **修改**：[`docs/PROJECT_PILOT_内容工厂_AI封面与视觉导演融合方案.md`](../docs/PROJECT_PILOT_内容工厂_AI封面与视觉导演融合方案.md) — v1.5；§13 产品决策、RootFlowAI、AI 风格库。

---

## 验证记录

- **自动化**：`python -m pytest tests/test_cover_prompt.py tests/test_cover_style_presets.py tests/test_recommend_image.py tests/test_content_factory.py tests/test_settings_ai.py` — 23 passed；`npm run build`（frontend）通过；`python scripts/export_openapi.py` 已执行。
- **手工**：设置 → AI 绑定 RootFlowAI + 推荐配图 → 测试生图；内容工厂选 AI 风格 → 生成封面 → 下载 PNG。

---

## 后续建议

- ~~Phase 2：`cover-styles` 用户/AI 风格 CRUD、`recommend_cover_style` 场景。~~ ✅ 2026-06-22 见 [`CHANGELOG_2026-06-22.md`](./CHANGELOG_2026-06-22.md)。
- Phase 2.5：参考图上传 + vision LLM 生成风格 prompt（非 Agent）。
- 可选：README 与 AI 封面切换时清理过期 `cover_image_path` 预览歧义。
