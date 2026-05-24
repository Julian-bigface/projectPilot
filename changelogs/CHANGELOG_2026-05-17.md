# 更新日志（2026-05-17）

## 范围

- **项目详情页改版**：Steam 社区式「英雄区 + Tabs」布局；README / Release / 笔记 Tab。
- **详情页英雄区精修**：GitHub 头像、`owner/repo` 外链、简介双击编辑、标签行与预览栏一致、顶栏返回资料库、全宽扁平布局、「更多信息」浮层。
- **README / Release 应用内展示**：新增 `GET /projects/{id}/readme`、`GET /projects/{id}/releases`，经后端代理 GitHub API 并渲染 Markdown。
- **Pilot 笔记**：`projects.notes` 字段与「笔记」Tab，支持显式保存与 Ctrl+S。
- **详情页布局微调**：英雄区与 Tab 栏间距收紧；英雄区去掉底部分割线；统计行不再展示许可证（改入「更多信息」）。
- **Tab 栏与「更多信息」**：「更多信息」移至 Tab 栏右侧 Popover；选中/未选中对比增强（字重、颜色、顶部天蓝描边）；选中 Tab 底边用背景 + `::after` 遮住栏底分割线。
- **Tab 内容区**：去掉外层边框/背景，仅保留内层卡片边框（Release 列表）；内容区圆角与卡片对齐（`rounded-xl` / `rounded-b-xl`）。
- **Release 卡片**：主标题可点击跳转 GitHub（移除右侧按钮）；`tag_name` 与标题同行（标题右侧，与标题相同时不重复）；发布时间仍在标题行下方。
- **资料库左侧树伸收**：文件夹树侧栏（`w-72`）与主区分界处 **pill** 收起/展开（**不**收起 52px 功能轨）；默认隐藏，鼠标移入分界悬停区时于 **约 1/4 高度** 显示，移开或点击后自动隐藏；`localStorage`（`projectPilot.librarySidebarOpen`）；快捷键 **`Ctrl+Alt+,`**。
- **深色模式**：通用设置页提供浅色 / 深色 / 跟随系统三档；`next-themes` + `localStorage`；首屏 FOUC 防护。

---

## 代码变更

### 1) 后端：notes 字段与 GitHub 内容 API

- **修改**：[`backend/app/models/project.py`](backend/app/models/project.py) 增加 `notes`；[`backend/app/schemas/project.py`](backend/app/schemas/project.py) 同步 `ProjectRead` / `ProjectUpdate`。
- **修改**：[`backend/app/core/database.py`](backend/app/core/database.py) SQLite 迁移 `_migrate_sqlite_add_project_notes`。
- **新建**：[`backend/app/schemas/project_github.py`](backend/app/schemas/project_github.py)、[`backend/app/services/project_github_content.py`](backend/app/services/project_github_content.py)。
- **修改**：[`backend/app/services/github_client.py`](backend/app/services/github_client.py) 增加 `fetch_readme_raw`、`fetch_releases`；[`backend/app/api/projects.py`](backend/app/api/projects.py) 注册 readme/releases 路由。
- **修改**：[`backend/app/services/github_enrich.py`](backend/app/services/github_enrich.py) enrich 时写入 `author`、`license`。
- **契约**：[`contracts/openapi.json`](contracts/openapi.json) 已导出。

### 2) 前端：详情页组件化与 Tab

- **修改**：[`frontend/src/pages/projects/detail.tsx`](frontend/src/pages/projects/detail.tsx) 重构为英雄区 + Tabs。
- **新建**：[`frontend/src/components/project/detail/`](frontend/src/components/project/detail/)（`project-detail-header`、`project-detail-tabs`、`project-readme-tab`、`project-releases-tab`、`project-notes-tab`、`markdown-content`）。
- **修改**：[`frontend/src/types/project.ts`](frontend/src/types/project.ts)、[`frontend/src/lib/invalidate-project-queries.ts`](frontend/src/lib/invalidate-project-queries.ts)。
- **依赖**：`react-markdown`、`remark-gfm`、`rehype-sanitize`。

### 3) 测试

- **新建**：[`backend/tests/test_project_github_content.py`](backend/tests/test_project_github_content.py) Release 映射单元测试。

### 4) 详情页英雄区 UI 精修

- **新建**：[`frontend/src/components/project/project-repo-avatar.tsx`](frontend/src/components/project/project-repo-avatar.tsx)、[`project-github-mark.tsx`](frontend/src/components/project/project-github-mark.tsx)、[`project-inline-description.tsx`](frontend/src/components/project/project-inline-description.tsx)、[`project-detail-panel-chrome.tsx`](frontend/src/components/layout/project-detail-panel-chrome.tsx)。
- **修改**：[`project-detail-header.tsx`](frontend/src/components/project/detail/project-detail-header.tsx)（头像、外链 full_name、Popover「更多信息」、标签 Plus）；[`app-layout.tsx`](frontend/src/components/layout/app-layout.tsx) 顶栏返回；[`detail.tsx`](frontend/src/pages/projects/detail.tsx) 移除身份编辑与主区返回链；[`project-library-preview-panel.tsx`](frontend/src/components/project/project-library-preview-panel.tsx) 复用共享组件。
- **修改**：[`github_enrich.py`](backend/app/services/github_enrich.py) `stats_only`；[`projects.py`](backend/app/api/projects.py) `POST /refresh-github?scope=stats`；详情页进入时自动同步统计行并 toast，移除手动同步按钮。

