# 更新日志（2026-05-08）

## 范围

- **语雀式壳层**：左侧栏 + 主区 + 右侧可伸缩抽屉；**`/projects/mock-shelf`** 占位页。
- 侧栏升级为 **功能区 + API 库树**，以及文件夹 **`sort_order`**、同级重排、右键菜单与拖拽（跨父级移动）。
- **知识库式主页** `/library`：主区子文件夹 **卡片** + 项目 **表格**；**`LibrarySelectionContext`** 与侧栏共享当前文件夹；应用默认打开 `/library`。
- **跟进**：侧栏文件夹树 **右键菜单整行触发**（折叠箭头 / 拖拽手柄 / 名称同一 `ContextMenuTrigger`），与 [`README.md`](../README.md) 描述一致。
- **跟进**：侧栏 **项目拖入文件夹归类**（`PATCH /projects/:id`）；非 `/library` 路由下点侧栏文件夹 **导航回 `/library`**。
- **跟进**：侧栏拖拽 **投放反馈**（无描边）；**底部未归类投放区**（拖回 `folder_id: null`）。
- **项目详情** `/projects/:id`：知网式信息层级（摘要优先、基本信息著录表）、API **`folder_name`**。
- **跟进**：侧栏树 **不列出已归入文件夹的项目**（见 §8）。
- **添加项目 / 详情**：GitHub URL 自动解析 **owner/repo** 与显示名；详情页可编辑 **显示名称** 与 **仓库全名**。
- **Hover 说明**：字段长说明收进 **Hover Card**（? 图标），主界面更简。
- **添加项目**：仅填 URL + 可选 **简介**（`description`）；名称与 owner/repo **自动解析**；列表 **主标题 + 简介副标题**。
- **左下更多**：最左窄条贴底 **⋯** → **设置**。独立设置壳（`SettingsLayout`、路由拆分）**详见** [`CHANGELOG_2026-05-09.md`](./CHANGELOG_2026-05-09.md)，本日不重复。

---

## 代码变更

### 1) 语雀式布局 + 模拟列表占位页

