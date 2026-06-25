# Project Pilot

本地 GitHub 项目探索管理工具：**浏览器 Web UI**（`frontend/`：React + Vite + Refine + shadcn/ui）+ **FastAPI 后端** + **SQLite**。**不使用 Tkinter 等原生桌面 GUI**；主交互即本地打开的网页。

详细产品设计见 [docs/PROJECT_PILOT_v0.1_设计文档.md](docs/PROJECT_PILOT_v0.1_设计文档.md) 与 [docs/PROJECT_PILOT_Implementation_Plan.md](docs/PROJECT_PILOT_Implementation_Plan.md)。**桌面化（Tauri + sidecar）** 见 [docs/PROJECT_PILOT_Desktop_Engineering_Guide.md](docs/PROJECT_PILOT_Desktop_Engineering_Guide.md)；**发版与 GitHub Releases** 见 [docs/PROJECT_PILOT_Release_Checklist.md](docs/PROJECT_PILOT_Release_Checklist.md)。协作约定见 [AGENTS.md](AGENTS.md)、[WORKSPACE.md](WORKSPACE.md)。**每次开发请更新** [changelogs/](changelogs/README.md) 中当日的 `CHANGELOG_YYYY-MM-DD.md`（同一天多次变更写在同一文件）。**Changelog 正文排版**须遵守 [changelogs/README.md](changelogs/README.md) 中的 **「正文格式（固定写法）」**，与 [`CHANGELOG_2026-05-10.md`](changelogs/CHANGELOG_2026-05-10.md)、[`CHANGELOG_2026-05-12.md`](changelogs/CHANGELOG_2026-05-12.md)、[`CHANGELOG_2026-05-14.md`](changelogs/CHANGELOG_2026-05-14.md) 等往期一致。

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
- REST API 前缀：`/api`（例如 `GET /api/projects`）；OpenAPI：`http://127.0.0.1:8000/docs`
- **项目库**：`GET/POST /api/project-libraries`；`GET/PATCH/DELETE /api/project-libraries/{id}`（`is_pinned`、`sort_order`）；删除库会 **级联** 库内文件夹、标签与项目。
- **资料库（须指定项目库 id）**：`GET /api/project-libraries/{id}/library/tree`；`GET/POST/PATCH/DELETE .../folders`；`GET/POST/PATCH/DELETE .../tags` 与 `.../tag-categories`；`GET/POST .../projects`（库内列表含 `missing_tags`、`deleted_only`）。**文件夹子树包**：`GET .../folders/{folder_id}/export`（下载 `.ppb.json`）；`POST .../import/folder-bundle`（`target_parent_folder_id` 为 `null` 表示库根；`skip_duplicate_github_url` 默认 `false`）。全局 **`GET/POST/PATCH/DELETE /api/projects`** 仍用于详情、看板、翻译等（`ProjectRead.project_library_id` 标识归属）。
- **发现中心**：`GET /api/discovery/trending`（`range`、`page`、`per_page`、`fresh`；响应含 `baseline_at` 与条目 `delta` 上一期对比）、`/hot-release`、`/most-popular`、`/topic`；`POST /api/discovery/repos/enrich`（趋势 RSS 列表补全 Star/语言/topics，**仍走后端 GitHub Token**）；`GET /api/discovery/repos/{owner}/{repo}/readme`、`/releases`（发现预览，不写项目库）；`POST /api/translation/translate-text`（纯文本临时翻译，不落库）。**Web**：列表顶栏「翻译简介」批量翻译当前页仓库 description（目标语言跟随翻译设置，会话级不落库；卡片骨架屏逐条替换）。RSS 与 Search 分页结果缓存于 SQLite（趋势 / 最受欢迎 TTL **1 小时**；热门发布 / 主题探索 **10 分钟**；见 `discovery_cache` / `discovery_feed_snapshot`）。
- **标签与分类（库内）**：scoped 路径同上；`category_id` 可空表示未分类；列表含 `usage_count` 与可选 `category_name`。**项目（全局）**：`GET /projects` 默认不含回收站；`deleted_only=true` 仅回收站；`DELETE /projects/:id` 为软删；`POST /projects/:id/restore` 恢复；`DELETE /projects/:id/permanent` 彻底删除；`POST /projects/:id/translate` 机器翻译简介/README（译文存 DB）。**README 分段**：`GET /projects/:id/readme/blocks`、`POST /projects/:id/translate/readme-block`（配合 Web 逐段翻译）。**README 封面外链图**：`GET /projects/readme-image-proxy?url=`（内容工厂截图前代理拉取，避免浏览器 canvas 跨域）。
- **GitHub 设置**：`GET/PUT /api/settings/github`（`has_token`、`token_preview`）；`POST /api/settings/github/test`（可选 body `{ token }` 先验后存）；`GET /api/settings/github/profile`（`login`、`name`、`avatar_url`、`html_url`）。Token 存 SQLite；可选环境变量 **`GITHUB_TOKEN`**（与库内 PAT 并存时以数据库为准）。
- **翻译设置**：`GET/PUT /settings/translation`、 `POST /settings/translation/test`（免费 Google 通道，目标语言可配置）。**AI 配置**：`GET/PUT /api/settings/ai/config`（多供应商 + 场景映射）、`POST /api/settings/ai/test`；遗留 `GET/PUT /api/settings/ai` 同步默认供应商（默认 **MiniMax 国内**）。**标签 AI 分类（库内）**：`POST .../tags/suggest-categories`（读 `tag_classification` 场景）、`POST .../tags/apply-category-suggestions`（确认后写入）。路线见 [`docs/PROJECT_PILOT_AI_Agent_接入分析.md`](docs/PROJECT_PILOT_AI_Agent_接入分析.md)。契约见 [`contracts/openapi.json`](contracts/openapi.json)。

