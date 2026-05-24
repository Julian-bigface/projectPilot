# 更新日志（2026-05-14）

## 范围

- **资料库（代码）**：右栏 **`ProjectLibraryPreviewPanel`** 顶栏整块进详情、简介双击失焦保存、领域标签悬停「+」、语言进基本信息等；主内容 **`<main>`** 滚动条默认隐藏、滚动时短暂显示；GitHub 卡片 **`full_name`** 外链 **`w-max`** 收窄可点区域；主区 **网格 / 瀑布流** 切换（`LibraryProjectsLayoutProvider` + `localStorage`、顶栏单按钮 + Tooltip、CSS `columns`）；**侧栏点文件夹 / 切换 `libraryScope`** 时清除项目预览以便右栏显示 **文件夹信息** 或 **板块摘要**；GitHub 卡片网格等高 vs 瀑布流随内容、标签多于 8 个时 **「…」** 等；**`ProjectGithubCard` 右键菜单**（复制 GitHub 链接、打开详情、移动到文件夹、**移入回收站** + **`AlertDialog`**）。
- **回收站（项目软删除）**：`projects.deleted_at`；`DELETE /api/projects/:id` 移入回收站；`GET /api/projects?deleted_only=true` 列表；`POST /api/projects/:id/restore`、`DELETE /api/projects/:id/permanent`；资料库树默认列表仅含 **未删除** 项目；侧栏 **回收站** 计数；主区 **`trash`** 列表与卡片 **恢复 / 彻底删除**（`ProjectGithubCard` **`trashMode`**）；**`invalidateProjectRelated`** 含 **`projects/trash`** 与 **`trash-count`** 键。
- **文档**：根 [`README.md`](../README.md) 与 [`docs/PROJECT_PILOT_Implementation_Plan.md`](../docs/PROJECT_PILOT_Implementation_Plan.md)、[`docs/PROJECT_PILOT_v0.1_设计文档.md`](../docs/PROJECT_PILOT_v0.1_设计文档.md) 对齐上述行为（右栏子条、侧栏清预览、顶栏布局与 Tooltip、主区卡片小节、实现计划补充表行、§5.1）。
- **资料库 UI（迭代）**：GitHub 卡片 **移入回收站 / 彻底删除** 的 **`AlertDialog`** 与侧栏默认字号一致、标题与 **`ProjectLibraryPreviewPanel`** 项目名同为 **`text-base`**；说明 **`text-sm`**、底部按钮默认高度；主操作 **「确认」**；内容区纵向 **`gap`** 在原先放大的基础上再 **+20%**；主区 **子文件夹磁贴单击** 时右栏展示该文件夹 **`LibraryFolderInfoPanel`**（**`pendingFolderId`** 优先于当前 **`libraryScope` 文件夹**），并 **`ensureFeatureDrawerOpen`**；修复先点子文件夹再点项目卡片时，**`document` `pointerdown` 捕获** 与卡片 **280ms** 预览定时器竞态导致的 **侧栏短暂闪回当前 scope 文件夹**（主区项目列表 **`ref`** 内不清待定、打开预览时 **`setBrowsePendingFolderId(null)`**）。
- **项目入库**：**`projects.github_url`** 不再全局唯一，**`POST /api/projects`** 允许同一 GitHub 仓库 **重复添加**（多条记录、不同 **`id`**）；SQLite 启动迁移去掉 **`github_url`** 唯一索引并保留普通索引；侧栏文件夹树 **右键「添加 GitHub 项目」**（置于「新建子文件夹」之上）与顶栏下拉共用对话框且默认归入该文件夹；**`README` / 实现计划表** 与 **`IntegrityError`** 提示文案对齐。
- **删除文件夹**：**`DELETE /api/folders/{id}`** 删除**整棵子文件夹树**；子树内 **`deleted_at` 为空** 的项目**批量软删**进回收站，再**后序**物理删除各 **`Folder`** 行；侧栏 **`AlertDialog`** 与 **README** 说明与实现对齐；删除成功后 **`refetchQueries`** 资料库树并校正 **`libraryScope`**（含子文件夹在作用域内时回到默认视图）、**`setBrowsePendingFolderId(null)`**。
- **文件夹右栏详情**：**`folders.description`** + **`folder_tags`**；**`PATCH /api/folders/:id`** 支持 **`description`**、**`tag_ids`**；右栏可编辑描述（失焦保存）与管理领域标签（悬停 **「+」** 打开双栏弹窗，与项目一致）；标签 **`usage_count`** 统计含文件夹关联。

