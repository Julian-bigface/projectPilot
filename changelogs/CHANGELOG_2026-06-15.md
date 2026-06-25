# 更新日志（2026-06-15）

## 范围

- 修复内容工厂 **README 首屏** 封面截图生成全白 PNG 的问题：离屏容器改为视口内不可见定位、导出前 DOM/像素空白检测、强制浅色排版；后端 PNG 最小尺寸校验。

---

## 代码变更

### 1) 封面截图离屏定位与空白检测

- **修改**：[`frontend/src/lib/readme-cover-capture.ts`](../frontend/src/lib/readme-cover-capture.ts) — `applyCaptureOffscreenStyles`（`opacity:0` 视口内定位，替代 `-14000px`）；`assertCaptureSurfaceReady`、`isSampleSetMostlyBlank` / upscale 后空白检测；离屏容器强制浅色背景与文字色。
- **修改**：[`frontend/src/components/content-factory/readme-cover-capture-host.tsx`](../frontend/src/components/content-factory/readme-cover-capture-host.tsx) — Host 同步新定位与 `light` 主题；同 `contentKey` 强制重生成时直接 `runExportForJob`。
- **新建**：[`frontend/src/lib/readme-cover-blank.test.ts`](../frontend/src/lib/readme-cover-blank.test.ts) — 空白抽样与 DOM 就绪校验单测。

### 2) 封面 PNG 后端校验

- **修改**：[`backend/app/services/readme_cover_storage.py`](../backend/app/services/readme_cover_storage.py) — 解析 IHDR，拒绝宽/高低于 600×400 的 PNG。
- **修改**：[`backend/tests/conftest.py`](../backend/tests/conftest.py) — `make_test_cover_png` 测试辅助；更新封面相关 pytest。

---

## 验证记录

- **自动化**：`cd frontend && npm test -- --run readme-cover`（10 passed）；`cd backend && pytest tests/test_readme_cover_storage.py tests/test_content_factory.py`（12 passed）。
- **手工**：内容工厂草稿 →「README 首屏」→「重新生成」→ 预览区应显示 README 标题/徽章而非全白图。

### 2) 修复 opacity:0 导致截图空白与 capture 挂起

- **修改**：[`readme-cover-capture.ts`](../frontend/src/lib/readme-cover-capture.ts) — 离屏容器移除 `opacity:0`（html-to-image 对透明节点截出白图）；`assertCaptureSurfaceReady` 改查内容区高度。
- **修改**：[`readme-cover-capture-host.tsx`](../frontend/src/components/content-factory/readme-cover-capture-host.tsx) — `pendingExportJobRef` + `useLayoutEffect` 统一调度导出，避免 `capture()` 永不 resolve。
- **修改**：[`project-promotion.tsx`](../frontend/src/pages/content-factory/project-promotion.tsx) — 移除 `onError` 中错误的 `isPending` 守卫，失败时正常 toast。

### 3) 封面截图代码梳理（行为不变）

- **修改**：[`readme-cover-capture.ts`](../frontend/src/lib/readme-cover-capture.ts) — 合并图片代理缓存逻辑；空白检测仅在 upscale 后做一次；删除未使用导出常量。
- **修改**：[`readme-cover-capture-host.tsx`](../frontend/src/components/content-factory/readme-cover-capture-host.tsx) — 合并 warm 续跑与换比例复用路径；去掉重复的 layout 等待 RAF。

### 4) 封面生成复用 README 缓存

- **修改**：[`project-promotion.tsx`](../frontend/src/pages/content-factory/project-promotion.tsx) — 与项目详情共用 `defaultReadmeQueryKey`；进入草稿预取 README；切换比例不再重复请求；「重新生成」才 `fresh=true` 拉 GitHub 最新原文。

### 5) 封面比例 Popover 选择后自动收起

- **修改**：[`cover-size-picker.tsx`](../frontend/src/components/content-factory/cover-size-picker.tsx) — 受控 `Popover`，点选比例后关闭面板。

### 6) README Trendshift 等横幅徽章居中排版

