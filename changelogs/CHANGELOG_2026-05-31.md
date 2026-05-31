# 更新日志（2026-05-31）

## 范围

- **发现列表滚动恢复（经验归档）**：从发现频道进入仓库预览再返回时，应回到进入前的列表滚动位置。实现与踩坑经验写入本文，供后续类似「列表 → 详情 → 返回」场景复用（实现落点见 [2026-05-30 §16](./CHANGELOG_2026-05-30.md)）。
- **发现列表回到顶部**：列表区右下角悬浮按钮，滚动超过约 320px 后出现，平滑滚回顶部并清除已存滚动位置。
- **发现频道精简**：移除与「主题探索」重叠的「搜索发现」频道；旧 `/discovery/search` 重定向至 `/discovery/topic`（`?q=` 映射为 `?topic=`）。
- **发现卡片 GitHub 链接**：`owner/repo` 外链改为 **inline-block**，可点区域仅包裹文字，避免整行误触跳转 GitHub。
- **README 徽章横排**：修复 Tailwind 预检 `img{display:block}` 导致标题/链接内徽章竖排；链接内图片 inline-block，含徽章的 `h1`/`p` 使用 flex 横排。
- **主题探索搜索增强**：输入**中文**时同时搜中英文；输入**标签分类名**（含「未分类」）时按全库标签使用量 Top 8 扩展为多 Topic OR 搜索。
- **发现侧栏刷新时间**：**主题探索**、**最受欢迎**不再显示「上次刷新」；主题探索不参与被动刷新标记；最受欢迎仅在进入频道且不在 5 分钟冷却内时更新刷新时间。
- **欢迎页与 PAT 门控**：首次进入（或清除 Token 后）展示全屏欢迎页——左侧 Carousel 介绍产品能力，右侧输入 GitHub PAT；校验通过后保存并进入主界面；若环境变量 `GITHUB_TOKEN` 已生效则跳过欢迎页。
- **功能区左下角账户菜单**：语雀式头像触发 Popover（GitHub Token 弹窗、设置、语雀式主题循环钮、退出连接）；`GET /api/settings/github/profile` 拉取 GitHub 用户信息。
- **GitHub Token 独立弹窗**：从设置页剥离；各处「配置 Token」改为打开全局弹窗；旧 `/settings#github` 自动唤起弹窗。
- **主题循环按钮**：欢迎页顶栏、账户菜单 footer、设置 → 通用 统一为单个小方钮，点击在浅色 / 深色 / 跟随系统间循环。
- **欢迎页轮播精修**：占满左侧栏（约 62:38 分栏）；左右边缘点击区翻页、滚轮翻页、悬停显示箭头；圆点指示保留。
- **进入工具默认落点**：根路径进入**上次打开的项目库**（校验仍存在）；无记录或库已删则进入 **`/libraries`** 目录页。

---

## 代码变更

### 20) 进入工具默认落点（上次项目库）

- **新建**：[`frontend/src/lib/app-home.ts`](../frontend/src/lib/app-home.ts) — `resolveAppHomePath()`：读取 `projectPilot.lastProjectLibraryId`，`GET /api/project-libraries/{id}` 校验存在后进入该库，否则清除记录并进入目录页。
- **修改**：[`frontend/src/components/routing/library-redirect.tsx`](../frontend/src/components/routing/library-redirect.tsx) — 根路径 `/`、旧 `/library` 异步解析落点（短暂「正在进入…」）。
- **修改**：[`frontend/src/context/project-library.tsx`](../frontend/src/context/project-library.tsx) — 导出 `clearLastProjectLibraryId`；进入 `/libraries/:id` 时仍由 [`project-library-route-shell.tsx`](../frontend/src/components/layout/project-library-route-shell.tsx) 写入上次 id。

---

### 19) 欢迎页轮播布局与交互精修

- **修改**：[`frontend/src/pages/welcome/welcome-page.tsx`](../frontend/src/pages/welcome/welcome-page.tsx) — 桌面端分栏约 **1.65 : 1**（轮播区更宽）。
- **修改**：[`frontend/src/components/welcome/welcome-carousel.tsx`](../frontend/src/components/welcome/welcome-carousel.tsx) — 轮播占满左侧；去掉带边框 Prev/Next，改为左右 **19%** 透明点击区 + 悬停显示 Chevron；**滚轮**翻页（约 420ms 冷却）；文案与图标略放大。
- **修改**：[`frontend/src/config/welcome-slides.ts`](../frontend/src/config/welcome-slides.ts) — 项目库页描述微调。

