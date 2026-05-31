# 更新日志（2026-05-27）

## 范围

- **项目库（Project Library）**：在资料库（文件夹 / 标签 / 项目）之上新增顶层 **项目库**；各库数据相互隔离（独立文件夹树、标签体系与项目归属）。
- **路由**：默认 **`/libraries`** 为项目库首页；进入某一库为 **`/libraries/:id`**（原资料库主区能力）；旧 **`/library`** 重定向至上次库或首页。
- **README 同仓多文档**：项目详情 README Tab 内点击同仓库 **`.md` 链接**切换原文；`GET /projects/:id/readme?path=`；机器翻译仍仅针对 **默认 README**。
- **Release Tab UI**：横向行布局 + 附件 Popover 下载；API 返回 `assets`（文件名、大小、下载次数）。
- **项目库首页**：列表 / 网格、搜索、新建、置顶「常用」、**整行点击进入**、右键 **重命名 / 删除**。
- **库内侧栏**：**ChevronLeft** 返回项目库列表；**项目库名称下拉** 切换库；副标题仍显示当前资料库 scope。
- **看板 / 全局项目列表**：本期仍 **跨库**（未按 `project_library_id` 过滤），后续迭代。

---

## 代码变更

### 1) 后端：模型、迁移与 API

- **新建**：[`backend/app/models/project_library.py`](../backend/app/models/project_library.py) — `project_libraries` 表（`name`、`description`、`is_pinned`、`sort_order`、时间戳）。
- **修改**：[`backend/app/models/folder.py`](../backend/app/models/folder.py)、[`project.py`](../backend/app/models/project.py)、[`tag.py`](../backend/app/models/tag.py) — 增加 `project_library_id`；`tags` / `tag_categories` 名称唯一约束改为 **库内复合唯一**。
- **修改**：[`backend/app/core/database.py`](../backend/app/core/database.py) — `_migrate_sqlite_project_libraries`：建表、插入 **「默认项目库」**、四表回填、替换旧全局唯一索引。
- **新建**：[`backend/app/api/project_libraries.py`](../backend/app/api/project_libraries.py)、[`backend/app/api/deps.py`](../backend/app/api/deps.py)、[`backend/app/api/library_projects.py`](../backend/app/api/library_projects.py)、[`backend/app/services/project_library_read.py`](../backend/app/services/project_library_read.py)、[`backend/app/schemas/project_library.py`](../backend/app/schemas/project_library.py)。
- **修改**：[`backend/app/api/folders.py`](../backend/app/api/folders.py)、[`tags.py`](../backend/app/api/tags.py)、[`tag_categories.py`](../backend/app/api/tag_categories.py)、[`library.py`](../backend/app/api/library.py) — 经 `Depends(get_project_library)` 按库过滤；挂载于 **`/api/project-libraries/{library_id}/...`**。
- **修改**：[`backend/app/main.py`](../backend/app/main.py) — 移除全局 `/folders`、`/tags`、`/library/tree`；保留全局 **`/api/projects`**（详情、看板等）。
- **修改**：[`backend/app/schemas/project.py`](../backend/app/schemas/project.py) — `ProjectRead` 增加 `project_library_id`。
- **新建**：[`backend/tests/test_project_libraries.py`](../backend/tests/test_project_libraries.py)。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json)（`python scripts/export_openapi.py`）。

### 2) 前端：路由、上下文与资料库 scoped 请求

