# 更新日志（2026-06-22）

## 范围

- **发现中心**：列表页顶栏新增「翻译简介」按钮（位于刷新右侧），批量翻译当前已加载仓库简介为目标语言（跟随「设置 → 翻译」）；卡片内骨架屏逐条替换译文，可切回原文；滚动加载更多时自动补译。
- **README 渲染**：修复 `<picture>` + `<source srcset>` 相对路径图片加载失败（如 LMCache `asset/deployment_modes_*.png`）；Trendshift 等横幅徽章居中排版（`readme-img-hero`）。
- **README 翻译**：分段翻译遇 `424` 时 toast 报错并解除骨架屏卡住；`424` 不再盲目重试。
- **内容工厂 — 风格库 Phase 2**：资料库级 `cover-styles` CRUD、AI/手工/Fork、`recommend_cover_style` 场景、示例图生成与 **风格库** Web 弹窗；**风格库全局共享**（2026-06-22 晚）；融合方案文档 v1.7 同步。
- **内容工厂 — 风格库 Phase 2.5 + UX 精修**：参考图 vision 反推 prompt；AI Tab 双栏解析 + 悬浮「解析风格」；详情/解析区 **提示词模板** 优先、**画面前缀 / 负向提示词** 领域标签式胶囊；封面模板行滚轮横滚。

---

## 代码变更

### 1) 发现列表简介批量翻译

- **修改**：[`frontend/src/context/discovery-header.tsx`](../frontend/src/context/discovery-header.tsx) — 扩展 header 翻译状态与 `translateDescriptionsRef`。
- **修改**：[`frontend/src/components/discovery/discovery-panel-chrome.tsx`](../frontend/src/components/discovery/discovery-panel-chrome.tsx) — 翻译按钮置于刷新右侧；翻译中图标 pulse，无头部进度文案。
- **新建**：[`frontend/src/lib/translate-plain-text-batch.ts`](../frontend/src/lib/translate-plain-text-batch.ts) — 简介去重、并发调用 `/api/translation/translate-text`；`onSourceComplete` 逐条回调。
- **新建**：[`frontend/src/lib/translate-plain-text-batch.test.ts`](../frontend/src/lib/translate-plain-text-batch.test.ts) — 去重与映射单测。
- **修改**：[`frontend/src/components/discovery/discovery-repo-list.tsx`](../frontend/src/components/discovery/discovery-repo-list.tsx) — 会话级译文 Map、`translatingFullNames` 骨架态、增量补译与频道切换重置。
- **修改**：[`frontend/src/components/discovery/discovery-repo-card.tsx`](../frontend/src/components/discovery/discovery-repo-card.tsx) — `descriptionOverride` / `descriptionTranslating`。

### 2) README `<picture>` 相对路径图片

- **修改**：[`frontend/src/lib/readme-media-resolve.ts`](../frontend/src/lib/readme-media-resolve.ts) — 新增 `resolveReadmeSrcSet`；相对路径解析为 `raw.githubusercontent.com`。
- **修改**：[`frontend/src/lib/readme-media-resolve.test.ts`](../frontend/src/lib/readme-media-resolve.test.ts) — srcset 与 raw base URL 单测。
- **修改**：[`frontend/src/components/project/detail/markdown-content.tsx`](../frontend/src/components/project/detail/markdown-content.tsx) — 自定义 `<source>` 组件；sanitize 保留 `media` 属性。

### 3) README 横幅徽章居中（Trendshift 等）

- **修改**：[`frontend/src/lib/readme-image-kind.ts`](../frontend/src/lib/readme-image-kind.ts) — `isReadmeHeroBadgeImage`。
- **修改**：[`frontend/src/components/project/detail/markdown-content.tsx`](../frontend/src/components/project/detail/markdown-content.tsx) — `readme-img-hero` 与含 hero 段落纵向居中。
- **修改**：[`frontend/src/lib/readme-image-kind.test.ts`](../frontend/src/lib/readme-image-kind.test.ts) — hero 分类单测。

### 4) README 分段翻译失败体验