---

## 代码变更

### 1) 资料库右栏预览与主区滚动条

- **修改**：[`frontend/src/components/project/project-library-preview-panel.tsx`](../frontend/src/components/project/project-library-preview-panel.tsx) — 预览顶栏、简介编辑、标签「+」、基本信息字段等与 README「选中项目卡片」子条一致。
- **修改**：[`frontend/src/components/layout/app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx)、[`frontend/src/index.css`](../frontend/src/index.css) — 主内容区 **`.main-auto-scrollbar`** 隐显滚动条。

### 2) GitHub 卡片与主区布局、侧栏右栏联动

- **修改**：[`frontend/src/components/project/project-github-card.tsx`](../frontend/src/components/project/project-github-card.tsx) — 外链命中收窄（`w-max` 等）；网格/瀑布流 **`fillGridCell`**；简介与标签区在瀑布流下随内容；标签溢出 **「…」** + Tooltip 等。
- **新建**：[`frontend/src/context/library-projects-layout.tsx`](../frontend/src/context/library-projects-layout.tsx)、[`frontend/src/components/layout/library-projects-layout-toggle.tsx`](../frontend/src/components/layout/library-projects-layout-toggle.tsx)；**修改**：[`frontend/src/App.tsx`](../frontend/src/App.tsx)、[`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx)、[`frontend/src/components/layout/app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx) — 布局切换与 Tooltip。
- **修改**：[`frontend/src/components/layout/library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx)、[`frontend/src/components/layout/library-feature-aside.tsx`](../frontend/src/components/layout/library-feature-aside.tsx) — 侧栏选文件夹 / `libraryScope` 变化时 **`setPreviewProject(null)`**。

### 3) README 资料库段落

- **修改**：[`README.md`](../README.md) — **右栏行为**（含预览子条、侧栏与 `libraryScope` 变更时清除项目预览）、**顶栏**（网格/瀑布流、`localStorage`、Tooltip、`columns` 阅读顺序）、**主区 GitHub 项目卡片** 小节。

### 4) 实现计划补充表与日期

- **修改**：[`docs/PROJECT_PILOT_Implementation_Plan.md`](../docs/PROJECT_PILOT_Implementation_Plan.md) — **更新日期**；「补充：资料库 `/library`」表格追加 **主区布局切换**、**侧栏点文件夹 → 右栏文件夹信息**、预览面板、滚动条、GitHub 卡片外链等行。

### 6) `ProjectGithubCard` 右键菜单

- **修改**：[`frontend/src/components/project/project-github-card.tsx`](../frontend/src/components/project/project-github-card.tsx) — **`ContextMenu`** 包裹可拖拽根节点（**`ContextMenuTrigger` + `setNodeRef`**）；**`onContextMenu`** 清除单击预览定时器；**复制链接**（`navigator.clipboard` + `toast`）、**打开详情页**；**移动到…** 子菜单（`GET /api/folders` + **`PATCH /api/projects/:id`** `folder_id`；当前文件夹 / 未归类已所在则 **disabled**）；**移入回收站…**（**`AlertDialog`** + **`DELETE /api/projects/:id`** 软删、`invalidateProjectRelated`、若当前预览则 **`setPreviewProject(null)`**）；**移动 / 移入回收站** 仅在 **`draggableProjectId`** 存在且非 **`trashMode`** 时显示；回收站内 **恢复**、**彻底删除** 见第 **8)** 节。

