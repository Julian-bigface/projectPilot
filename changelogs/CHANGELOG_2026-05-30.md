# 更新日志（2026-05-30）

## 范围

- **Release Tab 交互精修**：横向行布局下附件按钮优先收缩；项目名与 Release 标题固定间距；Release 说明改为悬浮 **pill** 展开/收起（默认隐藏，悬停行时显示）。
- **README Tab 右侧目录**：可展开/收起的标题导航；**展开/收起时 pill 均默认隐藏**，鼠标靠近目录列左缘（约 48px）时显示；同一 pill 负责展开/收起与宽度缩放；pill 为竖形（`h-20 w-5`）；点击目录项滚动至对应章节（`main` 滚动容器）。
- **README 解析与缓存**：借鉴 GithubStarsManager 相对图片 URL 解析与 HTML README 支持；默认 README 写入 SQLite，打开 Tab 先展示缓存再后台 `fresh` 同步 GitHub。
- **Release 缓存**：Release 列表同样写入 SQLite（`releases_cached`），进入详情页预拉取，Tab 秒开 + 后台同步；「更多信息」展示 Release 缓存状态。
- **Zread Wiki 跳转**：项目详情标题旁增加 Zread 外链按钮（`zread.ai/{owner}/{repo}`）。
- **桌面版外链**：Tauri 接入 `opener` 插件，GitHub / Zread / Release 等外链经系统浏览器打开。
- **发现中心性能**：趋势 RSS 先返回、后端并行 enrich + SQLite 缓存；前端两阶段加载（enrich 仍经 API）。
- **发现中心交互与刷新策略**：列表区无限滚动、顶栏与资料库同高（`h-12`）；频道标题/结果数/刷新迁入顶栏；**5 分钟内**非手动请求复用缓存（手动刷新仍 `fresh=true`）；侧栏「上次刷新」5 分钟内显示 **刚刚**，5 分钟～1 小时按 **15 分钟** 粒度。
- **发现列表 → 预览/详情**：单击卡片进入详情；**已收录** → `/projects/:id`；**未收录** → `/discovery/r/:owner/:repo` 只读预览（README / Release / 笔记占位）；顶栏 **返回发现**。
- **发现预览简介**：enrich 后优先 GitHub 短简介（修复 RSS 长 description 覆盖）；预览简介 **line-clamp** + 展开；Sparkles **临时翻译**（不落库）。

---

## 代码变更

### 7) 发现中心（趋势 + 五频道）