- **修改**：[`readme-image-kind.ts`](../frontend/src/lib/readme-image-kind.ts) — 新增 `isReadmeHeroBadgeImage`（Trendshift 等居中横幅）。
- **修改**：[`markdown-content.tsx`](../frontend/src/components/project/detail/markdown-content.tsx) — `readme-img-hero` 样式；含 hero 图的段落 `flex-col items-center` 垂直居中堆叠（与 GitHub README 一致）。
- **修改**：[`readme-image-kind.test.ts`](../frontend/src/lib/readme-image-kind.test.ts) — hero 分类单测。

### 7) 发现列表简介批量翻译

- **修改**：[`discovery-header.tsx`](../frontend/src/context/discovery-header.tsx) — 头部状态扩展翻译 busy/active/progress 与 `translateDescriptionsRef`。
- **修改**：[`discovery-panel-chrome.tsx`](../frontend/src/components/discovery/discovery-panel-chrome.tsx) — 头部右侧「翻译简介」按钮（目标语言跟随设置，可切回原文）。
- **新建**：[`translate-plain-text-batch.ts`](../frontend/src/lib/translate-plain-text-batch.ts) — 简介去重、并发批量调用 `/api/translation/translate-text`。
- **修改**：[`discovery-repo-list.tsx`](../frontend/src/components/discovery/discovery-repo-list.tsx) — 批量/增量翻译、会话级译文 Map、卡片 override。
- **修改**：[`discovery-repo-card.tsx`](../frontend/src/components/discovery/discovery-repo-card.tsx) — `descriptionOverride` 展示译文；翻译中显示骨架屏，完成后逐条替换（无头部进度文案）；翻译按钮位于刷新右侧。

### 8) README 分段翻译失败时骨架屏卡住

- **修改**：[`project-readme-tab.tsx`](../frontend/src/components/project/detail/project-readme-tab.tsx) — 翻译中断/424 时 toast 报错、解除 `loading` 段落并回退原文；防 Strict Mode 重复启动。
- **修改**：[`project-translate.ts`](../frontend/src/lib/project-translate.ts) — `424` 不再盲目重试，错误信息透传至 toast。

### 9) 封面风格解析 Phase 1：design_analysis 十维解构

- **新建**：[`cover_style_design_analysis.py`](../backend/app/services/cover_style_design_analysis.py) — `CoverStyleDesignAnalysis`（10 维）、`parse_design_analysis`、`format_design_analysis_for_image_prompt`。
- **重写**：[`generate_style.txt`](../backend/app/prompts/content_factory/cover/generate_style.txt) — 角色改为「视觉设计系统分析师」；十维解构 + 字段映射 + 转译规则。
- **修改**：[`cover_style_generate.py`](../backend/app/services/cover_style_generate.py) — 解析/保存 `design_analysis`；system 与 reference 段落强化。
- **修改**：[`content_factory_cover_style.py`](../backend/app/models/content_factory_cover_style.py) + [`database.py`](../backend/app/core/database.py) — 新增 `design_analysis` JSON 列与 SQLite 迁移。
- **修改**：[`content_factory.py`](../backend/app/schemas/content_factory.py) — `CoverStyleRead` / `CoverStyleSaveParsedRequest` 扩展 `design_analysis`；OpenAPI 导出 `CoverStyleDesignAnalysis`。
- **修改**：[`cover_prompt.py`](../backend/app/services/cover_prompt.py) — 出图 prompt 注入压缩版 design analysis。
- **修改**：前端 [`content-factory.ts`](../frontend/src/types/content-factory.ts)、[`content-factory-api.ts`](../frontend/src/lib/content-factory-api.ts)、[`cover-style-manage-dialog.tsx`](../frontend/src/components/content-factory/cover-style-manage-dialog.tsx) — 流式/保存/详情展示十维摘要。
- **新建**：[`test_cover_style_design_analysis.py`](../backend/tests/test_cover_style_design_analysis.py)。

---

## 验证记录（§9）

- **自动化**：`cd backend && pytest tests/test_cover_style_design_analysis.py tests/test_cover_style_generate.py tests/test_cover_prompt.py`（9 passed）；`cd frontend && npx tsc -b --noEmit`；`python scripts/export_openapi.py`。
- **兼容**：旧风格无 `design_analysis` 时字段 nullable，出图仍走 `prompt_prefix` + template。