---

### 18) 主题循环按钮（ThemeCycleButton）

- **新建**：[`frontend/src/components/common/theme-cycle-button.tsx`](../frontend/src/components/common/theme-cycle-button.tsx)、[`frontend/src/lib/theme-cycle.ts`](../frontend/src/lib/theme-cycle.ts) — 语雀式 **32×32** 边框小方钮，循环浅色 / 深色 / 跟随系统。
- **修改**：[`frontend/src/components/layout/rail-user-menu.tsx`](../frontend/src/components/layout/rail-user-menu.tsx) — 主题钮置于 Popover **footer** 右侧。
- **修改**：[`frontend/src/components/settings/appearance-settings-section.tsx`](../frontend/src/components/settings/appearance-settings-section.tsx) — 替换三按钮 ToggleGroup。
- **修改**：[`frontend/src/pages/welcome/welcome-page.tsx`](../frontend/src/pages/welcome/welcome-page.tsx) — 顶栏统一 ThemeCycleButton。

---

### 17) GitHub Token 独立弹窗

- **新建**：[`frontend/src/context/github-settings-dialog.tsx`](../frontend/src/context/github-settings-dialog.tsx)、[`frontend/src/components/settings/github-settings-dialog.tsx`](../frontend/src/components/settings/github-settings-dialog.tsx)、[`frontend/src/components/settings/github-token-settings-form.tsx`](../frontend/src/components/settings/github-token-settings-form.tsx)、[`frontend/src/components/common/github-settings-link.tsx`](../frontend/src/components/common/github-settings-link.tsx) — 全局弹窗；`GithubSettingsLink` / `GithubSettingsButton` 替代原 `/settings#github` 链接。
- **修改**：[`frontend/src/App.tsx`](../frontend/src/App.tsx) — `GithubSettingsDialogProvider` 包裹路由；`#github` hash 自动打开弹窗。
- **修改**：[`frontend/src/pages/settings/index.tsx`](../frontend/src/pages/settings/index.tsx)、[`frontend/src/lib/settings-sections.ts`](../frontend/src/lib/settings-sections.ts) — 设置页仅 **通用 / 翻译**；移除 GitHub 分区。
- **删除**：[`frontend/src/components/settings/github-settings-section.tsx`](../frontend/src/components/settings/github-settings-section.tsx)。
- **修改**：发现侧栏、README/Release 错误态、账户菜单等入口改为打开弹窗。

---

### 16) 功能区左下角语雀式账户菜单

- **新建**：[`frontend/src/components/layout/rail-user-menu.tsx`](../frontend/src/components/layout/rail-user-menu.tsx) — 左下角 **仅头像**；Popover 含 GitHub 用户、`KeyRound` + GitHub Token、设置、footer 主题钮与退出连接。
- **新建**：[`frontend/src/components/ui/avatar.tsx`](../frontend/src/components/ui/avatar.tsx)。
- **修改**：[`frontend/src/components/layout/function-rail.tsx`](../frontend/src/components/layout/function-rail.tsx) — 移除「更多」下拉，底部改为 `RailUserMenu`。
- **新建**：`GET /api/settings/github/profile` — 返回 GitHub `login` / `name` / `avatar_url` / `html_url`（[`backend/app/api/settings.py`](../backend/app/api/settings.py)、[`backend/app/services/github_client.py`](../backend/app/services/github_client.py)）。
- **修改**：[`frontend/src/lib/settings-github.ts`](../frontend/src/lib/settings-github.ts) — `fetchGithubProfile`。
- **契约**：已更新 [`contracts/openapi.json`](../contracts/openapi.json)。

---

### 15) 欢迎页 Carousel + GitHub PAT 硬门控