- **新建**：[`backend/app/api/discovery.py`](../backend/app/api/discovery.py)、[`backend/app/schemas/discovery.py`](../backend/app/schemas/discovery.py)、[`backend/app/services/discovery_*.py`](../backend/app/services/) — RSS 趋势 + Search 四频道；GitHub enrich。
- **修改**：[`backend/app/services/github_client.py`](../backend/app/services/github_client.py) — `search_repositories`；[`backend/app/api/library_projects.py`](../backend/app/api/library_projects.py) — `full_name` 筛选（导入去重）。
- **新建**：[`frontend/src/pages/discovery/`](../frontend/src/pages/discovery/)、[`frontend/src/components/discovery/`](../frontend/src/components/discovery/) — 侧栏、列表、卡片、导入弹窗。
- **修改**：[`function-rail.tsx`](../frontend/src/components/layout/function-rail.tsx)、[`app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx)、[`App.tsx`](../frontend/src/App.tsx) — `/discovery` 路由与 w-72 二级栏。
- **测试**：[`backend/tests/test_discovery.py`](../backend/tests/test_discovery.py)；已更新 [`contracts/openapi.json`](../contracts/openapi.json)。

### 8) 发现中心性能优化（RSS 先返回 + 后端 enrich + SQLite 缓存）

- **新建**：[`backend/app/services/discovery_cache.py`](../backend/app/services/discovery_cache.py) — 趋势 RSS 全榜（30min）、Search 分页（10min）、仓库 enrich（6h）SQLite 缓存表。
- **修改**：[`backend/app/core/database.py`](../backend/app/core/database.py) — `discovery_feed_cache` / `discovery_repo_cache` 迁移。
- **修改**：[`discovery_trending.py`](../backend/app/services/discovery_trending.py) — `GET /trending` 仅 RSS + 分页，不再阻塞 enrich。
- **修改**：[`discovery_enrich.py`](../backend/app/services/discovery_enrich.py) — `asyncio.gather` + 信号量并行；先读仓库缓存。
- **新增 API**：`POST /api/discovery/repos/enrich` — 趋势列表第二批补全 language/topics（**仍走后端 GitHub Token，非前端直连**）。
- **修改**：Search 四频道支持 `fresh` 参数与分页 SQLite 缓存。
- **修改**：[`discovery-repo-list.tsx`](../frontend/src/components/discovery/discovery-repo-list.tsx) — 趋势两阶段加载：先展示 RSS，后台调用 enrich 合并；刷新传 `fresh=true`。
- **验证**：`pytest backend/tests/test_discovery.py` — 10 passed；`npm run build` — 通过；已更新 [`contracts/openapi.json`](../contracts/openapi.json)。

### 9) 发现中心体验修复（stars 覆盖 / Skeleton / 卡片操作栏）

- **修复**：enrich 合并时保留 RSS 的 stars/forks，仅补 language/topics；前端 enrich 请求携带 RSS stub 字段。
- **修改**：切换时间范围/频道时 `isPending` 即显示 Skeleton 列表（标题与工具条立即切换）。
- **修改**：[`discovery-repo-card.tsx`](../frontend/src/components/discovery/discovery-repo-card.tsx) — GitHub / Zread / 已收录 同一行，已收录在最右。

### 10) 趋势 star/fork 与切换即时 Skeleton（RSS 格式变更）

- **根因**：GitHubTrendingRSS 描述中已不再含 ⭐/🍴，RSS 解析 stars 恒为 0；需 enrich 从 GitHub API 补全；旧 repo 缓存命中时跳过补全。
- **修复**：`stars==0` 时继续 enrich；合并时 RSS 有值优先、否则用 GitHub；缓存命中但 stars 仍为 0 时重新请求。
- **修复**：切换 tab/频道用 `paramsKey` vs `settledParamsKey` 立即 Skeleton；时间范围 Toggle 乐观更新 UI。

### 11) 发现中心交互、滚动与刷新策略

- **修改**：[`discovery-repo-list.tsx`](../frontend/src/components/discovery/discovery-repo-list.tsx) — 列表 **IntersectionObserver** 无限滚动；列表区独立滚动（`main` 在发现页 `overflow-hidden`）；移除重复频道说明文案。
- **新建**：[`discovery-header.tsx`](../frontend/src/context/discovery-header.tsx)、[`discovery-panel-chrome.tsx`](../frontend/src/components/discovery/discovery-panel-chrome.tsx) — 顶栏注册频道名、结果数、刷新/enrich 状态；与资料库顶栏统一 **`h-12`**。
- **新建**：[`discovery-last-refresh.ts`](../frontend/src/lib/discovery-last-refresh.ts) — 各频道上次刷新时间（`localStorage`）；**5 分钟冷却**（非手动 `fresh` 跳过）；侧栏相对时间格式化（**刚刚** / **15 分钟粒度** / 小时天周月）。
- **修改**：[`discovery-sidebar.tsx`](../frontend/src/components/discovery/discovery-sidebar.tsx) — 「刷新全部」走与顶栏相同的 **`fresh=true`** 链路；刷新中图标旋转；再次点击当前频道为手动 fresh 刷新。
- **修改**：[`app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx) — 发现页锁定 `html/body` 全局滚动；[`discovery-channel-toolbar.tsx`](../frontend/src/components/discovery/discovery-channel-toolbar.tsx) — 无工具条的频道不渲染占位行。
- **修复**：顶栏 context 存 React 元素导致无限重渲染白屏；「刷新全部」此前仅 `invalidate` 未带 `fresh` 致假刷新。

### 12) 发现列表 → 预览/详情页

