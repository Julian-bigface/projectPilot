# 更新日志（2026-05-11）

## 范围

- **项目 ↔ 标签闭环**：`PATCH /projects/{id}` 支持 `**tag_ids`**（整表替换 `project_tags`），驱动 `**tags.usage_count`**。
- **资料库「无标签」**：主区 `**GET /projects?missing_tags=true`**，与侧栏筛选一致。
- **项目详情**：展示领域标签；编辑对话框保存后失效 **资料库树 / 项目列表 / 标签列表 / 无标签列表与计数**。
- **GitHub 项目卡片**：GitHub topics 下方展示 Pilot **领域标签**（与蓝色 topics 区分）。
- **契约**：重新导出 `[contracts/openapi.json](../contracts/openapi.json)`。
- **文档**：`[README.md](../README.md)`、`[docs/PROJECT_PILOT_v0.1_设计文档.md](../docs/PROJECT_PILOT_v0.1_设计文档.md)`、`[docs/PROJECT_PILOT_Implementation_Plan.md](../docs/PROJECT_PILOT_Implementation_Plan.md)`（`tag_ids`、`missing_tags`、无标签与 Phase 3 状态）。
- **标签编辑对话框**：固定高度，中间双栏仅内部滚动。
- `**ContextMenuSub`**：与普通菜单项对齐；子菜单容器带边框（`forwardRef`、padding 统一）。
- **标签管理** 标签右键：色块单行缩小；首钮为默认/清除本机色；`TAG_ACCENT_BAR` 与 7 色圆钮；略加宽菜单以容纳圆钮。
- **资料库主 Panel 顶栏**：`[libraryScope](../frontend/src/context/library-selection.tsx)` **past / future** 导航栈；`[LibraryPanelChrome](../frontend/src/components/layout/library-panel-chrome.tsx)` 后退 / 前进与板块文案；`[library/home.tsx](../frontend/src/pages/library/home.tsx)` 去掉正文冗余大号标题；`[library-scope-label.ts](../frontend/src/lib/library-scope-label.ts)` 侧栏与顶栏共用标签文案。

---

## 代码变更

### 1) 前端：详情编辑标签 + 卡片展示 + `home` 构建修复

- **文件**：`[frontend/src/pages/projects/detail.tsx](../frontend/src/pages/projects/detail.tsx)`、`[frontend/src/components/project/project-github-card.tsx](../frontend/src/components/project/project-github-card.tsx)`、`[frontend/src/pages/library/home.tsx](../frontend/src/pages/library/home.tsx)`
- **内容**：
  - 详情页「领域标签」区块与编辑对话框（`PATCH` `tag_ids`）；成功后 `invalidateQueries`：`library/tree`、`projects`、`tags`、`projects/missing-tags`、`projects/missing-tags-count`。
  - `ProjectGithubCard` 展示 `project.tags`。
  - `home.tsx`：移除与 `showFolderGrid` 冗余的 `no_tags` 比较，修复 `tsc` 窄化报错。

### 2) 契约

- **文件**：`[contracts/openapi.json](../contracts/openapi.json)`
- **内容**：执行 `python scripts/export_openapi.py` 与当前 FastAPI 对齐。

### 3) 文档（标签 / 无标签 / Phase 3）

- **文件**：`[README.md](../README.md)`、`[docs/PROJECT_PILOT_v0.1_设计文档.md](../docs/PROJECT_PILOT_v0.1_设计文档.md)`、`[docs/PROJECT_PILOT_Implementation_Plan.md](../docs/PROJECT_PILOT_Implementation_Plan.md)`
- **内容**：补充 `tag_ids`、`missing_tags`、无标签入口与 Phase 3 勾选状态。

### 4) 标签编辑窗高度 + 右键菜单 + 标签管理色块

- **文件**：`[frontend/src/pages/projects/detail.tsx](../frontend/src/pages/projects/detail.tsx)` — `DialogContent` 使用 `h-[min(72vh,560px)]`；主内容区 `flex-1 min-h-0`；加载/错误区占满中间区域。
- **文件**：`[frontend/src/components/ui/context-menu.tsx](../frontend/src/components/ui/context-menu.tsx)` — `ContextMenuSubTrigger` / `ContextMenuSubContent`：`forwardRef`，与 `ContextMenuItem` 同级 `px-2 py-1.5`，子菜单 `border`。
- **文件**：`[frontend/src/pages/library/tag-management.tsx](../frontend/src/pages/library/tag-management.tsx)` — `TagChipMenuContent` 色条与默认/7 色逻辑；略加宽 `ContextMenuContent`。

### 5) 资料库主 Panel 顶栏与共享板块文案

- **文件**：`[frontend/src/context/library-selection.tsx](../frontend/src/context/library-selection.tsx)` — `useReducer` 维护 **past / future**；`setLibraryScope` / `setSelectedFolderId` 切换时压栈并清空前进栈；导出 `goLibraryBack`、`goLibraryForward`、`libraryCanGoBack`、`libraryCanGoForward`。
- **文件**：`[frontend/src/components/layout/library-panel-chrome.tsx](../frontend/src/components/layout/library-panel-chrome.tsx)` — 顶栏后退 / 前进按钮与 `getLibraryScopeDisplayLabel`；`useQuery(["library","tree"])`。
- **文件**：`[frontend/src/components/layout/app-layout.tsx](../frontend/src/components/layout/app-layout.tsx)` — `/library` 时左侧 `LibraryPanelChrome`，右侧抽屉切换。
- **文件**：`[frontend/src/pages/library/home.tsx](../frontend/src/pages/library/home.tsx)` — 移除正文顶部大号标题 / 下拉（板块以侧栏高亮 + 顶栏为准）。
- **文件**：`[frontend/src/lib/library-scope-label.ts](../frontend/src/lib/library-scope-label.ts)` — `scopesEqual`、`getLibraryScopeDisplayLabel`；`[library-sidebar.tsx](../frontend/src/components/layout/library-sidebar.tsx)`「当前：」改为调用该函数。

---

## 验证记录

- **自动化**：`frontend` 执行 `npm run build`、`npm run lint` 通过。
- **契约**：仓库根执行 `python scripts/export_openapi.py` 成功写入 `contracts/openapi.json`。
- **手工**：详情勾选标签保存 → 标签管理 `usage_count` 变化；侧栏「无标签」数量与列表一致；资料库顶栏后退 / 前进与板块名随 `libraryScope` 变化。

---

## 后续建议

- 看板 **按标签筛选**（Implementation Plan 仍为待办）。
- 若需显式 `**PUT /projects/{id}/tags`**，可与现有 `PATCH` 并存为别名（当前以 `**PATCH` + `tag_ids`** 为单一写入路径）。
- 标签色 **localStorage**：原 **8 档** 与现 **7 档 + 默认** 不完全兼容，旧值可能需重新点选；仅影响本机展示色条。