- **新建**：[`frontend/src/components/welcome/welcome-gate.tsx`](../frontend/src/components/welcome/welcome-gate.tsx) — 启动时 `GET /api/settings/github`；`has_token=false` 时拦截全部路由并渲染欢迎页。
- **新建**：[`frontend/src/pages/welcome/welcome-page.tsx`](../frontend/src/pages/welcome/welcome-page.tsx) — 左右分栏（移动端纵向堆叠）：Carousel + PAT 面板；顶栏 PP 品牌与主题切换。
- **新建**：[`frontend/src/components/welcome/welcome-carousel.tsx`](../frontend/src/components/welcome/welcome-carousel.tsx)、[`frontend/src/config/welcome-slides.ts`](../frontend/src/config/welcome-slides.ts) — 四页产品介绍（定位 / 项目库 / 发现 / 看板）；Embla Carousel + 圆点与箭头。
- **新建**：[`frontend/src/components/welcome/welcome-pat-panel.tsx`](../frontend/src/components/welcome/welcome-pat-panel.tsx)、[`frontend/src/hooks/use-github-pat-connect.ts`](../frontend/src/hooks/use-github-pat-connect.ts) — 先 `POST /github/test`（带 token）再 `PUT` 保存；成功后 invalidate 并进入主界面。
- **新建**：[`frontend/src/components/ui/carousel.tsx`](../frontend/src/components/ui/carousel.tsx)（shadcn 风格，依赖 `embla-carousel-react`）。
- **修改**：[`frontend/src/App.tsx`](../frontend/src/App.tsx) — 用 `WelcomeGate` 包裹全部 `Routes`。
- **修改**：[`frontend/src/lib/settings-github.ts`](../frontend/src/lib/settings-github.ts) — `postGithubTest(token?)` 支持请求体；后续 PAT 表单见 §17 独立弹窗。
- **修改**：[`backend/app/api/settings.py`](../backend/app/api/settings.py)、[`backend/app/schemas/settings_github.py`](../backend/app/schemas/settings_github.py) — `POST /github/test` 可选 body `{ token }` 测试未保存 Token。
- **新建**：[`backend/tests/test_settings_github.py`](../backend/tests/test_settings_github.py)。
- **契约**：已执行 `python scripts/export_openapi.py`，更新 [`contracts/openapi.json`](../contracts/openapi.json)。

---

### 1) 问题与背景

- **场景**：发现中心列表在**独立滚动容器**内（`main` 在 `/discovery` 下 `overflow-hidden`，仅列表区 `overflow-y-auto`）；用户滚至中间 → 点卡片进 `/discovery/r/:owner/:repo` 预览 → 顶栏返回。
- **预期**：回到原滚动位置，且已加载的分页/enrich 状态尽量保留。
- **初版方案**：`sessionStorage` + 内存 Map 按 `pathname + search` 存 `scrollTop`；离开前保存、返回后 `useLayoutEffect` 恢复，不足高度时 `fetchNextPage` 补页。

### 2) 为何「存 scrollTop + 返回后恢复」不可靠

- **列表会卸载**：React Router 切换 `/discovery/trending` ↔ `/discovery/r/...` 时，原 `DiscoveryRepoList` 整棵子树卸载；返回时是新实例，`scrollTop` 从 0 开始。
- **卸载时 scrollTop 常为 0**：路由切换后 DOM 已拆，`listScrollRef.current?.scrollTop` 在 cleanup 里读到 0；若 `scrollTop <= 0` 时**覆盖/删除**已存记录，会把有效位置清掉。
- **异步内容高度不稳定**：趋势频道 enrich 分批回填 stars/language/description，卡片高度变化；无限列表需多页才够 `scrollHeight`，恢复时机与「是否已 enrich 完」强耦合，多轮 retry 仍易失败或误判「已恢复」。
- **滚动容器不是 window**：React Router 默认 `ScrollRestoration` 只管 window；发现区滚动在**内层 div**，必须显式处理。

### 3) 最终方案：预览叠层时保持列表挂载（keep-alive）

- **原则**：**同一 React 实例 + 同一 DOM 滚动容器** 不卸载，比事后猜 `scrollTop` 更可靠。
- **布局**：[`discovery/layout.tsx`](../frontend/src/pages/discovery/layout.tsx) 统一渲染「列表 + 可选预览」：
  - 频道页：只显示列表。
  - 预览页：列表包在 `hidden` 容器内**仍挂载**，上方/并列渲染 `DiscoveryRepoDetailPage`。
  - 返回频道：去掉 `hidden`，**同一列表实例**重新可见，滚动位置自然保留。