- **新建**：[`backend/app/services/discovery_repo_content.py`](../backend/app/services/discovery_repo_content.py) — 仅凭 `owner/repo` 从 GitHub 拉 README / Release（不写 `projects` 表）。
- **新增 API**：`GET /api/discovery/repos/{owner}/{repo}/readme`、`/releases`（同形 `ProjectReadmeRead` / `ProjectReleasesRead`）。
- **新建**：[`frontend/src/pages/discovery/repo-detail.tsx`](../frontend/src/pages/discovery/repo-detail.tsx)、[`discovery-repo-detail-*.tsx`](../frontend/src/components/discovery/) — 预览详情（英雄区 + README / Release / 笔记占位）；路由 **`/discovery/r/:owner/:repo`**。
- **修改**：[`discovery-repo-card.tsx`](../frontend/src/components/discovery/discovery-repo-card.tsx) — 卡片点击进入预览或已收录项目详情；GitHub / Zread / 加入资料库 **`stopPropagation`**。
- **修改**：[`project-detail-panel-chrome.tsx`](../frontend/src/components/layout/project-detail-panel-chrome.tsx)、[`projects/detail.tsx`](../frontend/src/pages/projects/detail.tsx) — 从发现进入时顶栏/错误页 **返回发现**。
- **验证**：`pytest backend/tests/test_discovery.py` — 16 passed；`npm run build` — 通过；已更新 [`contracts/openapi.json`](../contracts/openapi.json)。

### 13) 发现预览简介显示与临时翻译

- **修复**：[`discovery_enrich.py`](../backend/app/services/discovery_enrich.py)、[`discovery-repo-list.tsx`](../frontend/src/components/discovery/discovery-repo-list.tsx) — enrich 合并 **`description` 优先 GitHub API 短简介**，避免趋势 RSS 长 `<description>` 覆盖。
- **新建**：[`discovery-repo-description.tsx`](../frontend/src/components/discovery/discovery-repo-description.tsx) — 与卡片一致的 **`line-clamp-2`** + 展开/收起；Sparkles **临时翻译**（仅组件 state，刷新即失）。
- **新建**：[`backend/app/api/translation.py`](../backend/app/api/translation.py) — `POST /api/translation/translate-text`（不落库）；[`translate-plain-text.ts`](../frontend/src/lib/translate-plain-text.ts)。
- **验证**：`pytest backend/tests/test_discovery.py tests/test_translation.py` — 通过；`npm run build` — 通过。

### 14) 发现侧栏「上次刷新」与 5 分钟冷却修复

- **修复**：[`discovery-repo-list.tsx`](../frontend/src/components/discovery/discovery-repo-list.tsx) — 被动加载（切换频道、首次进入）成功后 **`markChannelRefreshed`**，侧栏时间不再长期停留在旧值；冷却判断由此生效。
- **修改**：[`discovery-sidebar.tsx`](../frontend/src/components/discovery/discovery-sidebar.tsx) — 相对时间 tick 30s，便于「刚刚」→「15分钟前」过渡。

### 15) 发现列表简介改用 GitHub 短 description

- **修复**：[`discovery_trending.py`](../backend/app/services/discovery_trending.py) — RSS 解析**不再**把 `<description>` 正文写入 `description`（仅用于解析 Star/Fork）。
- **修复**：[`discovery_enrich.py`](../backend/app/services/discovery_enrich.py) — 识别 RSS 聚合长文、`pick_repo_description` 优先 GitHub；含 RSS 长简介时仍触发 enrich。
- **新建**：[`discovery-display.ts`](../frontend/src/lib/discovery-display.ts) — 卡片/预览过滤 RSS 长文；enrich 完成前显示 Skeleton。
- **验证**：`pytest backend/tests/test_discovery.py` — 19 passed；`npm run build` — 通过。旧 SQLite 趋势缓存可手动 **刷新**（`fresh=true`）加速生效。

### 16) 发现列表返回后滚动位置恢复