### 7) README GitHub 卡片说明

- **修改**：[`README.md`](../README.md) — 「资料库 GitHub 卡片」条补充 **右键菜单** 能力与实现文件链接。

### 8) 项目回收站（软删除）

- **修改**：[`backend/app/models/project.py`](../backend/app/models/project.py) — **`deleted_at`**（可空、索引）。  
- **修改**：[`backend/app/core/database.py`](../backend/app/core/database.py) — SQLite **`ALTER TABLE projects ADD COLUMN deleted_at`**。  
- **修改**：[`backend/app/api/projects.py`](../backend/app/api/projects.py) — 列表 **`deleted_only`**；**`GET/PATCH`** 对已删 **404**；**`DELETE`** 软删；**`POST /{id}/restore`**、**`DELETE /{id}/permanent`**。  
- **修改**：[`backend/app/api/library.py`](../backend/app/api/library.py)、[`backend/app/api/folders.py`](../backend/app/api/folders.py) — 树与删文件夹计数排除已删。  
- **修改**：[`backend/app/schemas/project.py`](../backend/app/schemas/project.py) — **`ProjectRead.deleted_at`**。  
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json) — **`python scripts/export_openapi.py`**。  
- **修改**：[`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx)、[`frontend/src/components/layout/library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx)、[`frontend/src/components/library/library-scope-summary-panel.tsx`](../frontend/src/components/library/library-scope-summary-panel.tsx)、[`frontend/src/lib/invalidate-project-queries.ts`](../frontend/src/lib/invalidate-project-queries.ts)、[`frontend/src/types/project.ts`](../frontend/src/types/project.ts)、[`frontend/src/components/layout/app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx) — **`trashMode`**、回收站查询与失效键、右栏注释。  
- **文档**：[`README.md`](../README.md) — 回收站表行、OpenAPI 说明、右栏与卡片菜单表述。

### 9) 删除确认弹窗与子文件夹右栏、预览竞态

- **修改**：[`frontend/src/components/project/project-github-card.tsx`](../frontend/src/components/project/project-github-card.tsx) — **`AlertDialog`** 标题 / 说明 / 按钮与侧栏默认一致；移入回收站主按钮文案 **「确认」**；彻底删除弹窗与移入回收站同一 **`AlertDialogContent`** 结构；内容区 **`py` / `gap`** 放大；标题 **`text-base`** 与预览面板项目名一致；打开项目预览时 **`setBrowsePendingFolderId(null)`**（与 **`setPreviewProject`** 同路径）。
- **修改**：[`frontend/src/components/layout/library-feature-aside.tsx`](../frontend/src/components/layout/library-feature-aside.tsx) — 存在 **`pendingFolderId`** 时右栏渲染 **`LibraryFolderInfoPanel(pendingFolderId)`**，优先级介于项目预览与当前文件夹 scope 之间。
- **修改**：[`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx) — 子文件夹磁贴 **`onSelect`**：**`setPreviewProject(null)`**、**`setBrowsePendingFolderId`**、**`ensureFeatureDrawerOpen`**；**`libraryFilesListRef`** 包裹项目列表与空状态；**`pendingFolderId`** 非空时 **`pointerdown` 捕获** 若命中该 ref **不**清除待定（避免等 280ms 期间侧栏落到当前文件夹）。

### 10) `github_url` 允许重复入库与侧栏「添加 GitHub 项目」