- **路由**：[`App.tsx`](../frontend/src/App.tsx) 中 `r/:owner/:repo` 与 `:channelId` 使用 `DiscoveryRoutePlaceholder` 占位，实际 UI 由 `DiscoveryLayout` 按 `pathname` 决定，避免 Outlet 切换导致列表 unmount。

### 4) 预览叠层时的两个必要配套

- **`locationOverride`**（[`discovery-repo-list.tsx`](../frontend/src/components/discovery/discovery-repo-list.tsx)）：预览 URL 为 `/discovery/r/...`，无 `?range=weekly` 等 query。若列表仍读当前 `useLocation()`，会错用 query、错发请求。叠层期间用 `location.state.from`（进入预览前保存的列表路径）冻结 `pathname + search`。
- **`inactive`**：列表隐藏时暂停无限滚动 IntersectionObserver、侧栏「上次刷新」被动标记等副作用，避免后台误触发 `fetchNextPage` 或刷新计数。

### 5) 离开发现区时的兜底（如 `/projects/:id`）

- 进入**项目详情**会离开 `/discovery`，列表无法 keep-alive，仍保留 `sessionStorage` + 导航前 `saveScrollNow()`。
- **保存**：滚动时 debounce 写入；点击卡片/星形进详情前**同步**保存；`scrollTop <= 0` **不覆盖**已有记录；卸载时用 `lastScrollTopRef` 而非可能已为 0 的 DOM。
- **恢复**：`useLayoutEffect` 多帧 retry + 按需 `fetchNextPage`；**仅当** `|scrollTop - saved| <= 2` 才标记 `scrollRestored`，避免 enrich 未完成时误判成功。

### 6) 可复用的检查清单（其它列表 → 详情）

1. 滚动发生在哪个元素？（发现区是列表 div，不是 `main` / `window`。）
2. 进详情是 **同一路由树下 hide** 还是 **跨路由 unmount**？前者优先 keep-alive；后者才依赖存储恢复。
3. 详情页 URL 与列表 query 是否一致？不一致则需要 `locationOverride` 或 ref 冻结列表上下文。
4. 列表是否有**异步增高**（enrich、图片、分页）？keep-alive 可规避大部分问题；若必须 remount，考虑存 **锚点条目**（如 `full_name`）而不只存 `scrollTop`。
5. 隐藏列表时是否暂停 observer / 定时器 / 刷新副作用？

### 7) 发现列表「回到顶部」悬浮按钮

- **修改**：[`discovery-repo-list.tsx`](../frontend/src/components/discovery/discovery-repo-list.tsx) — 列表滚动超过 **320px** 时在右下角显示圆形 `ArrowUp` 按钮；`scrollTo({ behavior: "smooth" })`；同时 **`clearDiscoveryListScroll`**，避免用户主动回顶后仍被旧位置恢复；预览叠层（`inactive`）与 Skeleton 时不显示。
- **修复**：回顶动画期间用 `scrollingToTopRef` 锁定按钮可见性，并用 `opacity` 过渡替代挂载/卸载，消除点击后闪烁。

### 8) 移除「搜索发现」频道

- **原因**：与 **主题探索** 同为 GitHub Search，关键词搜索与 `topic:` 查询重叠，侧栏入口冗余。
- **修改**：[`types/discovery.ts`](../frontend/src/types/discovery.ts)、[`discovery-sidebar.tsx`](../frontend/src/components/discovery/discovery-sidebar.tsx)、[`discovery-channel-toolbar.tsx`](../frontend/src/components/discovery/discovery-channel-toolbar.tsx)、[`discovery-repo-list.tsx`](../frontend/src/components/discovery/discovery-repo-list.tsx)、[`discovery-api.ts`](../frontend/src/lib/discovery-api.ts) — 发现区改为 **四频道**。
- **修改**：[`discovery/layout.tsx`](../frontend/src/pages/discovery/layout.tsx) — `/discovery/search` → `/discovery/topic`（`q` → `topic`）。
- **删除**：[`backend/app/api/discovery.py`](../backend/app/api/discovery.py) `GET /discovery/search`；[`discovery_search.py`](../backend/app/services/discovery_search.py) `build_search_query`。
- **契约**：已更新 [`contracts/openapi.json`](../contracts/openapi.json)。

### 9) 发现卡片 GitHub 链接点击区域