- **修改**：[`frontend/src/App.tsx`](../frontend/src/App.tsx) — `/libraries`、`/libraries/:libraryId`（`ProjectLibraryLayout` + `LibraryHomePage`）；`/`、`/library` → `LibraryRedirect`。
- **新建**：[`frontend/src/context/project-library.tsx`](../frontend/src/context/project-library.tsx)、[`frontend/src/lib/pl-api.ts`](../frontend/src/lib/pl-api.ts)、[`frontend/src/hooks/use-pl-api.ts`](../frontend/src/hooks/use-pl-api.ts)、[`frontend/src/types/project-library.ts`](../frontend/src/types/project-library.ts)、[`frontend/src/pages/project-libraries/home.tsx`](../frontend/src/pages/project-libraries/home.tsx)、[`frontend/src/components/routing/library-redirect.tsx`](../frontend/src/components/routing/library-redirect.tsx)、[`frontend/src/components/layout/project-library-route-shell.tsx`](../frontend/src/components/layout/project-library-route-shell.tsx)。
- **修改**：[`frontend/src/pages/library/library-layout.tsx`](../frontend/src/pages/library/library-layout.tsx) — 仅 `<Outlet />`；Provider 由 `ProjectLibraryRouteShell` 提供。
- **修改**：[`frontend/src/components/layout/app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx) — 仅 `/libraries/:id` 显示资料库侧栏与右栏；库内用 `ProjectLibraryRouteShell` + `flex` 行布局。
- **修改**：[`frontend/src/components/layout/function-rail.tsx`](../frontend/src/components/layout/function-rail.tsx) — 入口 **`/libraries`**，tooltip「项目库」。
- **修改**：资料库相关页与组件（`library-sidebar`、`library-dnd-context`、`library/home`、`tag-management`、筛选面板、文件夹/项目标签弹窗等）— `fetch` 与 TanStack Query key 均带 **`libraryId`**，路径经 `plApi.path(...)`。

### 3) 库内侧栏：返回与切换

- **修改**：[`frontend/src/components/layout/library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx)  
  - 顶栏：**ChevronLeft** 返回 `/libraries`（清空 scope / 预览）。  
  - **DropdownMenu** 展示项目库列表与「管理项目库…」。  
  - 标题为当前 **项目库名称**（非固定「资料库」）。

### 4) 项目库首页交互

- **修改**：[`frontend/src/pages/project-libraries/home.tsx`](../frontend/src/pages/project-libraries/home.tsx)  
  - 列表 **整行**、网格 **整卡** 点击进入 `/libraries/:id`；置顶 Pin **`stopPropagation`**。  
  - **右键菜单**：打开、重命名（Dialog + `PATCH`）、删除（`AlertDialog` + `DELETE`，级联库内数据）。  
  - 常用区、搜索、列表/网格切换、`localStorage` 视图模式。

### 5) 修复：进入项目库白屏

- **原因**：`LibrarySidebar` / `LibraryDndProvider` 在 `AppLayout` 渲染，但 `ProjectLibraryProvider` 原先只包裹子路由 `Outlet`，`useProjectLibrary()` 抛错。
- **修改**：[`project-library-route-shell.tsx`](../frontend/src/components/layout/project-library-route-shell.tsx) 在布局层拉取库元数据并注入 Context；[`use-pl-api.ts`](../frontend/src/hooks/use-pl-api.ts) 支持从 URL `libraryId` 回退。

### 6) 文档与其它返回链

- **修改**：[`README.md`](../README.md) — 项目库 / 资料库两层说明与 API 前缀。  
- **修改**：[`project-detail-panel-chrome.tsx`](../frontend/src/components/layout/project-detail-panel-chrome.tsx)、[`settings-layout.tsx`](../frontend/src/components/layout/settings-layout.tsx)、[`pages/projects/detail.tsx`](../frontend/src/pages/projects/detail.tsx) — 「返回资料库」指向 **`/libraries/:lastId`** 或 `/libraries`。

### 7) 文件夹子树导入/导出（便携包 `.ppb.json`）

- **新建**：[`backend/app/schemas/folder_bundle.py`](../backend/app/schemas/folder_bundle.py)、[`backend/app/services/folder_bundle.py`](../backend/app/services/folder_bundle.py)、[`backend/app/api/folder_bundle.py`](../backend/app/api/folder_bundle.py)、[`backend/tests/test_folder_bundle.py`](../backend/tests/test_folder_bundle.py)。
- **API**：`GET /api/project-libraries/{id}/folders/{folder_id}/export`；`POST .../import/folder-bundle`（`target_parent_folder_id`、`skip_duplicate_github_url`）。
- **规则**：导出子树内文件夹与未软删项目；标签按 `name` + `category_name` **get_or_create**；同级重名文件夹自动 `名称 (1)`…；默认 **仍新建** 同 `github_url` 项目，勾选跳过时跳过库内已有链接。
- **前端**：[`frontend/src/lib/folder-bundle.ts`](../frontend/src/lib/folder-bundle.ts)、[`import-folder-bundle-dialog.tsx`](../frontend/src/components/library/import-folder-bundle-dialog.tsx)、[`use-folder-bundle-file-drop.ts`](../frontend/src/hooks/use-folder-bundle-file-drop.ts)；侧栏文件夹 **右键导出/导入**、库根 **右键/拖放** 导入。

