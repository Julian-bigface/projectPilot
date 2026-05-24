# Project Pilot

本地 GitHub 项目探索管理工具：**浏览器 Web UI**（`frontend/`：React + Vite + Refine + shadcn/ui）+ **FastAPI 后端** + **SQLite**。**不使用 Tkinter 等原生桌面 GUI**；主交互即本地打开的网页。

详细产品设计见 [docs/PROJECT_PILOT_v0.1_设计文档.md](docs/PROJECT_PILOT_v0.1_设计文档.md) 与 [docs/PROJECT_PILOT_Implementation_Plan.md](docs/PROJECT_PILOT_Implementation_Plan.md)。**桌面化（Tauri + sidecar）** 见 [docs/PROJECT_PILOT_Desktop_Engineering_Guide.md](docs/PROJECT_PILOT_Desktop_Engineering_Guide.md)。协作约定见 [AGENTS.md](AGENTS.md)、[WORKSPACE.md](WORKSPACE.md)。**每次开发请更新** [changelogs/](changelogs/README.md) 中当日的 `CHANGELOG_YYYY-MM-DD.md`（同一天多次变更写在同一文件）。**Changelog 正文排版**须遵守 [changelogs/README.md](changelogs/README.md) 中的 **「正文格式（固定写法）」**，与 [`CHANGELOG_2026-05-10.md`](changelogs/CHANGELOG_2026-05-10.md)、[`CHANGELOG_2026-05-12.md`](changelogs/CHANGELOG_2026-05-12.md)、[`CHANGELOG_2026-05-14.md`](changelogs/CHANGELOG_2026-05-14.md) 等往期一致。

## 环境要求

- **Python** 3.11+
- **Node.js** 20+（建议 LTS，用于 `frontend/`）

## 后端（FastAPI）

```powershell
cd backend
python -m pip install -e ".[dev]"
copy .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- 健康检查：`GET http://127.0.0.1:8000/health` → `{"status":"ok"}`
- OpenAPI：`http://127.0.0.1:8000/docs`，或 `http://127.0.0.1:8000/openapi.json`
- **标签与分类**：`GET/POST/PATCH/DELETE /tags`（`category_id` 可空表示未分类）、`GET/POST/PATCH/DELETE /tag-categories`；列表含 `usage_count` 与可选 `category_name`。**项目**：`GET /projects` 默认不含回收站；`deleted_only=true` 仅回收站；`DELETE /projects/:id` 为软删；`POST /projects/:id/restore` 恢复；`DELETE /projects/:id/permanent` 彻底删除；`POST /projects/:id/translate` 机器翻译简介/README（译文存 DB）。**README 分段**：`GET /projects/:id/readme/blocks`、`POST /projects/:id/translate/readme-block`（配合 Web 逐段翻译）。**翻译设置**：`GET/PUT /settings/translation`、 `POST /settings/translation/test`（免费 Google 通道，目标语言可配置）。契约见 [`contracts/openapi.json`](contracts/openapi.json)。

### 契约文件（变更 API 时必更新）

仓库内 [`contracts/openapi.json`](contracts/openapi.json) 需与当前后端一致。**凡修改会影响 OpenAPI 的后端代码**，在提交前于仓库根目录执行：

```powershell
python scripts/export_openapi.py
```

并将生成的 `contracts/openapi.json` 一并提交。详见 [`contracts/README.md`](contracts/README.md)。

## 前端（Web UI）

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

- 开发地址默认 `http://localhost:5173`
- Vite 将 `/api` 代理到 `http://127.0.0.1:8000`，并去掉路径前缀（例如 `/api/health` → 后端 `/health`）

**默认打开 `/library`：**知识库式主区**；数据来自 `GET /api/library/tree`（与侧栏 **同一 `libraryScope` 导航状态**）。主区按入口分支大致如下：