- **依赖**：`frontend` 增加 `react-resizable-panels`、`@radix-ui/react-collapsible`。
- **布局**：[`frontend/src/components/layout/app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx) — 固定左侧栏 + `Group`/`Panel`/`Separator` 实现主区与右侧可折叠抽屉；初版静态侧栏（`nav-sidebar` / `nav-tree`）后续由本节之后的「功能区 + API 库树」替代。
- **占位页**：[`frontend/src/pages/projects/mock-shelf.tsx`](../frontend/src/pages/projects/mock-shelf.tsx) — 纯常量表格；[`frontend/src/App.tsx`](../frontend/src/App.tsx) 增加路由 `projects/mock-shelf`（置于 `projects` 泛匹配之前）。
- **文档**：根 [`README.md`](../README.md) 补充三栏与 `/projects/mock-shelf` 说明。
- **验证**：`npm run build`、`npm run lint`。

---

### 2) 语雀式「功能区 + 库树」与 folders/library API 前端接入

- **布局**
  - [`frontend/src/components/layout/app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx) — 在原有主区/右侧 `react-resizable-panels` 之外，增加 **最左 `FunctionRail`（窄条图标）** + **`LibrarySidebar`（库树侧栏，约 260–288px）**。
  - 新增：[`frontend/src/components/layout/function-rail.tsx`](../frontend/src/components/layout/function-rail.tsx)、[`frontend/src/components/layout/library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx)；移除静态 `nav-sidebar` / `nav-tree` 硬编码树（由 API 树替代）。
- **依赖（frontend）**：`@radix-ui/react-dialog`、`@radix-ui/react-dropdown-menu`、`@radix-ui/react-label`；复用已有 `@radix-ui/react-collapsible`。
- **UI 组件**：`components/ui` 下新增 `dialog` / `dropdown-menu` / `input` / `label`（Radix 封装）。
- **侧栏行为**：`GET /api/library/tree` 展示文件夹与项目；绿色 **+** 下拉 → **新建文件夹**（`POST /api/folders`）、**添加 GitHub 项目**（`POST /api/projects`，可选 `folder_id`）；父级/归属可选自 `GET /api/folders`。
- **类型**：[`frontend/src/types/library.ts`](../frontend/src/types/library.ts)；[`Project`](../frontend/src/types/project.ts) 增加 `folder_id`。
- **后端（folders / library）**：文件夹模型与 `library/tree`、`PATCH` 等与库树配套的接口（详见 §3 前序基础）；**契约**随 API 更新 [`contracts/openapi.json`](../contracts/openapi.json)。
- **验证**：`npm run build`、`npm run lint`；`python -m ruff check app`；`python scripts/export_openapi.py`。

---

### 3) 文件夹 `sort_order`、同级重排 API、侧栏右键菜单与拖拽

> **交互细化**见本节之后的 **§5**（右键触发区域：整行）。

- **后端**
  - [`backend/app/models/folder.py`](../backend/app/models/folder.py) — 字段 **`sort_order`**；[`backend/app/core/database.py`](../backend/app/core/database.py) — SQLite 迁移 `ALTER TABLE folders ADD COLUMN sort_order`。
  - [`backend/app/api/folders.py`](../backend/app/api/folders.py) — 创建时分配序号；`PATCH` 跨父级移动时压缩旧同级序号并在新父级末尾追加；删除后压缩同级序号；**`POST /folders/reorder`**（`FolderReorder`：`parent_id` + `ordered_ids` 与当前子级集合一致）；[`GET /folders`](../backend/app/api/folders.py) / [`library.py`](../backend/app/api/library.py) 按 **`sort_order`, `name`** 排序；[`FolderRead`](../backend/app/schemas/folder.py) 含 `sort_order`。
- **前端**
  - 新增 [`frontend/src/components/layout/library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx) — **`@dnd-kit`**：`DndContext`、同级 **`SortableContext`**、**`nest-*` 投放**（拖入文件夹或 **根目录** 行）→ `PATCH /folders/:id`；同级顺序 → **`POST /folders/reorder`**；**`DragOverlay`**。
  - [`library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx) — 集成树组件；**Radix `ContextMenu`**（新建子文件夹、重命名、删除）、**`AlertDialog`** 删除确认；重命名 / 删除 / 新建子文件夹对话框与变更失效策略。
  - UI：`components/ui/context-menu.tsx`、`alert-dialog.tsx`。
  - 依赖：`@radix-ui/react-context-menu`、`@radix-ui/react-alert-dialog`、`@dnd-kit/core`、`@dnd-kit/sortable`、`@dnd-kit/utilities`。
- **类型**：[`frontend/src/types/library.ts`](../frontend/src/types/library.ts) — `FolderRow.sort_order`。
- **契约**：已运行 [`scripts/export_openapi.py`](../scripts/export_openapi.py) 更新 [`contracts/openapi.json`](../contracts/openapi.json)。
- **验证**：`npm run build`、`npm run lint`；`python -m ruff check app`。

---

### 4) 知识库式主区 `/library` 与侧栏联动

- **状态**：[`frontend/src/context/library-selection.tsx`](../frontend/src/context/library-selection.tsx) — `selectedFolderId` / `setSelectedFolderId`（支持函数式更新，供删除后清除选中）；[`App.tsx`](../frontend/src/App.tsx) 在路由外包 **`LibrarySelectionProvider`**；**`/`** 重定向至 **`/library`**。
- **侧栏**：[`library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx) — 标题「资料库」、**文件夹搜索**（[`filterFolderTreeByName`](../frontend/src/lib/library-tree.ts)）；[`library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx) — 树行右侧 **徽标**（`folderDirectItemCount`：直接子文件夹数 + 直接项目数）。
- **工具**：[`frontend/src/lib/library-tree.ts`](../frontend/src/lib/library-tree.ts) — `findFolderNode`、`filterFolderTreeByName`、`folderDirectItemCount`（与树组件、主页共用）。
- **主区页**：[`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx) — 顶栏标题与简易菜单；**Folders** 网格卡片（点击进入子文件夹）；**Files** 表格（名称链至 GitHub、`author` 作添加者占位）。
- **布局**：[`app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx) — 路径 **`/library`** 时隐藏「主内容区」占位文案，仅保留右侧抽屉按钮；[`function-rail.tsx`](../frontend/src/components/layout/function-rail.tsx) — **`/library`** 入口（Library 图标）。
- **文档**：[`README.md`](../README.md) — 默认 **`/library`** 与能力说明。
- **验证**：`npm run build`、`npm run lint`。

---

### 5) 侧栏文件夹树：右键菜单整行触发

- **现象**：原先仅在文件夹 **名称区域** 包裹 Radix **`ContextMenuTrigger`** 时，在 **折叠箭头**、**拖拽手柄** 上右键会弹出 **浏览器默认菜单**；名称按钮上的 **`onContextMenu` + `preventDefault`** 也可能干扰 Radix 对 `contextmenu` 的处理。
- **变更**：[`frontend/src/components/layout/library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx) — 将 **`ContextMenuTrigger asChild`** 改为包裹 **整行容器**（箭头 + 手柄 + 名称行）；移除名称按钮上的 **`preventDefault`**；**`useDroppable` 的 `mergeNestRef`** 仍挂在该行容器上，拖拽嵌套投放行为不变。
- **文档**：根 [`README.md`](../README.md) — 明确「文件夹整行」均可触发应用右键菜单。
- **验证**：`npm run build`。