### 契约文件（变更 API 时必更新）

仓库内 [`contracts/openapi.json`](contracts/openapi.json) 需与当前后端一致。**凡修改会影响 OpenAPI 的后端代码**，在提交前于仓库根目录执行：

```powershell
python scripts/export_openapi.py
```

并将生成的 `contracts/openapi.json` 一并提交。详见 [`contracts/README.md`](contracts/README.md)。

### 内容工厂 README 封面

内容工厂草稿封面区模板 **「README 首屏」**（`native-readme`）：在 **Web UI 浏览器内**复用资料库 **README 标签**同款 `MarkdownContent` 排版，离屏裁切后截图上传 PNG。**无需**安装 Chromium / Playwright。

| 项 | 说明 |
|----|------|
| **输出尺寸** | 默认 **1242×1660**（3:4）；预览区右下角可切换 **比例与像素**（方图 1080×1080、竖屏 9:16 等），切换后自动重新生成 |
| **源画布** | 宽 **640px**（与项目详情 README 正文列一致），高按 3:4 裁切；左右内边距各 **40px**（放大后约 **78px**） |
| **裁切策略** | 画布 `overflow: hidden` 从顶部裁切；**不**在 `##` 处删 markdown；仅行数/字符上限防 DOM 过大 |
| **样式来源** | 默认 `MarkdownContent`（与 `/projects/:id` README Tab 相同），非独立 CSS 主题 |
| **外链图片** | 截图前经 `GET /api/projects/readme-image-proxy?url=` 拉取并内联为 data URL，避免 canvas 跨域 |
| **缓存** | 草稿 `body_json.cover_readme_sha` 与 GitHub README `sha` 一致且已有 `cover_image_path` 时跳过重复截图 |
| **落盘** | `backend/data/content_factory_assets/`（环境变量 `CONTENT_FACTORY_ASSETS_DIR` 可覆盖） |

**API**（前缀 `/api/project-libraries/{library_id}/content-factory`）：

- `POST .../drafts/{draft_id}/upload-cover` — multipart 上传 PNG（字段 `file`，可选 `readme_sha`、`force`）
- `GET .../drafts/{draft_id}/cover` — 读取已生成封面

**前端主路径**：[`frontend/src/pages/content-factory/project-promotion.tsx`](frontend/src/pages/content-factory/project-promotion.tsx) → [`ReadmeCoverCaptureHost`](frontend/src/components/content-factory/readme-cover-capture-host.tsx) → [`readme-cover-capture.ts`](frontend/src/lib/readme-cover-capture.ts)（`html-to-image` 按源画布尺寸截图后等比放大至 1242×1660）。