- **修改**：[`discovery-repo-card.tsx`](../frontend/src/components/discovery/discovery-repo-card.tsx)、[`discovery-repo-detail-header.tsx`](../frontend/src/components/discovery/discovery-repo-detail-header.tsx) — `owner/repo` 外链由 `block` 改为 **`inline-block max-w-full truncate`**，可点范围仅包裹文字；空白区域点击仍进入卡片预览。

### 10) README 标题区徽章横排

- **原因**：Tailwind 预检将 **`img` 设为 `display:block`**，README 标题/链接内的 shields 徽章被竖向堆叠；部分仓库还在徽章间使用 `<br>`。
- **修改**：[`markdown-content.tsx`](../frontend/src/components/project/detail/markdown-content.tsx) — 链接内图片 **`inline-block`**；含图片的 **`h1`/`p` 使用 flex 横排**并隐藏内部 `<br>`；正文段落内独立大图仍为块级；支持 `h1 align=center`。

### 11) 主题探索搜索增强

- **新建**：[`discovery_topic_query.py`](../backend/app/services/discovery_topic_query.py) — 分类名/「未分类」→ 跨项目库合并标签、按 usage Top 8 构建 `topic:a OR topic:b`；中文输入 → 译英 + `in:name,description,topics` 双语 query。
- **修改**：[`translation_ephemeral.py`](../backend/app/services/translation_ephemeral.py) — `translate_to_english_for_search`（固定 target=en）。
- **修改**：[`discovery.py`](../backend/app/api/discovery.py) `GET /topic` 返回 `search_meta`；[`schemas/discovery.py`](../backend/app/schemas/discovery.py) — `DiscoveryTopicSearchMetaRead`。
- **修改**：[`discovery-repo-list.tsx`](../frontend/src/components/discovery/discovery-repo-list.tsx)、[`discovery-topic-search-meta.ts`](../frontend/src/lib/discovery-topic-search-meta.ts)、[`discovery-channel-toolbar.tsx`](../frontend/src/components/discovery/discovery-channel-toolbar.tsx) — 顶栏展示扩展说明；placeholder 提示 Topic/中文/分类名。
- **测试**：[`test_discovery_topic_query.py`](../backend/tests/test_discovery_topic_query.py) — 8 passed；`pytest tests/test_discovery.py` — 通过；已更新 [`contracts/openapi.json`](../contracts/openapi.json)。

### 12) 发现侧栏刷新时间显示范围

- **修改**：[`discovery-last-refresh.ts`](../frontend/src/lib/discovery-last-refresh.ts) — `showsDiscoverySidebarRefresh` 仅 **趋势 / 热门发布** 展示侧栏时间。
- **修改**：[`discovery-sidebar.tsx`](../frontend/src/components/discovery/discovery-sidebar.tsx) — **主题探索**、**最受欢迎** 隐藏「刚刚 / N 分钟前」。
- **修改**：[`discovery-repo-list.tsx`](../frontend/src/components/discovery/discovery-repo-list.tsx) — 主题探索不被动 `markChannelRefreshed`；最受欢迎在 **5 分钟冷却内** 再次进入不重复标记。

---

## 验证记录

- **自动化**：`cd frontend && npm run build` — 通过。
- **手工**：`/discovery/trending` 滚至中间 → 点未收录卡片进预览 → 顶栏「返回发现」→ 回到原滚动位置；已加载分页仍在；切换 `range` 后行为正常；向下滚动后出现右下角「回到顶部」按钮，点击平滑回顶。**主题探索** — 输入分类名（如资料库内已有分类）→ 顶栏显示扩展 Topic 列表；输入中文 → 显示中英双语搜索说明。

---

### 14) 设置页改为语雀式单页锚点导航

- **重构**：[`settings-layout.tsx`](../frontend/src/components/layout/settings-layout.tsx) — 左侧锚点导航 + 右侧单页滚动；点击分区平滑滚动，滚动时高亮当前项。
- **新建**：[`pages/settings/index.tsx`](../frontend/src/pages/settings/index.tsx)、[`settings-section.tsx`](../frontend/src/components/settings/settings-section.tsx)、[`settings-row.tsx`](../frontend/src/components/settings/settings-row.tsx)、各分区组件（通用 / 翻译）。
- **删除**：原 `/settings/github`、`/settings/translation` 子路由页面；旧路径自动重定向至 `/settings#…`。
- **后续（§17）**：GitHub 分区移出设置页，改为独立弹窗；旧 `#github` hash 唤起弹窗。