### 5) 详情页间距、Tab 栏与「更多信息」

- **新建**：[`frontend/src/components/project/detail/project-detail-more-info.tsx`](frontend/src/components/project/detail/project-detail-more-info.tsx) — Popover 元数据（AI 摘要、部署方式、GitHub、语言、**许可证**、文件夹、收录/更新时间、最新 Release）。
- **新建**：[`frontend/src/components/project/detail/project-detail-tab-styles.ts`](frontend/src/components/project/detail/project-detail-tab-styles.ts) — Steam 式 Tab 栏/触发器/内容区样式常量。
- **修改**：[`project-detail-header.tsx`](frontend/src/components/project/detail/project-detail-header.tsx) — 去掉 `border-b`；统计行移除 `license`；标签行不再 `justify-between`；移除内嵌「更多信息」。
- **修改**：[`project-detail-tabs.tsx`](frontend/src/components/project/detail/project-detail-tabs.tsx) — Tab 栏容器 + 右侧 `ProjectDetailMoreInfo`。
- **修改**：[`detail.tsx`](frontend/src/pages/projects/detail.tsx) — 主列 `gap-6` → `gap-2`；[`project-inline-description.tsx`](frontend/src/components/project/project-inline-description.tsx) 详情简介 `mt` 收紧。

### 6) Tab 内容区与 Release 卡片

- **修改**：[`project-detail-tab-styles.ts`](frontend/src/components/project/detail/project-detail-tab-styles.ts) — 内容区去掉 `border`/`bg-card`/`p-5`，仅 `pt-4`；选中 Tab 增强对比、`::after` + `shadow` 遮盖底部分割线；`overflow-visible` 防裁剪。
- **修改**：[`project-releases-tab.tsx`](frontend/src/components/project/detail/project-releases-tab.tsx) — `ReleaseCard` 标题链至 `html_url`、移除「GitHub」按钮、`tag_name` 置标题右侧（与标题文案相同时隐藏）。
- **修改**：[`project-readme-tab.tsx`](frontend/src/components/project/detail/project-readme-tab.tsx) — 空态/错误态 `rounded-lg` → `rounded-xl`。

### 7) 资料库左侧树伸收按钮

- **新建**：[`frontend/src/components/layout/library-sidebar-collapse-handle.tsx`](frontend/src/components/layout/library-sidebar-collapse-handle.tsx) — 贴边 pill + 全高悬停热区；`top-1/4` 定位；`hovered` 状态控制显隐（移开隐藏；点击后 `blur` 避免焦点常驻）；Tooltip（收起/展开、`Ctrl+Alt+,`）。
- **修改**：[`frontend/src/components/layout/app-layout.tsx`](frontend/src/components/layout/app-layout.tsx) — 侧栏 `w-72`/`w-0` 过渡壳层、内层 `invisible` 防收起动画文字挤压；`projectPilot.librarySidebarOpen` 持久化；全局快捷键（输入框内不触发）。

### 8) 深色模式（通用设置）

- **依赖**：`next-themes`、`@radix-ui/react-toggle`、`@radix-ui/react-toggle-group`。
- **新建**：[`frontend/src/components/theme-provider.tsx`](frontend/src/components/theme-provider.tsx)、[`frontend/src/components/theme-aware-toaster.tsx`](frontend/src/components/theme-aware-toaster.tsx)、[`frontend/src/components/settings/appearance-settings.tsx`](frontend/src/components/settings/appearance-settings.tsx)、[`frontend/src/components/ui/toggle.tsx`](frontend/src/components/ui/toggle.tsx)、[`frontend/src/components/ui/toggle-group.tsx`](frontend/src/components/ui/toggle-group.tsx)。
- **修改**：[`frontend/src/App.tsx`](frontend/src/App.tsx) 包裹 `ThemeProvider`、使用 `ThemeAwareToaster`；[`frontend/index.html`](frontend/index.html) 首屏主题脚本；[`frontend/src/pages/settings/general.tsx`](frontend/src/pages/settings/general.tsx) 接入外观区块；[`function-rail.tsx`](frontend/src/components/layout/function-rail.tsx) Logo 区 `bg-background`。

---

## 验证记录

- **自动化**：`cd backend && python -m pytest tests/ -q`（3 passed）；`cd frontend && npm run build`（通过）。
- **手工**：资料库双击进入详情；顶栏「返回资料库」；点击 `owner/repo` 打开 GitHub；双击简介保存；标签行 hover 显示「+」；Tab 栏右侧「更多信息」含许可证等元数据；英雄区无底部分割线。
- **手工（统计同步）**：进入详情页自动 `refresh-github?scope=stats`（Stars/Forks/推送等）；toast 提示；简介/标签不被覆盖。
- **手工（Tab / Release）**：选中 Tab 与未选中对比明显、选中项底边无明显缝隙；README / Release / 笔记内容区无外层边框；Release 卡片独立圆角边框；点击 Release 标题打开 GitHub；`tag_name` 在标题右侧（与标题不同时显示）。
- **手工（侧栏伸收）**：鼠标移入侧栏与主区分界线附近显示 pill（偏上）；移开或点击后 pill 消失；点击收起/展开资料库树；功能轨始终可见；刷新后状态保持；`Ctrl+Alt+,` 切换（输入框内不触发）。
- **手工（深色模式）**：`/settings` 通用设置切换浅色/深色/跟随系统，全站即时生效；刷新后偏好保持；深色下 toast 样式正确。