| 侧栏 / 状态 | 主区表现 |
|-------------|----------|
| **全部** | 库内全部 GitHub 项目一张扁平表（含未归类与各文件夹下项目）。 |
| **未分类** | 仅 `folder_id` 为空的未归类项目表。 |
| **文件夹**（标题行入口，`folders_all`） | 上半：**根下一层**文件夹卡片网格（大图标 + 名称 + 项数）；下半：**项目**表（仅统计树内已归入文件夹的项目，不含未归类）。 |
| **树中选中某一文件夹**（`folder`） | **主 Panel 顶栏**显示当前板块名并支持 **后退 / 前进**（资料库内导航栈）；主区正文不再重复大号标题。上半：**子文件夹 (n)**——仅 **下一级**子文件夹卡片；下半：**项目 (m)** 表，并提供 **「显示子文件夹内项目」** 复选框：勾选时列出当前文件夹 **整棵子树** 内项目，取消则仅 **直接挂在本文件夹下** 的项目。 |
| **标签管理**（`tag_manage`） | **所有标签**（按首字符分组 + 使用次数）、**标签分类**（自建分类 + **未分类** 首栏，**拖拽**标签到各栏归类；`DragOverlay` 避免裁切，碰撞仅认分类栏，**`PATCH` 乐观更新**；**无**浮层松手退回动画）。新建/重命名/删除分类。`GET /api/tags`、`/api/tag-categories`。 |
| **无标签**（`no_tags`） | 主区列出 **`GET /api/projects?missing_tags=true`** 的项目（无任何 `project_tags`）；侧栏显示数量。保存项目的 **`PATCH /api/projects/:id`（`tag_ids`）** 或详情编辑标签后，`usage_count` 与列表同步刷新。 |
| **回收站**（`trash`） | **`GET /api/projects?deleted_only=true`** 列出已软删项目；卡片可 **恢复**（`POST /api/projects/:id/restore`）或 **彻底删除**（`DELETE /api/projects/:id/permanent`）。侧栏显示回收站数量。 |

资料库主区（除 **标签管理**、**回收站** 外）：**全文搜索**在 **`/library` 顶栏**（与网格/瀑布流、收起右栏同级，居中弱样式输入框）；子文件夹与项目列表上方为 **筛选** 一行（**标签** 双栏 Popover + **任意符合(或)** / **全部符合(且)**；**文件夹** 多选——`all` / `folders_all` 为根层文件夹、进入某文件夹时仅**直接子文件夹**；**未分类**、**无标签** 下文件夹筛选不可用；标签列表仅含当前 scope 内项目已用标签；**时间** 占位）。筛选在已加载列表上 **客户端** 执行，项目计数与卡片网格随筛选结果更新。

主界面整体为 **语雀式三栏 + 可调整右栏**：**最左窄条功能区**（含资料库、项目列表、看板等入口，**始终保留**）→ **库侧栏**（默认 `w-72`，可 **收起为 0**；与主区分界处有 **pill 伸收**：默认隐藏，鼠标移入分界悬停区时在 **约 1/4 高度** 显示，移开或点击后隐藏；状态写入 **`localStorage`**（`projectPilot.librarySidebarOpen`）；快捷键 **`Ctrl+Alt+,`**（输入框内不触发）。侧栏最上为 **搜索文件夹** 输入框，其下为「全部 / 未分类 / …」快捷行，再下为可点击的 **「文件夹」** 文案 + 绿色 **新建**，整行在 DnD 中作为 **`nest-root` 投放区**：项目拖入则 **`folder_id: null`**，子文件夹拖入则 **`parent_id: null`**，悬停为浅色底高亮；其下为可滚动 **文件夹树**，节点带数量徽标，**右键** 文件夹行可「**添加 GitHub 项目** / 新建子文件夹 / 重命名 / 删除」（与绿色 **新建** 下拉中的「添加 GitHub 项目」共用同一对话框：库根行新建 → **未归类**；文件夹右键 → **归入该文件夹**；输入 URL 后自动拉取 GitHub Description 填入简介，网络或 Token 异常时有提示；**删除**会移除该文件夹及其**所有子文件夹**，子树内尚未在回收站的项目**一并进入回收站**）。**拖拽**：文件夹默认同级 **排序**；拖至其他文件夹行时碰撞优先识别 **`nest-*` 投放区**以 **归入**（`PATCH parent_id`）；**同级**若要改成「挂到另一文件夹下」而非换位，请按住 **Alt** 再松开放入目标行（否则会保持同级排序）。亦可拖回 **「文件夹」** 行将文件夹移至顶层。侧栏树内**不**再展开列出未归类项目，未归类只在 **「未分类」** 主区展示。在非 **`/library`** 路由下操作侧栏时，会 **自动跳转至 `/library`** 并同步选中态。）→ **主内容**（`/library` 时顶栏含 **后退 / 前进**、当前板块文案、**居中搜索**；正文区不再重复侧栏已选的视图大标题）→ **`react-resizable-panels` 右栏 `feature-drawer`**（与主区分隔条可拖拽调宽；**`Panel` 的百分比尺寸须使用字符串 `"68%"` 等**——v4 中裸 `number` 会被当作 **px**）。

