# 更新日志（2026-05-24）

## 范围

- 新增 **桌面产品工程化指南**（Tauri + FastAPI sidecar + SQLite），覆盖 sidecar 生命周期、AppData、生产 `/api`、迁移、安装与更新路线图，供后续桌面化实施参照。
- **添加 GitHub 项目对话框**：输入 URL 后自动拉取 GitHub Description 填入简介（网络/Token 失败有提示）；移除「归入文件夹」下拉，按打开入口自动归入（文件夹右键 → 该文件夹；库根「文件夹」行 → 未归类）。
- 新增 **机器翻译**：设置页配置目标语言；简介与 README 支持「翻译」按钮，译文存 SQLite 可编辑（Google 免费通道 / deep-translator）。
- **README 分段翻译与译文交互**：逐段翻译 + Skeleton 渐进展示；内容区 **右键菜单**（原文/译文/编辑/重试）；支持 **仅重试失败段落**；Markdown 链接与展示用 HTML 围栏翻译修复。

---

## 代码变更

### 1) 桌面工程化指南文档

- **新建**：[`docs/PROJECT_PILOT_Desktop_Engineering_Guide.md`](../docs/PROJECT_PILOT_Desktop_Engineering_Guide.md) — Phase 0～2 分阶段清单、与现有 `frontend/` / `backend/` 及 `AppSetting` 配置策略对齐。
- **文档**：关联 [AGENTS.md](../AGENTS.md)、Implementation Plan、contracts/changelog 发版检查项。

### 2) 添加 GitHub 项目：简介预览与文件夹上下文

- **新建**：[`backend/app/services/github_repo_preview.py`](../backend/app/services/github_repo_preview.py)、[`frontend/src/lib/github-repo-preview.ts`](../frontend/src/lib/github-repo-preview.ts)。
- **修改**：[`backend/app/api/projects.py`](../backend/app/api/projects.py) — `GET /projects/preview-github`；[`backend/app/schemas/project_github.py`](../backend/app/schemas/project_github.py) — `GithubRepoPreviewRead`。
- **修改**：[`frontend/src/components/layout/library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx) — 去文件夹下拉；库根新建 `folder_id: null`；文件夹右键沿用 `folderId`；URL 防抖拉取简介。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json) 已导出。

### 3) GitHub 发布：`.gitignore` 与误提交清理

- **修改**：[`.gitignore`](../.gitignore) — 补充 `.env.*` / `!.env.example`、SQLite 变体与 WAL、日志、覆盖率、`.cursor/`、Vite 缓存、密钥扩展名、Tauri `target/`。
- **删除**：[`frontend/..env`](../frontend/..env) — 误命名副本（非 `.env.example`），已从索引移除。

### 4) 机器翻译模块（简介 / README）

- **后端**：`projects` 表新增 `description_translated`、`readme_translated`、`translation_target_lang`；[`backend/app/services/translation/`](../backend/app/services/translation/)（Google / deep-translator Provider、Markdown 分段）；[`POST /projects/:id/translate`](../backend/app/api/projects.py)、[`GET/PUT /settings/translation`](../backend/app/api/settings.py)。
- **前端**：[`/settings/translation`](../frontend/src/pages/settings/translation.tsx)；资料库预览与详情 **简介译文**；README Tab **原文/译文** 与编辑保存。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json) 已导出。

### 5) README 分段翻译、右键菜单与重试失败段

- **后端**：[`backend/app/services/translation/markdown_translate.py`](../backend/app/services/translation/markdown_translate.py) — `list_markdown_display_blocks`、`translate_markdown_block`；保留 **Markdown 链接** `[text](url)` 与 **纯标点片段**（如 `- `）不送入 MT，修复 `` [`/cmd`](url) `` 类段落返回空的问题；`` ```html `` 展示围栏解包为 HTML。
- **后端**：[`GET /projects/{id}/readme/blocks`](../backend/app/api/projects.py)、[`POST /projects/{id}/translate/readme-block`](../backend/app/api/projects.py) — 分段列表与单段翻译。
- **前端**：[`project-readme-tab.tsx`](../frontend/src/components/project/detail/project-readme-tab.tsx) — 逐段请求、段间延迟与重试；无译文时 **显示译文** 自动开始翻译；完成后 **留在译文** 并 toast；**重新翻译** 对话框可选 **重试失败段落**（译文段与原文段逐段比对）或 **全文重新翻译**。
- **前端**：移除 README Tab 顶栏切换按钮；[`project-translate.ts`](../frontend/src/lib/project-translate.ts) — `splitReadmeTranslatedBlocks`、`detectFailedReadmeBlockIndices`。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json) 已导出。

### 6) 简介翻译 UI 调整

- **修改**：[`project-inline-description.tsx`](../frontend/src/components/project/detail/project-inline-description.tsx) — 标题旁 **Sparkles** 翻译按钮；翻译时 Skeleton 占位；译文 **直接覆盖 `description`**（不再单独展示 `description_translated` 区块）。

---

## 验证记录

- **自动化**：`npm run build`（通过）；`python scripts/export_openapi.py`（`GET /projects/preview-github`）。
- **自动化（翻译）**：`cd backend && python -m pytest tests/test_translation.py -q`（20 passed）；`python scripts/export_openapi.py`（含 `/projects/{id}/readme/blocks`、`/projects/{id}/translate/readme-block`）。
- **手工（翻译）**：项目详情 README 右键 **显示译文** 触发分段翻译；失败段 **重试失败段落**；[`/grill-me`](url) 类链接列表可正常译出；翻译完成后停留译文 Tab 并弹出完成提示。
- **手工**：通读指南，确认与当前仓库结构（`vite.config.ts` 代理、`database.py` 内联迁移、`settings_github`）描述一致。
- **手工（添加项目）**：粘贴 GitHub URL 后简介自动填充；断网/无 Token 时有红色提示；库根「+」创建为未归类；文件夹右键添加归入该文件夹。
