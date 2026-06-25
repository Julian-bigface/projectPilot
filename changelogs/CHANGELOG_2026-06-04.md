# 更新日志（2026-06-04）

## 范围

- 新增 **RedBox 深度分析报告**，面向后续「GitHub 项目推荐工作台」的产品与架构借鉴。
- 交付 **内容工厂 P1**：左轨「内容工厂」入口、项目推广工作流（文案 LLM 生成 + 草稿库 + 配图 UI 壳占位）。
- **README 封面改为前端截图**：移除 Playwright/Chromium 依赖，浏览器离屏渲染后上传 PNG。
- **内容工厂项目分析**：初始态去掉「已选择平台」提示，改为分步展示「整理项目信息 → 读取扩展资料 → 读取 README → 生成推荐文案」。
- **推荐文案 Prompt**：禁止在正文中提及 Zread 等第三方工具；分析进度框固定高度，避免步骤更新时布局跳动。
- **内容工厂草稿侧栏**：按「今天 / 7 天内 / 30 天内 / 更早」分组展示，风格对齐 DeepSeek 会话列表。

---

## 内容工厂 README 封面（前端截图）

### 代码变更

- **新建**：[`frontend/src/lib/readme-cover-capture.tsx`](../frontend/src/lib/readme-cover-capture.tsx)、[`frontend/src/lib/readme-cover-truncate.ts`](../frontend/src/lib/readme-cover-truncate.ts) — 离屏 `MarkdownContent` + `html-to-image` 导出 1080×1440 PNG。
- **新建**：[`backend/app/services/readme_cover_storage.py`](../backend/app/services/readme_cover_storage.py) — 封面 PNG 校验与落盘。
- **删除**：[`backend/app/services/readme_cover_render.py`](../backend/app/services/readme_cover_render.py)（Playwright 方案）。
- **修改**：[`backend/app/api/content_factory.py`](../backend/app/api/content_factory.py) — `POST .../upload-cover` 替代 `generate-cover`。
- **修改**：[`frontend/src/pages/content-factory/project-promotion.tsx`](../frontend/src/pages/content-factory/project-promotion.tsx) — 读取 README → 截图 → 上传。
- **修改**：[`backend/pyproject.toml`](../backend/pyproject.toml) — 移除 optional `[cover]`（playwright/markdown）。
- **依赖**：`frontend` 新增 `html-to-image`。

### 验证

- `pytest backend/tests/test_readme_cover_storage.py backend/tests/test_content_factory.py`
- `npm run build`（`frontend`）
- `python scripts/export_openapi.py`

### 封面截图（复用 README 标签页样式）