**右栏行为（资料库、且非「标签管理 / 回收站」时显示）**：

- **无选中项目卡片**：按 `libraryScope` 展示 **板块摘要**（全部 / 未分类 / 回收站 / 文件夹总览 / 无标签：可折叠「基本信息」— 名称与文件数量）或 **文件夹信息**（名称、**描述**、**领域标签** 均可 `PATCH /api/folders/:id`；描述失焦保存；标签行悬停 **「+」** 打开双栏选择弹窗；可折叠元数据含子树项目数、创建时间；体积仍为占位）。
- **选中项目卡片（单击）**：右侧展示 **`ProjectLibraryPreviewPanel`**（AI 摘要、仓库简介、领域标签、部署方式、基本信息等）；**双击卡片**进入 **`/projects/:id`**。若右栏已收起，单击会通过 **`LibraryFeatureDrawerProvider.ensureFeatureDrawerOpen`** 先 **展开** 再显示预览。  
  - **进详情**：点击预览 **顶栏**（头像 + 项目名 + 仓库路径行，**整块**；其中 **`full_name` 链至 GitHub** 单独 `stopPropagation`，避免与进详情冲突）。  
  - **简介**：同一 **`textarea`** 默认可读；**双击**编辑，**失焦自动保存**（无变更不调 `PATCH`），**Escape** 放弃修改。  
  - **领域标签**：行末 **悬停** 显示 **「+」** 打开 **`ProjectDomainTagsDialog`**。  
  - **语言**：在 **「基本信息」** 中以纯文本展示；**GitHub topics** 不在预览重复列出（与 **`tags`** 领域标签一致，由同步与标签区承担）。  
  - **顶栏排版**：项目名旁为 **弱化** 的体验状态徽标；**Star / Fork** 与 **相对推送时间** 分行 **左右分布**（时间在右）。  
  - **不在预览内**：独立 **「打开 GitHub」** 按钮；项目移除请使用资料库卡片 **移入回收站**（或回收站内 **彻底删除**）。
- **顶栏按钮**（`/library`）：**居中搜索框**（项目名 / 仓库路径 / 简介）；GitHub 项目区 **网格 / 瀑布流** 切换（在展开右栏按钮左侧）；**收起 / 展开右栏**（`Panel` `collapsible`）；与中间分隔条配合使用。
- **左侧树伸收**：仅收起 **库侧栏**（`w-72`），**不**收起最左功能轨；分界 **pill** 悬停显示、偏上放置，详见 [`CHANGELOG_2026-05-17.md`](changelogs/CHANGELOG_2026-05-17.md)。
- **主内容 `<main>` 滚动条**：默认 **隐藏** 滚动条拇指，**滚动时** 短暂显示（CSS：`main-auto-scrollbar` + `index.css`；逻辑：`app-layout.tsx` **`AppLayoutMainShell`**）。

