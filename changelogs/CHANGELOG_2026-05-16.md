# 更新日志（2026-05-16）

## 范围

- **资料库主区搜索与筛选**：仿参考图在主内容区顶部增加工具栏——**搜索**（`name` / `full_name` / `description`）；**标签** Popover（左栏：已选定 / 所有标签 / 未分类 / 各分类 + 计数；右栏：搜索标签名 + 多选；底栏：**任意符合(或)** / **全部符合(且)**）；**文件夹** 多选（`all` / `folders_all` / `folder` 子树；**未分类**、**无标签** 禁用）；**时间** 占位「即将支持」。筛选在当期 `files` 列表上 **客户端** 执行；**标签管理**、**回收站** 不显示工具栏。切换 `libraryScope` 时保留搜索与标签条件，**清空文件夹筛选**。

---

## 代码变更

### 1) 筛选状态与纯函数

- **新建**：[`frontend/src/context/library-browse-filters.tsx`](../frontend/src/context/library-browse-filters.tsx) — `LibraryBrowseFiltersProvider` / `useLibraryBrowseFilters`。
- **新建**：[`frontend/src/lib/library-project-filters.ts`](../frontend/src/lib/library-project-filters.ts) — `applyLibraryFilters`、`filterBySearch` / `filterByTags` / `filterByFolders`。
- **修改**：[`frontend/src/App.tsx`](../frontend/src/App.tsx) — 挂载 **`LibraryBrowseFiltersProvider`**。
- **修改**：[`frontend/src/lib/library-tree.ts`](../frontend/src/lib/library-tree.ts) — **`collectFolderFilterEntries`** 供文件夹筛选列表。

### 2) UI 组件

- **新建**：[`frontend/src/components/ui/popover.tsx`](../frontend/src/components/ui/popover.tsx)（**`@radix-ui/react-popover`**）。
- **新建**：[`frontend/src/components/library/library-browse-toolbar.tsx`](../frontend/src/components/library/library-browse-toolbar.tsx) — 搜索框 + 标签 / 文件夹 / 时间筛选项。
- **新建**：[`frontend/src/components/library/library-tag-filter-panel.tsx`](../frontend/src/components/library/library-tag-filter-panel.tsx) — 图 2 双栏标签面板。
- **新建**：[`frontend/src/components/library/library-folder-filter-panel.tsx`](../frontend/src/components/library/library-folder-filter-panel.tsx) — 文件夹多选 Popover。

### 3) 主区集成

- **修改**：[`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx) — **`LibraryBrowseToolbar`**、**`displayFiles`** 驱动卡片与计数；筛选无结果时提示文案。

### 4) 文档

- **修改**：[`README.md`](../README.md) — 资料库主区搜索筛选说明。

---

## 验证记录

- **自动化**：`cd frontend && npm run build`、`npm run lint`（通过；`library-tag-filter-panel` 已用 `useMemo` 稳定 tags/categories 依赖）。
- **手工**：在「全部」与某文件夹下设置搜索、标签（或/且）、文件夹多选，列表与「项目 (n)」计数一致；切换侧栏 scope 后文件夹筛选清空；回收站 / 标签管理无工具栏。

---

## 资料库筛选栏布局优化（同日追加）

### 范围

- **搜索上移至顶栏**：与 [`LibraryProjectsLayoutToggle`](frontend/src/components/layout/library-projects-layout-toggle.tsx) 同级；默认弱化背景，**hover / focus** 再强调边框与 ring。
- **筛选 pill 缩小**：主区工具栏仅保留 `size-8` 图标级标签 / 文件夹 / 时间按钮。
- **文件夹筛选范围**：`folder` scope 仅列出**直接子文件夹**；`all` / `folders_all` 仍为根层文件夹。
- **标签筛选范围**：Popover 仅展示当前 scope 内 `files` 项目已绑定的标签；切换 scope 时 **prune** 无效 `selectedTagIds`。

### 代码变更

- **新建**：[`frontend/src/components/library/library-header-search.tsx`](../frontend/src/components/library/library-header-search.tsx)。
- **修改**：[`frontend/src/components/layout/app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx) — header 嵌入搜索。
- **修改**：[`frontend/src/components/library/library-browse-toolbar.tsx`](../frontend/src/components/library/library-browse-toolbar.tsx)、[`library-tag-filter-panel.tsx`](../frontend/src/components/library/library-tag-filter-panel.tsx)、[`home.tsx`](../frontend/src/pages/library/home.tsx)。
- **修改**：[`frontend/src/lib/library-tree.ts`](../frontend/src/lib/library-tree.ts) — `collectDirectChildFolderEntries`；[`library-project-filters.ts`](../frontend/src/lib/library-project-filters.ts) — `collectTagIdsFromProjects`。

### 验证记录

- **自动化**：`npm run build`、`npm run lint`（通过）。
- **手工**：顶栏搜索与布局按钮同排；进入子文件夹后「文件夹」筛选仅子级；标签面板数量随 scope 收窄。

---

## 子文件夹右栏与文件夹标签弹窗修复（同日追加）

### 范围

- **子文件夹右栏保持**：在父文件夹主区单击子文件夹磁贴后，右栏通过 `pendingFolderId` 显示子文件夹信息；此前在右栏点「管理标签」或操作标签弹窗时，全局 `pointerdown`（capture）会清空 `pendingFolderId`，右栏退回侧栏选中的父文件夹。
- **标签弹窗乱码**：`FolderDomainTagsDialog` 中标题、导航、占位符等中文曾变为大量 `????`（源文件 UTF-8 被错误改写）；已按正常的 [`project-domain-tags-dialog.tsx`](../frontend/src/components/project/project-domain-tags-dialog.tsx) 重新生成文件夹版，文案与项目标签弹窗一致。
- **经验备忘**：  
  - `libraryScope`（侧栏选中）与 `pendingFolderId`（主区磁贴待定）分工不同；任何「点击外部取消选中」逻辑须排除 `#feature-drawer` 与 Portal 内的 `[role="dialog"]`。  
  - 含中文的 TSX 勿用 PowerShell 管道/替换直接写盘；优先在 IDE 内编辑，或从已验证的同类组件复制后改 API（`PATCH /api/folders/:id` + `tag_ids`）。

### 代码变更

- **修改**：[`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx) — `pendingFolderId` 清理：`pointerdown` 排除 `feature-drawer`、`role="dialog"`。
- **修改**：[`frontend/src/components/library/library-folder-info-panel.tsx`](../frontend/src/components/library/library-folder-info-panel.tsx) — 标签「+」按钮 `stopPropagation`，避免触发文档级清理。
- **修改**：[`frontend/src/components/library/folder-domain-tags-dialog.tsx`](../frontend/src/components/library/folder-domain-tags-dialog.tsx) — 自项目版模板恢复完整中文 UI；`onPointerDown` 阻止冒泡；保存 toast「文件夹标签已更新」。

### 验证记录

- **自动化**：`cd frontend && npm run build`（通过）。
- **手工**：父文件夹 → 单击子文件夹磁贴 → 右栏为子文件夹 → 点标签「+」→ 弹窗文案正常（非 `????`）→ 保存后右栏仍为该子文件夹，不跳回父级。