**使用建议**：生成前可先打开该项目的 **README 标签**（显示原文），再回内容工厂点「重新生成」——若页面上存在对应 `data-readme-capture-root`，会优先克隆标签页 DOM，与所见更一致。

**手工验证**：内容工厂草稿 → 封面区选「README 首屏」→ 等待截图 → 预览区固定高度 `object-contain` 查看；README 未变时再次生成应命中缓存；点「重新生成」带 `force` 强制覆盖。

### 内容工厂 AI 封面与风格库

除 **README 首屏**外，封面区支持 **5 个内置 AI 风格** + **资料库级自定义风格**（AI 生成 / 手工 / Fork）。需在 **设置 → AI** 配置：

| 场景 | 用途 |
|------|------|
| `recommend_image` | 项目封面出图、风格 **示例图** |
| `recommend_cover_style` | **参考图** vision **解析风格定义**（prompt 包；须 vision 模型，如 MiniMax-M3） |

**风格库 UI**：内容工厂封面模板行悬停 **「+」** → 弹窗 **「风格库」**（**全库共享**；双击双栏详情，含灵感参考图；prompt 区 **模板 + 胶囊前缀/负向词**）。模板 chips 行支持滚轮横滚。AI 新增 → 上传参考图 → 悬浮 **「解析风格」** → **「保存风格」**。API 前缀同上，`GET/POST .../cover-styles` 等见 [`contracts/openapi.json`](contracts/openapi.json)。

**说明**：切换 AI 风格 **不自动生图**；用户点 **「生成封面」** 后落盘。详见 [`docs/PROJECT_PILOT_内容工厂_AI封面与视觉导演融合方案.md`](docs/PROJECT_PILOT_内容工厂_AI封面与视觉导演融合方案.md) §8.4 与 [`changelogs/CHANGELOG_2026-06-22.md`](changelogs/CHANGELOG_2026-06-22.md)。

## 前端（Web UI）

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

- 开发地址默认 `http://localhost:5173`
- Vite 将 `/api` **透传**到 `http://127.0.0.1:8000/api`（与桌面生产态路径一致）

## 首次进入与 GitHub Token

未配置可用 GitHub Token 时，**全屏欢迎页**（`WelcomeGate`）拦截全部路由：

| 条件 | 行为 |
|------|------|
| `GET /api/settings/github` → `has_token=false` | 展示欢迎页：左侧 **Carousel** 产品介绍，右侧 **PAT** 表单 |
| 用户提交有效 PAT | 先 `POST /api/settings/github/test`（带 token）→ `PUT` 保存 → 进入主界面 |
| 环境变量 **`GITHUB_TOKEN`** 已生效 | **跳过**欢迎页，直接进入主界面 |

进入主界面后：

- **根路径** `/`、旧 `/library` → 进入 **`localStorage` 中上次打开的项目库**（`projectPilot.lastProjectLibraryId`，后端校验库仍存在）；无记录或库已删 → **`/libraries`** 项目库目录页。
- **GitHub Token 管理**：左下角 **头像 Popover** →「GitHub Token」打开**独立弹窗**（不再在设置页内）；发现侧栏与各错误态「配置 Token」同此弹窗。旧链接 `/settings#github` 会自动唤起弹窗。
- **设置**（`/settings`）：语雀式单页锚点导航，分区 **通用**、**翻译**；**AI** 为设置内独立页 **`/settings/ai`**（左侧设置导航进入）。
- **账户菜单**（功能轨最下 **头像**）：GitHub 用户信息、GitHub Token、设置；footer **主题循环钮** + **退出连接**（清除库内 PAT；若 Token 仅来自环境变量则显示说明）。

详见 [`changelogs/CHANGELOG_2026-05-31.md`](changelogs/CHANGELOG_2026-05-31.md) §15–§20。

## 桌面（Tauri + sidecar，Windows）

**日常开发**仍推荐浏览器 + 双终端；**Tauri 窗口**用于验证桌面壳。