- **新建**：[`readme-cover-capture-host.tsx`](../frontend/src/components/content-factory/readme-cover-capture-host.tsx) — 在内容工厂页 **#root 内**挂载与资料库 README 标签相同 DOM 结构（`group/readme-layout` + 默认 `MarkdownContent`），完整 README 顶部 `overflow:hidden` 裁切；不再 `truncate` 首屏 markdown。
- **修改**：[`readme-cover-capture.ts`](../frontend/src/lib/readme-cover-capture.ts)（原 `.tsx`）— 截图工具函数；优先复用页面上已打开的 README 标签 DOM。
- **修改**：[`project-promotion.tsx`](../frontend/src/pages/content-factory/project-promotion.tsx) — 封面生成改经 `ReadmeCoverCaptureHost`。
- **修改**：[`project-readme-tab.tsx`](../frontend/src/components/project/detail/project-readme-tab.tsx)、[`discovery-repo-readme-tab.tsx`](../frontend/src/components/discovery/discovery-repo-readme-tab.tsx) — 正文根节点 `data-readme-capture-root`。
- **修复**：`GET /api/projects/readme-image-proxy` + 截图前图片内联 — 解决「截图失败：页面样式或外链图片无法导出」（canvas 跨域）。
- **修复**：按源画布真实尺寸截图后等比放大至 1242×1660，避免右侧留白与整篇 README 被压入封面。
- **修改**：封面左右内边距 `README_CAPTURE_PADDING_X = 40`（源 640px 宽，输出约 78px）。
- **封面截取**：不做首个 `##` 语义截断，仅限制行数/字符，由 3:4 画布 `overflow:hidden` 裁切首屏；保留 picture 展平、45s 超时与任务取消防卡死。
- **超时续载**：会话内缓存已内联图片 URL；超时后保留离屏 DOM，再次「重新生成」跳过已缓存图片并延长超时（75s）。
- **裁切区优先**：截图前剥离裁切区以下 `img`/`picture`，仅对裁切区内图片自上而下代理内联；离屏渲染改 `lazy`，折外图不再预加载。
- **生成体验**：裁切区图片未全部就绪不上传；超时/未完成时自动续载（最多 3 轮），预览区显示进度文案，仅全部就绪后提示成功。
- **修复**：裁切区判定改为 DOM 顺序 + 顶边坐标（修复 height=0 时折外图被误判为区内）；续跑超时降至 25s；图片加载进度实时显示 `loaded/total`。
- **修复**：移除封面进度 `flushSync`（高频同步重绘导致白屏），改为节流 `setState` 更新进度。
- **修复**：切换封面比例时白屏——离屏 Host 常驻挂载；同 README 仅换比例时原地调整裁切高度并复用已加载 DOM/图片缓存，不再 `setJob(null)` 整树卸载；比例切换触发截图延后一帧避免与 Popover 关闭同 tick 重排。
- **修复**：封面成功后保留 warm 离屏 DOM 供换比例复用；封面 mutation 串行化 + `runId` 忽略过期结果，避免并发切换比例时旧任务报错 toast、新任务却已成功的误报。
- **修复（根因）**：`exportCoverBlob` 破坏性 DOM 操作改在 disposable `cloneNode` 上执行；换比例仅改 `surface.style.height` + ref；Host `React.memo` + 进度状态下沉；Error Boundary 兜底。
- **修复**：换比例时预览保留上一张封面（半透明 + loading 叠层），克隆导出改为只复制 markdown 内容区；导出前从 live DOM 预取图片缓存、克隆后延迟排版，空白 PNG 自动重试；上传成功后始终刷新预览 cache bust。

---

## 代码变更

### 1) RedBox 竞品/参照分析文档

- **新建**：[`docs/RedBox_分析报告.md`](../docs/RedBox_分析报告.md) — 含 Zread 与本地源码对照、RedClaw/copy-pack 落盘模式、推荐板块 API/表草案、P1～P4 路线图。
- **关联**：与 [`docs/PROJECT_PILOT_AI_Agent_接入分析.md`](../docs/PROJECT_PILOT_AI_Agent_接入分析.md) §5 推荐工作台章节交叉引用。

### 2) 内容工厂 P1（项目推广）