- **修改**：[`backend/app/models/project.py`](../backend/app/models/project.py) — **`github_url`** 仅 **`index=True`**，去掉 **`unique=True`**。
- **修改**：[`backend/app/core/database.py`](../backend/app/core/database.py) — **`_migrate_sqlite_projects_github_url_allow_duplicates`**（仅 **`sqlite`**）：删除 **`github_url`** 上唯一索引（含 **`PRAGMA index_list`** 兜底），**`CREATE INDEX IF NOT EXISTS ix_projects_github_url`**。
- **修改**：[`backend/app/api/projects.py`](../backend/app/api/projects.py) — **`POST` / `PATCH`** 遇 **`IntegrityError`** 时提示改为泛化 **「数据约束冲突」**（不再特指 **`github_url` 已存在**）。
- **修改**：[`frontend/src/components/layout/library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx)、[`frontend/src/components/layout/library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx) — 文件夹 **右键** **「添加 GitHub 项目」**（顺序在 **「新建子文件夹」** 之上）；打开对话框时 **`setProjectFolderId`** 由调用方设定（顶栏下拉用 **`selectedFolderId`**，树右键用 **目标文件夹 `id`**），**`useEffect(projectDialogOpen)`** 不再覆盖 **`projectFolderId`**。
- **文档**：[`README.md`](../README.md)、[`docs/PROJECT_PILOT_Implementation_Plan.md`](../docs/PROJECT_PILOT_Implementation_Plan.md) — 右键菜单与 **`github_url`** 表说明。

### 11) 删除文件夹级联回收站

- **修改**：[`backend/app/api/folders.py`](../backend/app/api/folders.py) — **`_collect_subtree_folder_ids_postorder`**；**`delete_folder`**：去掉「有子文件夹 / 有项目」**409**；**`update(Project)`** 子树 **`deleted_at`**；按后序 **`db.delete(Folder)`**；**`_normalize_siblings`**。
- **修改**：[`frontend/src/components/layout/library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx) — 删除确认文案；**`deleteFolderMutation.onSuccess`**：**`refetchQueries`** 树后若当前 **`folder`** 已不存在则 **`DEFAULT_LIBRARY_SCOPE`**；**`setBrowsePendingFolderId(null)`**。
- **文档**：[`README.md`](../README.md) — 侧栏树 **删除** 行为一句说明。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json) — **`python scripts/export_openapi.py`**。

### 8) 文件夹描述与领域标签

- **新建**：[`backend/app/services/folder_read.py`](../backend/app/services/folder_read.py)、[`frontend/src/components/library/folder-domain-tags-dialog.tsx`](../frontend/src/components/library/folder-domain-tags-dialog.tsx)。  
- **修改**：[`backend/app/models/folder.py`](../backend/app/models/folder.py)、[`backend/app/models/tag.py`](../backend/app/models/tag.py)（**`FolderTag`**）、[`backend/app/api/folders.py`](../backend/app/api/folders.py)、[`backend/app/api/tags.py`](../backend/app/api/tags.py)、[`frontend/src/components/library/library-folder-info-panel.tsx`](../frontend/src/components/library/library-folder-info-panel.tsx)、[`contracts/openapi.json`](../contracts/openapi.json)。

---

## 验证记录

- **自动化**：`cd frontend && npm run build`、`npm run lint`（代码迭代时）。
- **手工**：`/library` 切换布局、侧栏点文件夹后右栏为文件夹信息；Markdown 内相对链接可打开；卡片 **右键** 四项、移动后树与列表刷新、**移入回收站** 后项目从主列表消失并出现在 **回收站**、**恢复** 后回归、**彻底删除** 后不再出现；**拖拽归类**仍可用。
- **手工**：进入某文件夹 → 单击子文件夹磁贴 → 右栏为该子文件夹信息 → 再单击项目卡片 → 右栏直接进入项目预览、**无**闪回父级文件夹；删除确认弹窗字号与 **「确认」** 按钮符合预期。
- **手工**：同一 **`github_url`** 连续 **两次**「添加 GitHub 项目」成功，资料库出现两条卡片、**`id`** 不同；侧栏文件夹 **右键**「添加 GitHub 项目」默认归入该文件夹。
- **手工**：含子文件夹与项目的父文件夹 **删除** 后，树与主区刷新；子树项目出现在 **回收站**，父/子文件夹节点消失。
- **手工**：右栏 **文件夹信息** 编辑描述失焦保存；悬停标签行 **「+」** 勾选标签保存后胶囊更新；**`GET /api/tags`** 使用次数含文件夹关联。