---

### 13) 移除功能区「项目列表」与「模拟书架」

- **删除**：[`function-rail.tsx`](../frontend/src/components/layout/function-rail.tsx) 中 `/projects`、`/projects/mock-shelf` 入口。
- **删除**：[`pages/projects/list.tsx`](../frontend/src/pages/projects/list.tsx)、[`pages/projects/mock-shelf.tsx`](../frontend/src/pages/projects/mock-shelf.tsx) 及对应路由；`/projects` 重定向至 `/projects/board`。
- **保留**：看板（`/projects/board`）、项目详情（`/projects/:id`）。

---

## 21. GitHub Token 弹窗排版精简

- **范围**：[`github-token-settings-form.tsx`](../frontend/src/components/settings/github-token-settings-form.tsx)、[`github-settings-dialog.tsx`](../frontend/src/components/settings/github-settings-dialog.tsx)
- **主界面**：连接状态改为紧凑 badge（已连接 / 未配置）；PAT 输入 + 保留「在 GitHub 创建 Token」外链；主操作「保存并验证」全宽按钮。
- **Hover Card**：权限说明、SQLite 存储、环境变量提示、各按钮含义移至 `HoverHelp`（? 图标悬停查看）。
- **次要操作**：「仅保存」「测试连接」「清除 Token」收为底部 ghost 小按钮，减少视觉噪音；弹窗宽度收窄为 `sm:max-w-md`。

---

## 22. GitHub Token 弹窗二次精简

- **Hover Card**：[`hover-card.tsx`](../frontend/src/components/ui/hover-card.tsx) 内容改为 `Portal` 渲染并提升 `z-index`，避免在 Dialog 内被 `overflow` 截断。
- **输入框**：已保存 Token 默认显示 `xxxxxxxxxxxx` 掩码；聚焦后清空以便输入新 Token。
- **功能收敛**：仅保留「更新」（先验证再保存）与「测试连接」；移除「仅保存」「清除 Token」（与账户菜单「退出连接」重复）。
- **弹窗**：`DialogContent` 改为 `overflow-visible`。

---

## 23. GitHub Token 弹窗间距与反馈

- **间距**：标题区与表单合并说明文案至 `DialogDescription`，`gap-3` + `space-y-1` 收紧标题与副标题间距。
- **外链**：「在 GitHub 创建 Token」移至 PAT 标签行右侧。
- **反馈**：测试连接 / 更新成功与失败改用 Sonner toast，移除弹窗内绿色/红色 status 条。

---

## 24. Hover Card 权限折叠与 Token 掩码长度

- **推荐权限**：Hover Card 内改为按钮展开/收起，默认折叠。
- **掩码长度**：API 新增 `token_length`（数据库 Token 字符数）；输入框掩码按真实长度生成，环境变量回退 40 字符。
- **契约**：已更新 [`contracts/openapi.json`](../contracts/openapi.json)。

---

## 25. 标签分类：「未分类」独立右侧栏

- **布局**：[`tag-management.tsx`](../frontend/src/pages/library/tag-management.tsx) 自定义分类列在左侧横向滚动；「未分类」固定于右侧独立栏。
- **折叠**：右侧栏可折叠为窄条（仍可作为拖放目标）；折叠状态写入 `localStorage`（`projectPilot:tagMgmtUncategorizedCollapsed`）。

---

## 26. 标签分类页双栏布局（参考图 1）

- **布局**：[`tag-management.tsx`](../frontend/src/pages/library/tag-management.tsx)「标签分类」Tab 改为左栏分类列表 + 右栏标签网格；默认选中「未分类」。
- **新组件**：[`tag-category-sidebar.tsx`](../frontend/src/components/library/tag-category-sidebar.tsx)、[`tag-category-tag-grid.tsx`](../frontend/src/components/library/tag-category-tag-grid.tsx)、[`tag-management-shared.tsx`](../frontend/src/components/library/tag-management-shared.tsx)。
- **交互**：右侧 4 列网格（checkbox + 拖柄）；分页（24/48/96）；拖到左侧分类行归类；勾选批量「移动到分类…」。
- **UI**：新增 [`checkbox.tsx`](../frontend/src/components/ui/checkbox.tsx)；categories Tab 使用独立分类/标签搜索，移除页顶全局搜索与页眉「新建分类」（改侧栏底部）。

