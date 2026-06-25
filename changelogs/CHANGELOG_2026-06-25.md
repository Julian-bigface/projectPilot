# 更新日志（2026-06-25）

## 范围

- **内容工厂 — 风格库**：风格详情「视觉解构」由只读摘要改为可编辑卡片（保留原 `dl` 网格排版）；编辑草稿随 PATCH 持久化 `design_analysis`。
- **内容工厂 — 风格 AI 调整**：「AI 调整」从提示词模板旁移至详情头部（风格 ID · 来源右侧）；调用新接口 **`POST .../cover-styles/refine`**，综合修订视觉解构、画面前缀、模板、负向提示、色板与字体 token（不再仅改 `prompt_template`）。
- **视觉解构编辑 UX**：字段 textarea 使用 `[field-sizing:content]` 随内容增高；「组件」以顿号连接展示长列表；内边距 `px-2 py-1`，去掉 shadcn 默认边框与阴影。
- **封面预览切换风格**：当前风格未生成封面时不再误显示其他风格的 draft 图，改为展示该风格**示例图**（`example_image_url`）。

---

## 代码变更

### 1) 整套风格 AI 修订（后端）

- **新建**：[`backend/app/prompts/content_factory/cover/refine_style.txt`](../backend/app/prompts/content_factory/cover/refine_style.txt) — 输入当前风格 JSON + 用户意图，输出修订后的 `design_analysis`、prompt 三件套、`color_tokens`、`font_tokens`、`style_report`。
- **新建**：[`backend/app/services/cover_style_refine.py`](../backend/app/services/cover_style_refine.py) — `refine_cover_style()`；保留既有 `refine_prompt_template()`；模板占位符校验与 `{literal}` 花括号 sanitize。
- **修改**：[`backend/app/api/content_factory.py`](../backend/app/api/content_factory.py) — 新增 `POST /cover-styles/refine`；PATCH 支持写入 `design_analysis`。
- **修改**：[`backend/app/schemas/content_factory.py`](../backend/app/schemas/content_factory.py) — `CoverStyleRefineRequest` / `CoverStyleRefineResponse`；`CoverStylePatch` 扩展 `design_analysis`。
- **修改**：[`backend/app/services/cover_style_store.py`](../backend/app/services/cover_style_store.py) — `update_style()` 合并 `design_analysis`。
- **新建**：[`backend/tests/test_cover_style_refine.py`](../backend/tests/test_cover_style_refine.py) — `refine_prompt_template` 与 `refine_cover_style` 单测。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json) — `/cover-styles/refine` 与相关 schema。

### 2) 视觉解构可编辑 + 详情头 AI 调整（前端）

- **新建**：[`frontend/src/lib/cover-style-design-analysis.ts`](../frontend/src/lib/cover-style-design-analysis.ts) — `emptyCoverStyleDesignAnalysis`、`normalizeCoverStyleDesignAnalysis`。
- **新建**：[`frontend/src/components/content-factory/cover-style-design-analysis-editor.tsx`](../frontend/src/components/content-factory/cover-style-design-analysis-editor.tsx) — 十维解构 inline 编辑（类别/体系/气质/布局/标题占比/信息密度/留白/组件/记忆点）。
- **新建**：[`frontend/src/components/content-factory/cover-style-ai-refine-button.tsx`](../frontend/src/components/content-factory/cover-style-ai-refine-button.tsx) — 头部 Popover + `refineContentFactoryCoverStyle`；结果写入 `editDrafts`。
- **修改**：[`frontend/src/components/content-factory/cover-style-manage-dialog.tsx`](../frontend/src/components/content-factory/cover-style-manage-dialog.tsx) — 详情/AI 解析区接入解构编辑器；`getStyleEditSnapshot` / `applyStyleRefine`；保存时 PATCH 含 `design_analysis`；移除模板字段内嵌「AI 调整」。
- **修改**：[`frontend/src/lib/content-factory-api.ts`](../frontend/src/lib/content-factory-api.ts) — `refineContentFactoryCoverStyle()`；PATCH body 类型含 `design_analysis`。

### 3) 视觉解构编辑区样式精修

- **修改**：[`cover-style-design-analysis-editor.tsx`](../frontend/src/components/content-factory/cover-style-design-analysis-editor.tsx)  
  - 全部字段改用自适应高度 textarea（`[field-sizing:content]`、`whitespace-pre-wrap`）。  
  - 「组件」展示 `visual_components.join("、")`，编辑时仍支持换行/顿号/分号拆分。  
  - 统一 `EDITOR_TEXTAREA_CLASS`：`px-2 py-1`、`border-0 shadow-none`，聚焦仅细 ring。

### 4) 切换风格时封面预览不误用其他风格图

- **修改**：[`project-promotion.tsx`](../frontend/src/pages/content-factory/project-promotion.tsx) — 仅当 `getCoverVariant` 命中当前风格+画幅时才构造 draft `/cover` URL；否则 `coverUrl=null`，由 [`promotion-image-panel.tsx`](../frontend/src/components/content-factory/promotion-image-panel.tsx) 展示风格示例图。
- **修改**：[`cover_variants.py`](../backend/app/services/cover_variants.py) — `resolve_cover_path_for_request` 移除无 style 校验的 `cover_image_path` 兜底，避免 GET cover 返回其他风格 PNG。
- **新建**：[`test_cover_variants.py`](../backend/tests/test_cover_variants.py) — `test_resolve_cover_path_does_not_use_other_style_legacy_path`。

---

## 验证记录

- **自动化**：`cd backend && pytest tests/test_cover_style_refine.py`（3 passed）；`cd frontend && npx tsc -b --noEmit`；`python scripts/export_openapi.py`。
- **手工**：风格库 → 打开 AI 风格详情 → 头部右侧「AI 调整」输入意图并应用 → 解构/prompt 区更新 →「保存修改」落库；解构长文本（尤其「组件」）应完整换行展示、无固定高度截断。

---

## 后续建议

- 解构编辑器尚未暴露 `color_strategy` 子字段（后端十维已有）；若需手工调色策略可补 UI 行。
- 内置风格 AI 调整后仍走 Fork 流程，可考虑 toast 中强调需保存才会生成新 `style_id`。