资料库表格与侧栏中的 **GitHub 项目** 链至 **`/projects/:id`**；**`/projects`**、**`/projects/board`** 为 Refine 列表与看板；**`/projects/mock-shelf`** 为 Phase 1 **模拟列表占位**（纯常量）。

**项目详情 `/projects/:id`**（资料库 **双击** 卡片进入）：**Steam 式**英雄区（GitHub 头像、项目名、体验状态、`owner/repo` 外链、Stars/Forks/推送时间、简介 **双击** 编辑、简介标题旁 **翻译**（Sparkles，译文覆盖 `description`）、领域标签行悬停 **「+」**）；进入页自动 **`POST /refresh-github?scope=stats`**。**Tab**：**README**（应用内 Markdown；**右键菜单**：显示原文 / 显示译文 / 编辑译文 / 重新翻译或重试失败段；**分段翻译** + Skeleton，完成后停留译文并提示）、**Release**（卡片列表，**标题** 打开 GitHub Release）、**笔记**（`notes` 字段，`PATCH` 保存）；Tab 栏右侧 **「更多信息」**（AI 摘要、部署方式、**许可证**、语言、文件夹与时间等）。顶栏 **返回资料库**。详见 [`changelogs/CHANGELOG_2026-05-17.md`](changelogs/CHANGELOG_2026-05-17.md)、[`changelogs/CHANGELOG_2026-05-24.md`](changelogs/CHANGELOG_2026-05-24.md)。

**翻译**：设置 → **翻译**（`/settings/translation`）配置目标语言。**简介**：资料库预览与项目详情中标题旁 **翻译** 按钮（传统机器翻译，无需 API Key；译文写入 `description` 并可编辑）。**README**：详情 Tab 内 **右键** 切换原文/译文、编辑 Markdown 译文、全文或 **仅重试失败段** 重新翻译；长文 **逐段** 请求后端（限流退避 + 失败保留原文）。`readme_translated` 存 SQLite，`PATCH` 可编辑。

## 实现进度提示

- **Phase 1**：SQLite、项目 CRUD、资料库树与 Refine 列表/看板等，见 [docs/PROJECT_PILOT_Implementation_Plan.md](docs/PROJECT_PILOT_Implementation_Plan.md)。
- **标签库（Phase 3 一部分）**：库侧栏 **标签管理**（自定义分类、拖拽）；**无标签** 筛选与 **`PATCH /projects/:id` `tag_ids`** 在项目详情闭环 **`usage_count`**。**GitHub `topics`** 在成功拉取仓库（或 `POST /projects` 请求体携带 `topics` 且未拉取到远端）时，会按名称同步为 **`tags` + `project_tags`**：新建标签默认 **未分类**；若 **`tags`** 中已有同名标签则 **保留其原有分类**；远端 topic 被移除时 **不会**自动删除本地 **`project_tags`**（避免误删手动关联）。看板 **按标签筛选** 仍为后续迭代。
- **资料库 GitHub 卡片**：列表卡片上 **`full_name` 外链** 仅 **文本宽度** 可点（避免整行误触）；卡片上 **领域标签** 与 **`/library`** 右栏预览的 **topics / 语言** 展示策略见上文 **右栏行为** 与 [`CHANGELOG_2026-05-14.md`](changelogs/CHANGELOG_2026-05-14.md)。**右键菜单**（Radix `ContextMenu`）：**复制链接**（`github_url`）、**打开详情页**、**移动到…**（未归类或任一文件夹，`PATCH /api/projects/:id`）、**移入回收站…**（`AlertDialog` 后 `DELETE /api/projects/:id` 软删）；**回收站**内同一组件为 **恢复**（`POST .../restore`）与 **彻底删除**（`DELETE .../permanent`）。仅在资料库主区带拖拽的卡片上提供移动与移入回收站；实现见 [`frontend/src/components/project/project-github-card.tsx`](frontend/src/components/project/project-github-card.tsx)。
