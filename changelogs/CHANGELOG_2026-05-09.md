# 更新日志（2026-05-09）

## 范围

- **文件夹徽标仅计项目数；拖拽归类 sonner 提示**（见 §9）。
- **`/settings` 独立布局**：进入设置后不再使用资料库三栏壳层，改为 **专用设置壳**（最左功能区窄条 + **设置分类侧栏** + **右侧内容区**），交互形态对齐语雀「设置」独占中间区域的习惯。
- **路由与子页**：`/settings` 与 `/library`、项目路由并列；拆出 **通用设置**、**GitHub**（占位）两段二级路由。
- **资料库侧栏 bilifish 式分区**：`LibraryScope` 导航、五项快捷入口与主区分支（见下文 §3）。
- **侧栏搜索置顶 / 全部扁平列表 / 去掉侧栏未归类区**：见下文 §4。
- **`folders_all`、文件夹钻取主区（子文件夹卡片 + 项目表 +「显示子文件夹内项目」）与 `projectsInFolderSubtree`**：见下文 §5。
- **根目录 [`README.md`](../README.md) 资料库段落重写（表格 + 与实现对齐）**：见下文 §6。

---

## 代码变更

### 1) `SettingsLayout` 与路由拆分

- **新建**：[`frontend/src/components/layout/settings-layout.tsx`](../frontend/src/components/layout/settings-layout.tsx)  
  - 全屏 **`h-svh`**：**`FunctionRail`** + 左侧 **`~14rem`** 导航（**返回资料库**、`NavLink` **通用设置** `/settings`、`NavLink` **GitHub** `/settings/github`）+ 右侧 **`main` + `<Outlet />`**（内容区 `max-w-4xl` 留白）。  
  - **不包含** [`LibrarySidebar`](../frontend/src/components/layout/library-sidebar.tsx)、**不包含** [`AppLayout`](../frontend/src/components/layout/app-layout.tsx) 内 **`react-resizable-panels` 右侧抽屉**。
- **新建**：[`frontend/src/pages/settings/general.tsx`](../frontend/src/pages/settings/general.tsx) — **通用设置**占位文案（后续 Token、同步等）。  
- **新建**：[`frontend/src/pages/settings/github.tsx`](../frontend/src/pages/settings/github.tsx) — **GitHub 集成**占位。  
- **删除**：[`frontend/src/pages/settings/index.tsx`](../frontend/src/pages/settings/index.tsx) — 原嵌入 `AppLayout` 的单页设置已移除。  
- **修改**：[`frontend/src/App.tsx`](../frontend/src/App.tsx) — `/settings` 从 `AppLayout` 子路由移出，挂载为：  
  `<Route path="/settings" element={<SettingsLayout />}>` + `index` / `github` 子路由。

### 2) 功能区窄条与设置入口

- **修改**：[`frontend/src/components/layout/function-rail.tsx`](../frontend/src/components/layout/function-rail.tsx) — 底部 **⋯** 菜单「设置」链至 `/settings`；**当前路由以 `/settings` 为前缀时**，⋯ 按钮保持 **active**（`pathname.startsWith("/settings")`）。

### 3) 资料库侧栏 bilifish 式分区与 `libraryScope`

- **范围**：用 `LibraryScope` 表达「全部 / 未分类 / 无标签 / 标签管理 / 回收站 / 某文件夹」；侧栏上半为五项快捷入口（后三项与回收站主区仅占位文案），下半保留文件夹标题行、搜索与 `LibraryFolderTree`；`GET /api/library/tree` 聚合数用于「全部 / 未分类」行尾数量。
- **影响文件**（主要）：
  - [`frontend/src/context/library-selection.tsx`](../frontend/src/context/library-selection.tsx)
  - [`frontend/src/components/layout/library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx)
  - [`frontend/src/components/layout/library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx)
  - [`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx)
  - [`frontend/src/lib/library-tree.ts`](../frontend/src/lib/library-tree.ts)
  - [`frontend/src/types/library-scope.ts`](../frontend/src/types/library-scope.ts)（`LibraryScope` / `DEFAULT_LIBRARY_SCOPE`，避免 context 文件触发 react-refresh 规则）
  - [`README.md`](../README.md)（侧栏一句说明）
- **验证**：`npm run build`、`npm run lint`（`frontend/`）。

### 4) 资料库侧栏布局、「全部」扁平化、去掉侧栏未归类区

- **范围**：搜索框移至资料库标题下（先于快捷入口）；弱化输入框聚焦样式；移除树内「根目录」行与底部「未归类项目」列表；「文件夹」标题行外包 **`FolderNestDropBar`** 承担原 **`nest-root`** 投放；**「全部」** 主区 **`flattenAllProjects`** 扁平列出全部项目，不再展示根级文件夹卡片；新建文件夹父级选项文案改为「顶层（无父级）」。
- **影响文件**（主要）：[`frontend/src/components/layout/library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx)、[`frontend/src/components/layout/library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx)、[`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx)、[`frontend/src/lib/library-tree.ts`](../frontend/src/lib/library-tree.ts)、[`README.md`](../README.md)。
- **验证**：`npm run build`、`npm run lint`（`frontend/`）。

### 5) `folders_all`、文件夹视图主区与 `projectsInFolderSubtree`