- **修复**：[`discovery/layout.tsx`](../frontend/src/pages/discovery/layout.tsx) — 进入 **`/discovery/r/...` 预览** 时列表 **保持挂载**（`hidden`），不再卸载重建，滚动位置自然保留；预览叠层时用 `locationOverride` 冻结列表 query 参数。
- **修改**：[`discovery-repo-list.tsx`](../frontend/src/components/discovery/discovery-repo-list.tsx) — `locationOverride` / `inactive`；离开发现区（如进入 `/projects/:id`）仍用 `sessionStorage` + 锚点滚动恢复；仅在实际到位时标记 `scrollRestored`。
- **验证**：`npm run build` — 通过。手工：趋势列表滚至中间 → 点进预览 → 顶栏返回，应回到原位置。

---

## 代码变更（桌面外链等）


- **修改**：[`src-tauri/Cargo.toml`](../src-tauri/Cargo.toml)、[`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) — 注册 `tauri-plugin-opener`。
- **修改**：[`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json) — `opener:allow-default-urls`。
- **新建**：[`frontend/src/lib/open-external-url.ts`](../frontend/src/lib/open-external-url.ts)、[`frontend/src/components/common/external-link.tsx`](../frontend/src/components/common/external-link.tsx) — 桌面壳内 `openUrl`，浏览器仍 `target=_blank`。
- **修改**：项目详情、Release/README Tab、卡片、看板等处的 GitHub / Zread 外链改用 `ExternalLink`；Markdown 外链同步处理。
- **测试**：[`frontend/src/lib/open-external-url.test.ts`](../frontend/src/lib/open-external-url.test.ts)。

### 6) README / Release 按 Tab 懒同步

- **修改**：[`frontend/src/context/project-github-cache.tsx`](../frontend/src/context/project-github-cache.tsx) — 仅在首次打开 README / Release Tab 时读缓存并后台 `fresh` 一次；关闭 `refetchOnWindowFocus` 等自动重拉。
- **修改**：[`project-detail-tabs.tsx`](../frontend/src/components/project/detail/project-detail-tabs.tsx)、[`project-detail-more-info.tsx`](../frontend/src/components/project/detail/project-detail-more-info.tsx) — 传入 `activeTab`；未打开的 Tab 显示「打开 Tab 后同步」。

---

## 代码变更（桌面外链等）

### 3) README 解析改进与数据库缓存

- **新建**：[`frontend/src/lib/readme-media-resolve.ts`](../frontend/src/lib/readme-media-resolve.ts) — `readmeRawBaseUrl` / `resolveReadmeImageSrc`（支持子目录 README base）。
- **修改**：[`frontend/src/components/project/detail/markdown-content.tsx`](../frontend/src/components/project/detail/markdown-content.tsx) — `rehype-raw`、自定义 `img`（错误重试）、`enableHtml` 开关。
- **修改**：[`frontend/src/components/project/detail/project-readme-tab.tsx`](../frontend/src/components/project/detail/project-readme-tab.tsx) — stale-while-revalidate（`fresh=false` → 后台 `fresh=true`）；同步状态条；右键「从 GitHub 刷新」。
- **修改**：[`frontend/src/components/project/detail/project-releases-tab.tsx`](../frontend/src/components/project/detail/project-releases-tab.tsx) — Release body 传入 `githubUrl` 以解析相对图片。
- **修改**：[`backend/app/models/project.py`](../backend/app/models/project.py) — `readme_cached` / `readme_cached_at` / `readme_github_sha` / `readme_cached_path`。
- **修改**：[`backend/app/services/github_client.py`](../backend/app/services/github_client.py) — `fetch_readme_from_github`（JSON + sha）。
- **修改**：[`backend/app/services/project_github_content.py`](../backend/app/services/project_github_content.py) — 缓存读写、`GET /readme?fresh=`；sha 变更清空 `readme_translated`。
- **修改**：[`backend/app/services/project_translate.py`](../backend/app/services/project_translate.py) — 翻译/blocks 优先读缓存。
- **测试**：[`backend/tests/test_project_readme_cache.py`](../backend/tests/test_project_readme_cache.py)、[`frontend/src/lib/readme-media-resolve.test.ts`](../frontend/src/lib/readme-media-resolve.test.ts)。