---

### 6) 资料库：项目拖拽归类 + 侧栏选文件夹回到 `/library`

- **问题**：从 **`/projects/:id`** 打开详情后，仅更新 `selectedFolderId` 无法切换主区（`Outlet` 仍由 URL 决定）；**「未归类项目」** 在侧栏曾写在 `LibraryFolderTree` **外**，与 **`DndContext`** 分离，无法拖入文件夹。
- **路由**：[`library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx) — **`selectFolderInLibrary`**：`setSelectedFolderId` 后，若当前路径 **不是** **`/library`** 则 **`navigate('/library')`**；删除文件夹后的选中修正仍直用 **`setSelectedFolderId`**。
- **拖拽**：[`library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx) — 新增 **`orphanProjects`**，**未归类** 列表移入 **`DndContext` 内**；**`ProjectLeaf`** 使用 **`useDraggable`（`project-{id}`）** + **手柄**，**`onDragEnd`** 优先处理项目 → **`nest-root` / `nest-*` / `folder-*`** 映射为 **`folder_id`** → **`PATCH /api/projects/:id`**；与文件夹拖拽逻辑分支互斥。
- **文档**：[`README.md`](../README.md) — 项目手柄归类与侧栏导航说明。
- **验证**：`npm run build`。

---

### 7) 侧栏拖拽：投放反馈（无描边）+ 底部「未归类」投放区

- **投放反馈**：[`library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx) — 文件夹行与「根目录」作为投放目标时，**不再使用 ring 描边**，仅用 **`bg-primary/14`**（及 **`shadow-sm`** 等）提示悬停目标。
- **未归类**：新增投放 id **`nest-uncategorized`**（**`UncategorizedProjectsDropZone`**），与 **`nest-root`** 相同语义 → 项目 **`PATCH`** **`folder_id: null`**；**底部「未归类项目」区域常驻**（无条目时显示简短说明，便于 **向下拖拽** 取消文件夹归类）。
- **文档**：[`README.md`](../README.md) — 补充上述交互。
- **验证**：`npm run build`。

---

### 8) 侧栏树不展示文件夹内项目（仅归类）

- **行为**：归入文件夹的项目 **仅在 `/library` 主区表格** 展示；侧栏树 **只渲染子文件夹**，不再在文件夹下列出 **`ProjectLeaf`**。[`library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx) — **`hasChildFolders`** 仅依据 **`node.children`**；**未归类** 区仍列出 **`folder_id === null`** 的项目。
- **文档**：[`README.md`](../README.md) — 补充说明。
- **验证**：`npm run build`。

---

## 文档