- **范围**：
  - **`LibraryScope`** 增加 **`folders_all`**：侧栏 **「文件夹」** 标题行左侧文案可点进入该态；主区上半为库 **根下一层** 文件夹卡片网格，下半为 **项目** 表（[`projectsInFolderTreeOnly`](../frontend/src/lib/library-tree.ts)，不含未归类）。
  - **树中选中文件夹**（`kind === "folder"`）：主区 **无顶栏文件夹名**；**子文件夹 (n)** 区块仅展示 **下一级**子文件夹卡片；其下 **项目 (m)** 表保留，并增加 **「显示子文件夹内项目」** 复选框（默认勾选）：勾选时用 **[`projectsInFolderSubtree`](../frontend/src/lib/library-tree.ts)** 汇总当前节点整棵子树内项目，取消则仅用 **`node.projects`**（直接归属）。
  - 切换所选文件夹时复选框重置为勾选。
- **影响文件**（主要）：
  - [`frontend/src/types/library-scope.ts`](../frontend/src/types/library-scope.ts)
  - [`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx)
  - [`frontend/src/lib/library-tree.ts`](../frontend/src/lib/library-tree.ts)
  - [`frontend/src/components/layout/library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx)（可点击「文件夹」、`selectPresetScope({ kind: "folders_all" })`）
- **验证**：`npm run build`、`npm run lint`（`frontend/`）。

### 6) 根目录 README：资料库 `/library` 说明重写

- **范围**：用 **表格**归纳侧栏各入口 / 状态与主区表现（全部 / 未分类 / `folders_all` / `folder` / 占位）；正文重写 **语雀式三栏**、侧栏结构（搜索置顶、可点「文件夹」、**`nest-root`** 投放、树内不列未归类等），与当前前端一致；API 表述为 **`GET /api/library/tree`**（经 Vite 代理）。
- **影响文件**：[`README.md`](../README.md)。
- **验证**：文档审阅（无新增构建要求）。

### 7) GitHub 项目卡片（API 富集 + 资料库栅格）

- **后端**：[`Project`](../backend/app/models/project.py) 增加 **`topics`**、**`forks`**、**`github_pushed_at`**、**`github_release_tag`**；[`database.py`](../backend/app/core/database.py) SQLite 迁移；[`github_client.py`](../backend/app/services/github_client.py) **`GET /repos`**、**`GET .../releases/latest`**；[`github_parse.py`](../backend/app/services/github_parse.py)、[`github_enrich.py`](../backend/app/services/github_enrich.py)；创建项目后 **`try_enrich_project_from_github`**；**`POST /projects/{id}/refresh-github`**（失败 **424**）。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json) — `python scripts/export_openapi.py`。
- **前端**：[`project-github-card.tsx`](../frontend/src/components/project/project-github-card.tsx)、[`github-relative-time.ts`](../frontend/src/lib/github-relative-time.ts)；[`library/home.tsx`](../frontend/src/pages/library/home.tsx) 项目区改为 **卡片栅格**；详情页 [**同步 GitHub**](../frontend/src/pages/projects/detail.tsx)。
- **验证**：`npm run build`；`python -m ruff check app`。

---

### 8) 资料库拖拽：幽灵左上角跟光标 + 指针瞄准文件夹高亮

- **幽灵位置**：[`library-dnd-modifiers.ts`](../frontend/src/components/layout/library-dnd-modifiers.ts) — **`snapOverlayTopLeftToCursor`** 作为 **`DragOverlay`** 的 modifier，使预览条左上角对齐指针；[`library-dnd-context.tsx`](../frontend/src/components/layout/library-dnd-context.tsx) 启用。
- **投放判定**：同文件 **`libraryCollisionDetection`** — 拖动 **`project-*`** 时 **仅 `pointerWithin`**（光标落在投放矩形内才收纳）；文件夹排序仍用 **`closestCorners`**。
- **高亮**：[`library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx) — **`FolderNestDropBar`** 与 **`nest-*` 行** 在 **`isOver`** 时叠 **`absolute` + `bg-primary/15`～`/18`**（无 ring），叠在原有 **`bg-accent` 选中态之上**，保留底色辨识度。
- **验证**：`npm run build`、`npm run lint`。

---

### 9) 文件夹徽标仅项目数 + 归类成功 Sonner 提示

- **统计**：[`library-tree.ts`](../frontend/src/lib/library-tree.ts) — 侧栏 / 主区文件夹徽标使用 **`countProjectsInSubtree`**（**本文件夹直接项目数 + 所有子文件夹内项目数**，递归合计）。
- **提示**：依赖 **`sonner`**；[`App.tsx`](../frontend/src/App.tsx) 挂载 **`<Toaster />`**（无关闭按钮，默认停留约 **2.2s**）；[`library-dnd-context.tsx`](../frontend/src/components/layout/library-dnd-context.tsx) 在 **`PATCH /projects/:id`** 归类成功后 **`toast.success`**，文案 **「已归入「…」」**（根目录取消归类为 **「未归类」**）。
- **验证**：`npm run build`、`npm run lint`。

---

## 验证记录

- `npm run build`（`frontend`）
- `npm run lint`（`frontend`，含 §5 相关迭代）
- `python -m ruff check app`、`python scripts/export_openapi.py`（§7）

---

## 后续建议

- 在 **GitHub** 子页接入 PAT、拉取 Description / Stars 等后端能力与表单；通用页可增加主题、代理等与 GitHub 无关的全局项。
- 若需在变更日志中追溯「左下角 ⋯ 入口」初版，见 [`CHANGELOG_2026-05-08.md`](./CHANGELOG_2026-05-08.md) §13。