- **修改**：[`frontend/src/components/project/detail/project-readme-tab.tsx`](../frontend/src/components/project/detail/project-readme-tab.tsx) — 424/中断时 toast、解除 `loading` 段落回退原文；`translateInFlightRef` 防重复启动；失败段落 toast 含后端 detail。
- **修改**：[`frontend/src/lib/project-translate.ts`](../frontend/src/lib/project-translate.ts) — HTTP 424 不重试；错误信息透传。

### 5) 内容工厂 — 风格库 Phase 2（后端）

- **新建**：[`backend/app/models/content_factory_cover_style.py`](../backend/app/models/content_factory_cover_style.py)、[`cover_style_store.py`](../backend/app/services/cover_style_store.py)、[`cover_style_registry.py`](../backend/app/services/cover_style_registry.py)、[`cover_style_generate.py`](../backend/app/services/cover_style_generate.py)、[`cover_style_example_image.py`](../backend/app/services/cover_style_example_image.py)、[`prompts/content_factory/cover/generate_style.txt`](../backend/app/prompts/content_factory/cover/generate_style.txt)
- **修改**：[`backend/app/api/content_factory.py`](../backend/app/api/content_factory.py) — `cover-styles` CRUD / generate / preview / fork / example；`generate-ai-cover` 走统一 registry
- **修改**：[`backend/app/schemas/content_factory.py`](../backend/app/schemas/content_factory.py)、[`backend/app/schemas/settings_ai.py`](../backend/app/schemas/settings_ai.py) — `recommend_cover_style` 场景
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json)

### 6) 内容工厂 — 风格库 Phase 2（前端）

- **新建**：[`frontend/src/components/content-factory/cover-style-manage-dialog.tsx`](../frontend/src/components/content-factory/cover-style-manage-dialog.tsx) — **风格库**弹窗
- **修改**：[`frontend/src/components/content-factory/promotion-image-panel.tsx`](../frontend/src/components/content-factory/promotion-image-panel.tsx)、[`frontend/src/pages/content-factory/project-promotion.tsx`](../frontend/src/pages/content-factory/project-promotion.tsx)、[`frontend/src/lib/content-factory-api.ts`](../frontend/src/lib/content-factory-api.ts)

### 7) 内置风格示例图路径修复

- **根因**：builtin 无 DB 行，示例 PNG 落盘但列表无 `example_image_url`。
- **修改**：[`backend/app/services/readme_cover_storage.py`](../backend/app/services/readme_cover_storage.py) — `resolve_style_example_path()`；[`cover_style_registry.py`](../backend/app/services/cover_style_registry.py) — 列表/解析填充示例路径。
- **测试**：`test_builtin_style_example_path_from_disk`、`test_builtin_style_example_url_after_preview_file`。

### 8) 风格库弹窗 UX 迭代

- **布局**：`max-w-6xl`；固定高度 `min(calc(70vh×1.125), 630px)`，切换「全部风格 / 新增 / AI·手工·Fork」不抖动。
- **列表**：标题 **「风格库」**；示例图 `object-contain`；双击 **小红书式双栏详情**（左图右 prompt/操作）。
- **详情**：生成示例图时左侧 loading；字段中文标签（画面前缀 / 提示词模板 / 负向提示词）；prompt 可编辑；内置风格 **Fork 并保存**。
- **新增 → AI 生成**：描述 textarea 占满弹窗剩余高度。
- **文档**：[`docs/PROJECT_PILOT_内容工厂_AI封面与视觉导演融合方案.md`](../docs/PROJECT_PILOT_内容工厂_AI封面与视觉导演融合方案.md) v1.6；[`README.md`](../README.md) 补充 AI 封面与风格库说明。

### 9) 风格库改为全局共享

- **行为**：自定义风格、`style_id` 全库唯一；内置 hidden 全库一致；任意资料库内容工厂看到同一份风格列表。
- **修改**：[`cover_style_store.py`](../backend/app/services/cover_style_store.py)、[`cover_style_registry.py`](../backend/app/services/cover_style_registry.py)、[`readme_cover_storage.py`](../backend/app/services/readme_cover_storage.py) — 示例图 `_shared/styles/`；[`database.py`](../backend/app/core/database.py) — 迁移合并重复 `style_id`。
- **前端**：弹窗副标题说明全库共享；React Query key `cover-styles/global`。

### 9) 内容工厂 — 参考图生成风格 Phase 2.5