- **新建**：`content_factory_drafts` 表与 [`backend/app/api/content_factory.py`](../backend/app/api/content_factory.py) — 草稿 CRUD、`generate-copy`（`recommend_copy` 场景）。
- **新建**：[`backend/app/services/content_factory_copy.py`](../backend/app/services/content_factory_copy.py)、Prompt [`backend/app/prompts/content_factory/single_project.txt`](../backend/app/prompts/content_factory/single_project.txt)。
- **新建**：前端内容工厂路由 `/libraries/:id/content-factory/project-promotion`、侧栏（板块 Tab + 草稿库）、四步工作区（文案编辑 + 配图占位）。
- **修改**：[`function-rail.tsx`](../frontend/src/components/layout/function-rail.tsx)、[`app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx)、[`App.tsx`](../frontend/src/App.tsx)。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json)。

---

### 3) 内容工厂侧栏与项目选择器 UX

- 去掉侧栏副标题「GitHub 项目推荐创作」；项目库名称改为下拉切换（与资料库侧栏一致）。
- 新建草稿时的项目选择器改为**文件夹树状结构**（与资料库目录一致，含「未归类」分组）。
- 草稿列表标题改为 `text-foreground font-semibold`（更深、更醒目）；右键菜单支持**编辑标题**与**删除草稿**。
- 文案编辑区改为小红书式布局：顶部加粗标题固定，正文区可滚动；与侧栏标题同步保存。
- 标题右侧增加**智能标题**（候选列表 + AI 重新生成）；小红书平台显示 20 字计数。
- 正文右键菜单区分 **AI 优化选中**（仅润色选中片段）与 **重新生成全文**；新增 `optimize-selection` API。
- AI 优化选中时显示「正在编写」浮动指示；重新生成全文时正文区切换为骨架屏。

### 4) 内容工厂草稿「刷新后不见」修复

- **原因**：草稿按**项目库**隔离；刷新或从左侧轨进入 `/content-factory` 时若落到**另一个项目库**，侧栏会显示「暂无草稿」，但数据仍在 SQLite。
- **修改**：记忆「上次内容工厂所在项目库」（`lastContentFactoryLibraryId`）；功能区直达该库；侧栏展示当前项目库名称与空态说明；加载失败可重试；创建/保存失败 toast。
- **后端**：新建草稿默认标题 `{项目名} 推荐稿`。

### 5) 内容工厂项目分析步骤 UX

- **新建**：[`frontend/src/lib/run-project-promotion-analysis.ts`](../frontend/src/lib/run-project-promotion-analysis.ts) — 串联项目信息、Zread 关联、README 拉取与文案生成，并回调步骤状态。
- **新建**：[`frontend/src/components/content-factory/promotion-analysis-start.tsx`](../frontend/src/components/content-factory/promotion-analysis-start.tsx) — 初始「开始分析」入口与步骤进度列表。
- **修改**：[`frontend/src/pages/content-factory/project-promotion.tsx`](../frontend/src/pages/content-factory/project-promotion.tsx) — 替换原「已选择平台 + 生成内容」虚线框。
- **修改**：[`frontend/src/types/content-factory.ts`](../frontend/src/types/content-factory.ts) — 顶部步骤条文案改为「选择项目 / 项目分析」。

### 6) 推荐文案去 Zread 导流 & 分析框防跳动

- **修改**：[`backend/app/prompts/content_factory/single_project.txt`](../backend/app/prompts/content_factory/single_project.txt)、[`layout_from_source.txt`](../backend/app/prompts/content_factory/layout_from_source.txt)、[`regenerate_platform.txt`](../backend/app/prompts/content_factory/regenerate_platform.txt) — 明确要求正文不得提及 Zread、DeepWiki 等第三方工具。
- **修改**：[`backend/app/services/content_factory_copy.py`](../backend/app/services/content_factory_copy.py) — 项目上下文中移除 Zread 链接字段，降低模型误引用概率。
- **修改**：[`frontend/src/components/content-factory/promotion-analysis-start.tsx`](../frontend/src/components/content-factory/promotion-analysis-start.tsx) — 容器 `min-h-[22rem]`，每步固定行高与详情占位，避免步骤完成时框体高度变化。
- **修改**：[`frontend/src/lib/run-project-promotion-analysis.ts`](../frontend/src/lib/run-project-promotion-analysis.ts) — 分析步骤「读取 Zread」改为中性文案「读取扩展资料」。

### 7) 内容工厂草稿侧栏时间分组

- **新建**：[`frontend/src/lib/group-content-factory-drafts-by-time.ts`](../frontend/src/lib/group-content-factory-drafts-by-time.ts) — 按 `updated_at` 归入今天 / 7 天内 / 30 天内 / 更早。
- **修改**：[`frontend/src/components/content-factory/content-factory-sidebar.tsx`](../frontend/src/components/content-factory/content-factory-sidebar.tsx) — 分组标题 + 草稿列表，空分组不展示。

---

## 验证记录

- **自动化**：`pytest tests/test_content_factory.py`（3 passed）；`npm run build`（frontend）；`vitest readme-cover-capture-clone.test.ts`（clone 不破坏 live DOM）。
- **手工**：配置 AI → 内容工厂 → 新建草稿 → 生成文案 → 编辑保存 → 导出 Markdown；配图区显示 P2 占位。
- **手工**：多项目库场景下刷新 / 点击左轨「内容工厂」应回到上次编辑的库并看到草稿列表。
- **手工**：新建草稿后点击「开始分析」，应依次看到四步进度，完成后进入文案编辑工作台。