---

## 27. 标签分类交互打磨

- **侧栏滚动**：分类列表区固定高度 + `main-auto-scrollbar--visible`，超出可滚动。
- **拖拽**：整卡可拖（checkbox 除外）；DragOverlay 左上角对齐指针；碰撞检测改为仅 `pointerWithin`，须松手在分类行上才归类。
- **批量栏**：勾选提示移至标题行右侧，opacity 切换，避免插入挤占布局。

---

## 28. 标签分类样式与分页

- **滚动条/字体**：左右面板共用 [`tag-category-styles.ts`](../frontend/src/components/library/tag-category-styles.ts)（`main-auto-scrollbar--visible`、标题 `text-sm`、搜索框 `h-8 text-xs`）。
- **分页**：默认每页 **20** 条（选项 20/48/96）。
- **拖拽**：移除标签卡拖柄图标，整卡仍可拖。

---

## 29. 分类列表对齐资料库文件夹树样式

- **列表项**：与 [`library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx) 一致——`text-xs`、`min-h-[28px]`、选中 `bg-accent`、悬停 `hover:bg-accent/80`、计数圆角 badge。
- **拖放高亮**：改为 `bg-primary/18` 覆盖层（与文件夹树一致），去掉 ring。
- **容器**：分类列表使用 `<nav aria-label="标签分类列表">` + `px-2 py-2` 与侧栏文件夹树相同。

---

## 30. 标签分类滚动条与 TagChip 样式

- **滚动条**：分类列表与标签网格默认隐藏拇指，滚动时短暂显示（`useAutoScrollbarVisible`，与主内容区一致）。
- **标签样式**：分类网格内标签与「所有标签」Tab 的 `TagChip` 一致（色条、`text-sm`、用量计数）；布局改为 `flex-wrap gap-2`。

---

## 31. 分类网格：去勾选框、去分页、底部批量操作

- **勾选框**：移除标签前 Checkbox；点击标签切换选中（拖拽位移 >4px 时不触发选中）。
- **样式**：提取共享 `TagChipInner`，与「所有标签」Tab 名称/用量间距一致。
- **分页**：移除每页条数与翻页；列表在滚动区内一次展示全部（可搜索过滤）。
- **底部栏**：「全选 / 取消全选」「取消选择」「移动到分类…」；显示已选计数。

---

## 32. 分类网格：批量栏按需显示与 Ctrl 多选提示

- **底部栏**：未选中任何标签时隐藏；有选中项后再显示批量操作区。
- **Ctrl 多选**：普通点击单选（再次点击唯一选中项可取消）；按住 Ctrl（Mac：⌘）点击切换多选。
- **标题旁 HoverHelp**：说明拖拽归类与 Ctrl 多选操作。

---

## 33. 分类网格选中态改为置灰

- 选中标签不再使用 `ring` 描边；使用 `bg-muted/80`、`text-muted-foreground` 与侧栏分类行 muted 灰度一致（色条同步置灰）。

---

## 验证记录

- **自动化**：`pytest backend/tests/test_settings_github.py`（7 passed）；`npm run build`（frontend）。
- **手工**：
  1. 无 Token → 欢迎页 Carousel + PAT；无法直达 `/libraries`。
  2. 有效 PAT → 「连接并进入」→ 进入上次项目库或 `/libraries`。
  3. `GITHUB_TOKEN` 环境变量 → 跳过欢迎页。
  4. 左下角头像 Popover → GitHub Token 弹窗、设置、主题循环钮、退出连接。
  5. 欢迎页轮播：悬停显示箭头、边缘点击与滚轮翻页。
  6. 删除上次打开的项目库后重启 → 进入 `/libraries` 目录页。

---

## 后续建议

- 若资料库主列表也需要「进详情再返回保滚动」，可评估相同 keep-alive 模式（需注意与 Refine / 筛选 query 的 `locationOverride` 配套）。
- 从发现进 `/projects/:id` 再返回的滚动恢复仍依赖 sessionStorage；若反馈不稳，可追加 **锚点 repo** 恢复。