- **后端**：`readme_cover_storage` 参考图校验/临时上传/归档；`content_factory_cover_styles.reference_image_path`；`POST .../reference-upload`、`GET .../references/{id}`、`GET .../{style_id}/reference`；`POST .../generate/stream`（NDJSON 流式解析）；`POST .../save-parsed`；`LlmProvider.complete(user_images=...)` / `complete_stream`；`cover_style_vision` 模型门禁；`generate_style.txt` 参考图段落；MiniMax JSON 修复与 `thinking: disabled`。
- **前端**：AI 生成 Tab 左 **40%** 参考图区 + 右 **60%** 解析结果；右下角悬浮 **「解析风格」**（对齐封面比例钮）；流式解析 + 底部 **「保存风格」**（`save-parsed`）；详情左栏「灵感参考 / 风格示例」切换；`isRecommendCoverStyleVisionReady`；设置页 `recommend_cover_style` vision 说明。
- **契约/文档**：`contracts/openapi.json`；融合方案 §8.4、§8.2.1 v1.8；README 风格库小节。

### 10) 风格库弹窗与封面模板行 UX 精修

- **封面模板 chips**（[`promotion-image-panel.tsx`](../frontend/src/components/content-factory/promotion-image-panel.tsx)）：悬停模板行时滚轮 **横向滚动** chips，无需拖滚动条。
- **AI 生成 Tab**（[`cover-style-manage-dialog.tsx`](../frontend/src/components/content-factory/cover-style-manage-dialog.tsx)）：
  - 去掉底部 **「可选：Fork 源风格」** 与 **「补充说明」**；Fork 仍走 **Fork** 子 Tab 或详情底栏。
  - 左栏参考图区 **40%**，解析区 **60%**；**「解析风格」** 改为参考图区右下角悬浮钮（样式对齐 [`cover-size-picker.tsx`](../frontend/src/components/content-factory/cover-size-picker.tsx)）。
- **详情 / AI 解析 prompt 区**：
  - 字段顺序：**提示词模板** → **画面前缀** → **负向提示词**。
  - **画面前缀 / 负向提示词** 以 [`topicPillClass`](../frontend/src/lib/topic-pill-palette.ts) 胶囊展示（与资料库预览 **领域标签** 同风格）；宽度随内容；悬停右侧 **×** 删除；双击编辑；回车添加新条目。
- **文档**：[`docs/PROJECT_PILOT_内容工厂_AI封面与视觉导演融合方案.md`](../docs/PROJECT_PILOT_内容工厂_AI封面与视觉导演融合方案.md) §8.2.1 v1.8；[`README.md`](../README.md) 风格库 UI 一句说明。

### 11) 修复 Fork 风格删除误删源风格图片

- **原因**：Fork 时 `example_image_path` 与源风格共用同一路径；删除 Fork 时直接 `unlink` 导致源风格示例图/参考图丢失。
- **修改**：[`readme_cover_storage.py`](../backend/app/services/readme_cover_storage.py) — `clone_style_example_image` / `clone_style_reference_image`；[`content_factory.py`](../backend/app/api/content_factory.py) — Fork 复制独立资产、删除前检查是否仍被其他风格引用；[`cover_style_store.py`](../backend/app/services/cover_style_store.py) — `count_styles_referencing_asset_path`。
- **测试**：`test_fork_delete_preserves_source_style_assets`、`test_count_styles_referencing_shared_asset_path`。

---

## 验证记录

- **自动化**：`cd frontend && npm test -- --run translate-plain-text-batch readme-media-resolve readme-image-kind`；`npx tsc -b --noEmit`；`python -m pytest tests/test_cover_style_store.py tests/test_cover_style_reference_upload.py tests/test_cover_style_generate.py tests/test_cover_prompt.py tests/test_content_factory.py`；`npm run build`；`python scripts/export_openapi.py`。
- **手工**：发现中心顶栏翻译简介；LMCache README `<picture>` 图；风格库 → 上传参考图 → 悬浮「解析风格」→ 编辑胶囊 prompt →「保存风格」→ 详情展示灵感参考；封面模板行滚轮横滚 chips；vision 模型门禁提示。

---

## 后续建议

- **参考图 img2img 出图**（仍属后续；当前仅 vision 反推 prompt）。
- 设置页独立「风格库」入口；「将当前封面保存为风格范例」。