- 根 [`README.md`](../README.md) — 默认 **`/library`**、三栏、mock-shelf、侧栏 **右键（整行触发）** / **拖拽（文件夹 + 项目归类；投放提示无描边；未归类区拖回；已归类项目不在侧栏树列出）**、非 `/library` 点文件夹 **回资料库**、知识库主区说明；**右栏**（`feature-drawer`、板块摘要 / 文件夹信息 / 项目预览、`ensureFeatureDrawerOpen`、v4 `Panel` 尺寸字符串约定）。
- [`docs/PROJECT_PILOT_Implementation_Plan.md`](../docs/PROJECT_PILOT_Implementation_Plan.md) — 在「三、数据库设计」与「四、实现阶段」之间增加 **补充：资料库 `/library` 前端布局与右栏（已实现）** 小节，并与 README 交叉引用；文首 **更新日期** 修订为 2026-05-08。
- [`docs/PROJECT_PILOT_v0.1_设计文档.md`](../docs/PROJECT_PILOT_v0.1_设计文档.md) — 技术栈章增加 **§5.1 资料库主界面（Web）** 简要说明，与实现一致。

---

### 9) 项目详情页（知网式扫读）与 `ProjectRead.folder_name`

- **后端**：[`ProjectRead`](../backend/app/schemas/project.py) 增加可选 **`folder_name`**；[`app/services/project_read.py`](../backend/app/services/project_read.py) — **`project_to_read`**、批量 **`projects_to_read`**、库树用 **`project_read_with_folder_name`**；[`projects.py`](../backend/app/api/projects.py) 全部返回 enriched；[`library.py`](../backend/app/api/library.py) 树节点项目附带文件夹名称。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json) — `python scripts/export_openapi.py`。
- **前端**：[`frontend/src/types/project.ts`](../frontend/src/types/project.ts) — **`folder_name`**；[`frontend/src/pages/projects/detail.tsx`](../frontend/src/pages/projects/detail.tsx) — 标题区 **体验状态徽章**、**先摘要（AI → 仓库简介）**、部署方式、**基本信息**（文件夹可读名、本地化收录/更新时间）。
- **验证**：`npm run build`；`python -m ruff check app`。

---

### 10) GitHub URL 自动解析与详情页编辑仓库标识