### 4) Release 列表缓存

- **修改**：[`backend/app/models/project.py`](../backend/app/models/project.py) — `releases_cached` / `releases_cached_at` / `releases_cache_fingerprint`。
- **修改**：[`backend/app/services/project_github_content.py`](../backend/app/services/project_github_content.py) — `GET /releases?fresh=` 缓存读写。
- **新建**：[`frontend/src/context/project-github-cache.tsx`](../frontend/src/context/project-github-cache.tsx) — README + Release 统一 stale-while-revalidate Provider。
- **修改**：[`frontend/src/components/project/detail/project-releases-tab.tsx`](../frontend/src/components/project/detail/project-releases-tab.tsx) — 使用 Provider 数据；右键「从 GitHub 刷新」。
- **修改**：[`frontend/src/components/project/detail/project-detail-more-info.tsx`](../frontend/src/components/project/detail/project-detail-more-info.tsx) — 「Release 缓存」元数据行。
- **测试**：[`backend/tests/test_project_releases_cache.py`](../backend/tests/test_project_releases_cache.py)。

---

## 代码变更（早先）

### 1) Release Tab 行布局与说明 pill

- **修改**：[`frontend/src/components/project/detail/project-releases-tab.tsx`](../frontend/src/components/project/detail/project-releases-tab.tsx)  
  - 附件列 `shrink-[999]`，缩窄时优先压缩「N 个文件」按钮。  
  - 项目信息 + Release 标题 `gap-6 sm:gap-8`；附件 Popover 与按钮同宽。  
  - Release 说明：去掉顶栏「展开说明」行，改为卡片底边 **sticky pill**（`group/release` 悬停显示）。

### 2) README Tab 右侧目录导航

- **新建**：[`frontend/src/lib/markdown-toc.ts`](../frontend/src/lib/markdown-toc.ts) — 标题 slug、DOM 同步、`scrollToMarkdownHeading`（滚动 `main`）。
- **新建**：[`frontend/src/components/project/detail/readme-toc-panel.tsx`](../frontend/src/components/project/detail/readme-toc-panel.tsx) — 目录侧栏；sticky **竖形 pill**（`h-20 w-5`）统一展开/收起，侧栏宽度随 pill 切换动画；收起时靠右缘悬停显示。
- **修改**：[`frontend/src/components/project/detail/markdown-content.tsx`](../frontend/src/components/project/detail/markdown-content.tsx) — 标题 `id` / `data-readme-heading` 锚点。
- **修改**：[`frontend/src/components/project/detail/project-readme-tab.tsx`](../frontend/src/components/project/detail/project-readme-tab.tsx) — 双栏布局；`useLayoutEffect` 从 DOM 同步目录；右缘 `mousemove` 触发 pill。
- **文档**：[`README.md`](../README.md) 项目详情 README / Release 小节。

---

## 验证记录

- **自动化**：`cd frontend && npm run build`；`cd frontend && npm run test`；`cd backend && pytest tests/test_project_readme_cache.py tests/test_project_releases_cache.py tests/test_readme_path.py tests/test_discovery.py`；`python scripts/export_openapi.py`。
- **手工**：Release Tab — 缩窄窗口附件按钮先变窄；悬停 Release 行见说明 pill；二次打开 Release 秒开缓存并后台同步；「更多信息」可见 Release 缓存状态；README Tab — 靠近右缘见扁形 pill；README 相对路径/HTML 图片可加载；二次打开 README 秒开缓存并后台同步；原文变更后译文被清空。**发现中心** — `/discovery/trending` 列表滚动不带动全局滚动条；滚到底自动加载下一页；顶栏显示频道名与结果数；手动刷新图标旋转且请求 `fresh=true`；5 分钟内切换频道不重复 fresh；侧栏刷新时间 5 分钟内为「刚刚」、之后按 15 分钟粒度；**单击未收录卡片** → 预览页 README/Release 可加载且顶栏返回发现；**已收录卡片** → `/projects/:id` 且返回发现；卡片右侧按钮不触发导航；**列表滚至中间进预览再返回**应回到原滚动位置。