### 8) 未归类项目在库根「文件夹」视图展示

- **修改**：[`frontend/src/lib/library-tree.ts`](../frontend/src/lib/library-tree.ts) — `projectsAtLibraryRoot`（未归类 + 树内项目）。
- **修改**：[`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx) — `folders_all` 主区列表包含 `orphan_projects`，与库根 DnD「未归类」一致。
- **文档**：[`README.md`](../README.md) 资料库视图表。

### 9) README Tab 同仓多文档点击切换

- **新建**：[`backend/app/services/readme_path.py`](../backend/app/services/readme_path.py) — 路径规范化、禁止 `..`、仅 `.md`/`.markdown`。
- **修改**：[`backend/app/services/github_client.py`](../backend/app/services/github_client.py) — `contents_api_url`、`fetch_repo_file_raw`。
- **修改**：[`backend/app/services/project_github_content.py`](../backend/app/services/project_github_content.py)、[`backend/app/api/projects.py`](../backend/app/api/projects.py)、[`backend/app/schemas/project_github.py`](../backend/app/schemas/project_github.py) — `GET /projects/:id/readme?path=`；响应 `path`、`is_default`。
- **新建**：[`backend/tests/test_readme_path.py`](../backend/tests/test_readme_path.py)。
- **新建**：[`frontend/src/lib/readme-link-resolve.ts`](../frontend/src/lib/readme-link-resolve.ts)、[`frontend/src/lib/project-readme.ts`](../frontend/src/lib/project-readme.ts)。
- **修改**：[`frontend/src/components/project/detail/markdown-content.tsx`](../frontend/src/components/project/detail/markdown-content.tsx) — 拦截同仓 md 链接；扩展 sanitize 保留 `a[href]`。
- **修改**：[`frontend/src/components/project/detail/project-readme-tab.tsx`](../frontend/src/components/project/detail/project-readme-tab.tsx) — `readmePath` 状态、面包屑、「返回默认 README」、非默认文件禁用译文/分段翻译。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json)。
- **文档**：[`README.md`](../README.md) 项目详情 README 小节。

### 10) Release Tab 参考图式改版

- **修改**：[`backend/app/schemas/project_github.py`](../backend/app/schemas/project_github.py) — `ProjectReleaseAssetRead`；`ProjectReleaseRead.assets`。
- **修改**：[`backend/app/services/project_github_content.py`](../backend/app/services/project_github_content.py) — `_map_release_assets`。
- **修改**：[`backend/tests/test_project_github_content.py`](../backend/tests/test_project_github_content.py)。
- **新建**：[`frontend/src/lib/format-file-size.ts`](../frontend/src/lib/format-file-size.ts)。
- **修改**：[`frontend/src/types/project-github.ts`](../frontend/src/types/project-github.ts)、[`frontend/src/components/project/detail/project-releases-tab.tsx`](../frontend/src/components/project/detail/project-releases-tab.tsx)、[`frontend/src/components/project/detail/project-detail-tabs.tsx`](../frontend/src/components/project/detail/project-detail-tabs.tsx) — 横向行 + 附件 Popover + 相对时间。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json)。
- **文档**：[`README.md`](../README.md) 项目详情 Release 小节。

---

## 验证记录

- **自动化**：`cd backend && python -m pytest -q`（含 `test_folder_bundle.py`、`test_readme_path.py`、`test_project_github_content.py`）；`python scripts/export_openapi.py`；`cd frontend && npm run build`。
- **手工**：项目库首页 → 整行进入库 → 侧栏返回与下拉切换库 → 两库各建文件夹/标签互不可见；右键重命名/删除；进入库不再白屏；文件夹导出 `.ppb.json` → 另一库/落点导入 → 树结构与标签；拖放 `.ppb.json` 到 nest 区域；库根「文件夹」视图可见未归类项目；含 `[中文](README.zh-CN.md) | [English](README.md)` 的仓库在 README Tab 内点击切换原文；Release Tab 附件 Popover 可列出文件并下载、无附件显示「无附件」、说明可展开。

---

## 后续建议

- `/projects`、`/projects/board`、`/projects/mock-shelf` 按当前项目库过滤；项目详情 URL 携带库上下文。
- 项目库封面图标、锁定态（产品图参考中的锁图标）等尚未实现。