- **工具**：[`frontend/src/lib/github-url.ts`](../frontend/src/lib/github-url.ts) — `parseGithubRepoUrl`。
- **侧栏**：[`library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx) — 粘贴 URL 自动填写 **显示名称**（仓库 slug）与 **仓库全名（owner/repo）**；失焦规范化链接；文案区分「仓库全名」与「仓库简介」。
- **详情**：[`detail.tsx`](../frontend/src/pages/projects/detail.tsx) — **仓库全名**区块说明 + **编辑**对话框（`PATCH` **name** / **full_name**）。
- **验证**：`npm run build`。

---

### 11) 说明文案迁入 Hover Card

- **组件**：[`hover-card.tsx`](../frontend/src/components/ui/hover-card.tsx)、[`hover-help.tsx`](../frontend/src/components/ui/hover-help.tsx)；依赖 `@radix-ui/react-hover-card`。
- **详情 / 侧栏**：长说明改为标题或标签旁的 **(?) 悬停卡片**，界面只保留标题与值。
- **验证**：`npm run build`。

---

### 12) 添加简介与列表双行展示（名称 + 副标题）

- **逻辑**：[`frontend/src/lib/project-display.ts`](../frontend/src/lib/project-display.ts) — **`projectSubtitle`**：有 **`description`** 用简介，否则 **`full_name`**。
- **侧栏**：[`library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx) — 移除名称/仓库全名输入；URL 解析 **预览条** + **`Textarea` 简介（可选）** → `POST` 携带 **`description`**。
- **列表**：[`library/home.tsx`](../frontend/src/pages/library/home.tsx)、[`library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx)、[`projects/board.tsx`](../frontend/src/pages/projects/board.tsx)、[`projects/list.tsx`](../frontend/src/pages/projects/list.tsx) — 统一副标题展示。
- **验证**：`npm run build`。

---

### 13) 语雀式左下角「更多 / 设置」

- **功能区**：[`function-rail.tsx`](../frontend/src/components/layout/function-rail.tsx) — 底部 **`DropdownMenu`**（**`MoreHorizontal`**），菜单 **「设置」** → **`/settings`**；当前路由为设置时触发器 **active** 样式；**`aside`** **`h-full min-h-0`**。
- **页面 / 路由**：[`App.tsx`](../frontend/src/App.tsx) — 当日 **`/settings`** 仍为嵌入 **主壳** 的占位页（单文件设置 UI）；**独立 `SettingsLayout`、子路由与文件迁移** 见 **[`CHANGELOG_2026-05-09.md`](./CHANGELOG_2026-05-09.md)**。
- **验证**：`npm run build`。

---

### 14) 语雀式独立设置页（`SettingsLayout`）

**详述与文件清单见 [`CHANGELOG_2026-05-09.md`](./CHANGELOG_2026-05-09.md)**（避免与 05-09 正文重复）。

---

### 15) GitHub PAT：设置页持久化 + `/settings` API（承接后续卡片拉取）

- **后端**
  - [`backend/app/models/app_settings.py`](../backend/app/models/app_settings.py) — 表 **`app_settings`**（KV：`key` / `value`）。
  - [`backend/app/services/settings_github.py`](../backend/app/services/settings_github.py) — 键 **`github_personal_access_token`**；**生效 Token** = 数据库非空优先，否则 **`GITHUB_TOKEN`**。
  - [`backend/app/services/github_client.py`](../backend/app/services/github_client.py) — **`GET https://api.github.com/user`** 测试连接（**httpx**，依赖已并入 [`backend/pyproject.toml`](../backend/pyproject.toml) 主依赖）。
  - [`backend/app/api/settings.py`](../backend/app/api/settings.py) — **`GET/PUT /settings/github`**（GET 仅 **`has_token`**、数据库内 **`token_preview`（末 4 位）**）、**`POST /settings/github/test`**。
  - [`backend/app/core/config.py`](../backend/app/core/config.py) — **`GITHUB_TOKEN`** 可选。
  - [`backend/app/main.py`](../backend/app/main.py) — 注册 **`/settings`** 路由。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json) — `python scripts/export_openapi.py`。
- **前端**：[`frontend/src/lib/settings-github.ts`](../frontend/src/lib/settings-github.ts)、[`frontend/src/pages/settings/github.tsx`](../frontend/src/pages/settings/github.tsx) — Token 输入、保存 / 清除 / 测试连接。
- **验证**：`npm run build`；`python -m ruff check app`。

---

### 16) 资料库：抬升 `DndContext`，主区项目卡片拖入侧栏归类

- **问题**：`DndContext` 原先仅在 [`library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx) 内，资料库主区 [`library/home.tsx`](../frontend/src/pages/library/home.tsx) 的 **`ProjectGithubCard`** 不在同一上下文，无法拖到侧栏文件夹。
- **架构**：新增 [`library-dnd-ids.ts`](../frontend/src/components/layout/library-dnd-ids.ts)（`project-{id}` / `folder-{id}` / `nest-*` 约定）；[`library-dnd-context.tsx`](../frontend/src/components/layout/library-dnd-context.tsx) 提供 **`LibraryDndProvider`**（`useQuery(["library","tree"])`、`PATCH /projects/:id`、文件夹重排/移动、`DragOverlay`）；[`app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx) 在 **`FunctionRail` 之外**包裹侧栏与主区 **`Group`**（含抽屉），共享同一 **`DndContext`**。
- **树**：[`library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx) 仅保留 **`useSortable` / `useDroppable`**，移除内层 **`DndContext`**；删除已无用的 **`orphanProjects`** prop。
- **卡片**：[`project-github-card.tsx`](../frontend/src/components/project/project-github-card.tsx) 可选 **`draggableProjectId`** → **`useDraggable`**（id **`projectDragId`**）；**`PointerSensor` + `distance: 6`**（Provider 内）区分点击进详情与拖拽；主页列表传入 **`draggableProjectId={p.id}`**。
- **验证**：`npm run build`、`npm run lint`。

---

## 验证记录（汇总）

- `npm run build`、`npm run lint`
- `python -m ruff check app`
- `python scripts/export_openapi.py`