### 环境

- 除上文外，需 **Rust stable**（[rustup](https://rustup.rs/)）、**WebView2**（Win10/11 通常已带）
- 桌面打包额外依赖：`pip install -e "backend/.[dev,desktop]"`

### 桌面开发（Tauri 窗口 + Vite）

终端 1 — 后端（API 已挂 `/api` 前缀）：

```powershell
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

终端 2 — Tauri 壳（**在仓库根目录**执行，内嵌 `http://localhost:5173`）：

```powershell
npx --prefix frontend tauri dev --config src-tauri/tauri.conf.json
```

### 桌面生产构建

```powershell
# 仓库根目录
.\scripts\build-sidecar.ps1          # 首次或后端变更后
.\scripts\build-desktop.ps1          # sidecar + Tauri 安装包
```

产物：`src-tauri\target\release\bundle\nsis\Project Pilot_0.1.2_x64-setup.exe`（当前为 NSIS；MSI 需 WiX 且首次会下载工具链）。

用户数据目录：`%LOCALAPPDATA%\ProjectPilot\`（SQLite 等）。

桌面版 **外链**（GitHub、文档等）由 WebView 导航拦截后在系统浏览器打开；若点击无反应见 [docs/桌面安装包打包经验.md §5.8](docs/桌面安装包打包经验.md#58-桌面版外链点击无反应)。

详见 [docs/PROJECT_PILOT_Desktop_Engineering_Guide.md](docs/PROJECT_PILOT_Desktop_Engineering_Guide.md)；**首次打包踩坑与排障**见 [docs/桌面安装包打包经验.md](docs/桌面安装包打包经验.md)。

## 项目库与资料库（两层结构）

| 层级 | 路由 | 说明 |
|------|------|------|
| **项目库** | `/libraries` | 项目库列表首页：搜索、新建、置顶「常用」、列表/网格；**整行/整卡点击进入**；右键 **重命名 / 删除**。 |
| **资料库** | `/libraries/:id` | 原语雀式资料库（文件夹树、项目卡片、标签管理、回收站等）；数据 scoped 到该 `id`。 |

- 根路径 `/` 与旧 `/library` 会重定向：若 **`localStorage`** 中 **`projectPilot.lastProjectLibraryId`** 对应项目库仍存在 → **`/libraries/:id`**；否则 → **`/libraries`** 目录页（见 [`frontend/src/lib/app-home.ts`](frontend/src/lib/app-home.ts)）。
- 功能区（最左轨）「项目库」图标指向 **`/libraries`**（目录页，便于切换库）；最下方 **头像** 为账户与 Token 入口。
- 资料库侧栏顶栏：**ChevronLeft** 返回项目库列表；**项目库名称** 下拉可切换库。

**默认打开 `/libraries`**，进入某一库后为 **`/libraries/:id`**；树数据来自 `GET /api/project-libraries/{id}/library/tree`（与侧栏 **同一 `libraryScope` 导航状态**）。主区按入口分支大致如下：

| 侧栏 / 状态 | 主区表现 |
|-------------|----------|
| **全部** | 库内全部 GitHub 项目一张扁平表（含未归类与各文件夹下项目）。 |
| **未分类** | 仅 `folder_id` 为空的未归类项目表。 |
| **文件夹**（标题行入口，`folders_all`） | 上半：**根下一层**文件夹卡片网格（大图标 + 名称 + 项数）；下半：**项目**表（**含库根未归类** + 树内已归入文件夹的项目；与侧栏「未分类」列表相同条目，但在根目录视图即可看到）。 |
| **树中选中某一文件夹**（`folder`） | **主 Panel 顶栏**显示当前板块名并支持 **后退 / 前进**（资料库内导航栈）；主区正文不再重复大号标题。上半：**子文件夹 (n)**——仅 **下一级**子文件夹卡片；下半：**项目 (m)** 表，并提供 **「显示子文件夹内项目」** 复选框：勾选时列出当前文件夹 **整棵子树** 内项目，取消则仅 **直接挂在本文件夹下** 的项目。 |
| **标签管理**（`tag_manage`） | **所有标签**（按首字符分组 + 使用次数）、**标签分类**（自建分类 + **未分类** 首栏，**拖拽**标签到各栏归类；`DragOverlay` 避免裁切，碰撞仅认分类栏，**`PATCH` 乐观更新**；**无**浮层松手退回动画）。新建/重命名/删除分类。`GET .../tags`、`GET .../tag-categories`（当前库 scoped）。 |
| **无标签**（`no_tags`） | 主区列出 **`GET .../projects?missing_tags=true`** 的项目（无任何 `project_tags`）；侧栏显示数量。保存项目的 **`PATCH /api/projects/:id`（`tag_ids`）** 或详情编辑标签后，`usage_count` 与列表同步刷新。 |
| **回收站**（`trash`） | **`GET .../projects?deleted_only=true`** 列出已软删项目；卡片可 **恢复**（`POST /api/projects/:id/restore`）或 **彻底删除**（`DELETE /api/projects/:id/permanent`）。侧栏显示回收站数量。 |

资料库主区（除 **标签管理**、**回收站** 外）：**全文搜索**在 **`/libraries/:id` 顶栏**（与网格/瀑布流、收起右栏同级，居中弱样式输入框）；子文件夹与项目列表上方为 **筛选** 一行（**标签** 双栏 Popover + **任意符合(或)** / **全部符合(且)**；**文件夹** 多选——`all` / `folders_all` 为根层文件夹、进入某文件夹时仅**直接子文件夹**；**未分类**、**无标签** 下文件夹筛选不可用；标签列表仅含当前 scope 内项目已用标签；**时间** 占位）。筛选在已加载列表上 **客户端** 执行，项目计数与卡片网格随筛选结果更新。

主界面整体为 **语雀式三栏 + 可调整右栏**（仅在 **`/libraries/:id`**）：**最左窄条功能区**（项目库、发现、看板；**底部头像** 为账户 / Token / 主题 / 设置入口，**始终保留**）→ **资料库侧栏**（默认 `w-72`，可 **收起为 0**；与主区分界处有 **pill 伸收**：默认隐藏，鼠标移入分界悬停区时在 **约 1/4 高度** 显示，移开或点击后隐藏；状态写入 **`localStorage`**（`projectPilot.librarySidebarOpen`）；快捷键 **`Ctrl+Alt+,`**（输入框内不触发）。侧栏最上为 **搜索文件夹** 输入框，其下为「全部 / 未分类 / …」快捷行，再下为可点击的 **「文件夹」** 文案 + 绿色 **新建**，整行在 DnD 中作为 **`nest-root` 投放区**：项目拖入则 **`folder_id: null`**，子文件夹拖入则 **`parent_id: null`**，悬停为浅色底高亮；其下为可滚动 **文件夹树**，节点带数量徽标，**右键** 文件夹行可「**添加 GitHub 项目** / 新建子文件夹 / **导出子树…** / **导入包…** / 重命名 / 删除」；**右键「文件夹」行**（`nest-root`）可 **导入包到库根…**；亦可将 **`.json` / `.ppb.json`** **拖入** `nest-root` 或某文件夹行以导入（打开确认对话框，可选 **已存在相同 GitHub 链接时跳过**）。便携包为单文件 JSON（`format_version: 1`），导出整棵子树（嵌套文件夹 + 未软删项目 + 标签名），导入时包根作为落点的**新子节点**（与绿色 **新建** 下拉中的「添加 GitHub 项目」共用同一对话框：库根行新建 → **未归类**；文件夹右键 → **归入该文件夹**；输入 URL 后自动拉取 GitHub Description 填入简介，网络或 Token 异常时有提示；**删除**会移除该文件夹及其**所有子文件夹**，子树内尚未在回收站的项目**一并进入回收站**）。**拖拽**：文件夹默认同级 **排序**；拖至其他文件夹行时碰撞优先识别 **`nest-*` 投放区**以 **归入**（`PATCH parent_id`）；**同级**若要改成「挂到另一文件夹下」而非换位，请按住 **Alt** 再松开放入目标行（否则会保持同级排序）。亦可拖回 **「文件夹」** 行将文件夹移至顶层。侧栏树内**不**再展开列出未归类项目；未归类项目在 **「文件夹」** 根视图与 **「全部」** 中展示，**「未分类」** 为仅看未归类的快捷入口。在非 **`/libraries/:id`** 路由下操作侧栏时，会 **自动跳转至当前库** 并同步选中态。）→ **主内容**（资料库页顶栏含 **后退 / 前进**、当前板块文案、**居中搜索**；正文区不再重复侧栏已选的视图大标题）→ **`react-resizable-panels` 右栏 `feature-drawer`**（与主区分隔条可拖拽调宽；**`Panel` 的百分比尺寸须使用字符串 `"68%"` 等**——v4 中裸 `number` 会被当作 **px**）。

**右栏行为（资料库、且非「标签管理 / 回收站」时显示）**：

- **无选中项目卡片**：按 `libraryScope` 展示 **板块摘要**（全部 / 未分类 / 回收站 / 文件夹总览 / 无标签：可折叠「基本信息」— 名称与文件数量）或 **文件夹信息**（名称、**描述**、**领域标签** 均可 `PATCH /api/folders/:id`；描述失焦保存；标签行悬停 **「+」** 打开双栏选择弹窗；可折叠元数据含子树项目数、创建时间；体积仍为占位）。
- **选中项目卡片（单击）**：右侧展示 **`ProjectLibraryPreviewPanel`**（AI 摘要、仓库简介、领域标签、部署方式、基本信息等）；**双击卡片**进入 **`/projects/:id`**。若右栏已收起，单击会通过 **`LibraryFeatureDrawerProvider.ensureFeatureDrawerOpen`** 先 **展开** 再显示预览。  
  - **进详情**：点击预览 **顶栏**（头像 + 项目名 + 仓库路径行，**整块**；其中 **`full_name` 链至 GitHub** 单独 `stopPropagation`，避免与进详情冲突）。  
  - **简介**：同一 **`textarea`** 默认可读；**双击**编辑，**失焦自动保存**（无变更不调 `PATCH`），**Escape** 放弃修改。  
  - **领域标签**：行末 **悬停** 显示 **「+」** 打开 **`ProjectDomainTagsDialog`**。  
  - **语言**：在 **「基本信息」** 中以纯文本展示；**GitHub topics** 不在预览重复列出（与 **`tags`** 领域标签一致，由同步与标签区承担）。  
  - **顶栏排版**：项目名旁为 **弱化** 的体验状态徽标；**Star / Fork** 与 **相对推送时间** 分行 **左右分布**（时间在右）。  
  - **不在预览内**：独立 **「打开 GitHub」** 按钮；项目移除请使用资料库卡片 **移入回收站**（或回收站内 **彻底删除**）。
- **顶栏按钮**（`/libraries/:id`）：**居中搜索框**（项目名 / 仓库路径 / 简介）；GitHub 项目区 **网格 / 瀑布流** 切换（在展开右栏按钮左侧）；**收起 / 展开右栏**（`Panel` `collapsible`）；与中间分隔条配合使用。
- **左侧树伸收**：仅收起 **库侧栏**（`w-72`），**不**收起最左功能轨；分界 **pill** 悬停显示、偏上放置，详见 [`CHANGELOG_2026-05-17.md`](changelogs/CHANGELOG_2026-05-17.md)。
- **主内容 `<main>` 滚动条**：默认 **隐藏** 滚动条拇指，**滚动时** 短暂显示（CSS：`main-auto-scrollbar` + `index.css`；逻辑：`app-layout.tsx` **`AppLayoutMainShell`**）。

资料库表格与侧栏中的 **GitHub 项目** 链至 **`/projects/:id`**；功能区 **看板** 为 **`/projects/board`**（`/projects` 重定向至看板）。

## 发现中心（`/discovery`）

功能区（最左轨）**发现**图标进入 **`/discovery`**（默认重定向 **`/discovery/trending`**）。布局与资料库类似：**最左功能轨** → **发现侧栏**（`w-72`，可 pill 伸收；快捷键 **`Ctrl+Alt+,`**）→ **主内容**。侧栏底部 **GitHub Token 设置** 打开全局 Token 弹窗。

| 频道 | 路由 | 数据来源 | 主区工具条 |
|------|------|----------|------------|
| **趋势** | `/discovery/trending` | GitHubTrendingRSS + 后端 enrich | 日/周/月时间范围 |
| **热门发布** | `/discovery/hot-release` | GitHub Search API | — |
| **最受欢迎** | `/discovery/most-popular` | GitHub Search API | — |
| **主题探索** | `/discovery/topic` | GitHub Search API | Topic 搜索框（GitHub Topic / **中文** / **标签分类名**） |

- 旧 **`/discovery/search`** 重定向至 **`/discovery/topic`**（`?q=` → `?topic=`）。
- **顶栏**（与资料库同高 **`h-12`**）：当前频道名、结果数（右对齐）、趋势 enrich 提示、**刷新**（进行中图标旋转）。
- **列表**：卡片展示 rank / 仓库 / Star·Fork·语言 / **加入资料库**；**趋势**在存在上一期快照时标注 Star/Fork/排名相对变化及「新上榜」。**单击卡片**进入详情——**已收录** → `/projects/:id`（可编辑）；**未收录** → **`/discovery/r/:owner/:repo`** 只读预览（README / Release / 笔记占位 + **加入资料库**）；右侧 GitHub / Zread / 加入资料库按钮不触发卡片导航。趋势 enrich 后简介优先 **GitHub 短 description**（非 RSS 长文）；预览页简介默认两行可展开，Sparkles **临时翻译**（**不写入**项目库）。趋势频道 RSS 先返回，**`POST /api/discovery/repos/enrich`** 后台补全 Star 与语言（**不经前端直连 GitHub**）；滚到底 **自动加载下一页**（列表区独立滚动，发现页禁用全局滚动）。
- **刷新策略**：手动刷新（顶栏、侧栏「刷新全部」、再次点击当前频道）带 **`fresh=true`** 绕过 SQLite 缓存；**趋势 / 最受欢迎** 后端与前端 passive 冷却均为 **1 小时**（热门发布 / 主题探索 Search 缓存仍为 10 分钟）。侧栏 **趋势**、**热门发布** 显示「上次刷新」；**主题探索**、**最受欢迎** 不显示。
- **列表交互**：预览叠层 keep-alive 保留滚动位置；列表右下角 **回到顶部** 按钮（滚动超过约 320px 出现）。
- **API**（前缀 `/api/discovery`）：`GET /trending`、`/hot-release`、`/most-popular`、`/topic`（均支持 `page`、`per_page`、`fresh`；**topic** 响应含 `search_meta`）；`POST /repos/enrich`；`GET /repos/{owner}/{repo}/readme`、`/releases`。契约见 [`contracts/openapi.json`](contracts/openapi.json)。

详见 [`changelogs/CHANGELOG_2026-05-30.md`](changelogs/CHANGELOG_2026-05-30.md)、[`changelogs/CHANGELOG_2026-05-31.md`](changelogs/CHANGELOG_2026-05-31.md)。

**项目详情 `/projects/:id`**（资料库 **双击** 卡片进入）：**Steam 式**英雄区（GitHub 头像、项目名、体验状态、`owner/repo` 外链、Stars/Forks/推送时间、简介 **双击** 编辑、简介标题旁 **翻译**（Sparkles，译文覆盖 `description`）、领域标签行悬停 **「+」**）；进入页自动 **`POST /refresh-github?scope=stats`**。**Tab**：**README**（应用内 Markdown；**同仓 `.md` 链接**在 Tab 内切换原文；**右侧目录**可展开/收起，点击跳转章节；**机器翻译**仍仅针对 **默认 README**；**右键菜单**：显示原文 / 显示译文 / 编辑译文 / 重新翻译或重试失败段；**分段翻译** + Skeleton）、**Release**（横向行列表：仓库头像 + 版本、Release 标题、**附件 Popover**（`N 个文件` / 单文件下载）、相对发布时间、GitHub 外链；说明以悬浮 **pill** 展开/收起）、**笔记**（`notes` 字段，`PATCH` 保存）；Tab 栏右侧 **「更多信息」**（AI 摘要、部署方式、**许可证**、语言、文件夹与时间等）。顶栏 **返回资料库**。详见 [`changelogs/CHANGELOG_2026-05-17.md`](changelogs/CHANGELOG_2026-05-17.md)、[`changelogs/CHANGELOG_2026-05-24.md`](changelogs/CHANGELOG_2026-05-24.md)。

**翻译**：设置 → **翻译**（`/settings#translation`）配置目标语言。**GitHub Token** 见上文 **首次进入** 与左下角账户菜单（独立弹窗，不在设置页）。**简介**：资料库预览与项目详情中标题旁 **翻译** 按钮（传统机器翻译，无需 API Key；译文写入 `description` 并可编辑）。**README**：详情 Tab 内 **右键** 切换原文/译文、编辑 Markdown 译文、全文或 **仅重试失败段** 重新翻译；长文 **逐段** 请求后端（限流退避 + 失败保留原文）。`readme_translated` 存 SQLite，`PATCH` 可编辑。按路径拉取原文：`GET /api/projects/:id/readme?path=`（库内相对路径或同仓 GitHub blob/raw 链接解析后传参）；非默认文件不提供译文切换。

## 实现进度提示

- **Phase 1**：SQLite、项目 CRUD、资料库树与 Refine 列表/看板等，见 [docs/PROJECT_PILOT_Implementation_Plan.md](docs/PROJECT_PILOT_Implementation_Plan.md)。
- **标签库（Phase 3 一部分）**：库侧栏 **标签管理**（自定义分类、拖拽）；**无标签** 筛选与 **`PATCH /projects/:id` `tag_ids`** 在项目详情闭环 **`usage_count`**。**GitHub `topics`** 在成功拉取仓库（或 `POST /projects` 请求体携带 `topics` 且未拉取到远端）时，会按名称同步为 **`tags` + `project_tags`**：新建标签默认 **未分类**；若 **`tags`** 中已有同名标签则 **保留其原有分类**；远端 topic 被移除时 **不会**自动删除本地 **`project_tags`**（避免误删手动关联）。看板 **按标签筛选** 仍为后续迭代。
- **项目库（2026-05-27）**：见 [`changelogs/CHANGELOG_2026-05-27.md`](changelogs/CHANGELOG_2026-05-27.md)。
- **发现中心（2026-05-30 / 2026-05-31）**：四频道探索、趋势 enrich、无限滚动、列表 keep-alive 与回到顶部、主题探索中英/分类扩展；见 [`changelogs/CHANGELOG_2026-05-30.md`](changelogs/CHANGELOG_2026-05-30.md)、[`changelogs/CHANGELOG_2026-05-31.md`](changelogs/CHANGELOG_2026-05-31.md)。
- **欢迎页与 onboarding（2026-05-31）**：PAT 硬门控、Carousel 介绍、账户菜单、Token 独立弹窗、主题循环钮、默认进入上次项目库；见 [`changelogs/CHANGELOG_2026-05-31.md`](changelogs/CHANGELOG_2026-05-31.md) §15–§20。
- **资料库 GitHub 卡片**：列表卡片上 **`full_name` 外链** 仅 **文本宽度** 可点（避免整行误触）；卡片上 **领域标签** 与资料库右栏预览的 **topics / 语言** 展示策略见上文 **右栏行为** 与 [`CHANGELOG_2026-05-14.md`](changelogs/CHANGELOG_2026-05-14.md)。**右键菜单**（Radix `ContextMenu`）：**复制链接**（`github_url`）、**打开详情页**、**移动到…**（未归类或任一文件夹，`PATCH /api/projects/:id`）、**移入回收站…**（`AlertDialog` 后 `DELETE /api/projects/:id` 软删）；**回收站**内同一组件为 **恢复**（`POST .../restore`）与 **彻底删除**（`DELETE .../permanent`）。仅在资料库主区带拖拽的卡片上提供移动与移入回收站；实现见 [`frontend/src/components/project/project-github-card.tsx`](frontend/src/components/project/project-github-card.tsx)。
