# GithubStarsManager 竞品分析报告

> 分析对象：[GithubStarsManager](https://github.com/AmintaCCCP/GithubStarsManager)（本地路径：`C:\Users\ly\Desktop\tmp\GithubStarsManager-main\GithubStarsManager-main`）  
> 对比基准：Project Pilot（`frontend/` + `backend/`）  
> 报告日期：2026-05-30

---

## 1. 项目概览

| 维度 | GithubStarsManager | Project Pilot |
|------|-------------------|---------------|
| 定位 | GitHub Star 管理 + AI 分类 + Release 订阅 + 发现中心 | 资料库/项目库管理 + 领域标签 + 项目详情 + **发现中心（五频道，2026-05-30）** |
| 前端 | React + Vite + Zustand + Tailwind | React + Vite + Refine + shadcn/ui |
| 后端 | 可选 Express + SQLite（同步/代理） | FastAPI + SQLite |
| 数据模型 | 以 Star 仓库为中心，IndexedDB 持久化 | 以资料库/文件夹/项目为中心，服务端 DB |
| 桌面 | Electron 打包 | Tauri 桌面壳（sidecar API） |

GithubStarsManager 在 **README 渲染、机器翻译、趋势发现、Wiki 外链** 四条链路上有成熟实现；Project Pilot 已于 **2026-05-30** 落地 **发现中心**（见 §5.8），README 图片与 Zread 外链亦已对齐，**机器翻译** 仍可继续借鉴 Edge 批量等做法。

---

## 2. README 解析与图片加载

### 2.1 GithubStarsManager 的做法

**架构**：README 获取与渲染完全分离——后端（或直连 GitHub API）只返回 Markdown 文本，**所有解析在前端完成**。

| 环节 | 实现 |
|------|------|
| 获取 | `GET /repos/{owner}/{repo}/readme` → Base64 解码为 UTF-8 字符串 |
| 解析库 | `react-markdown` + `remark-gfm` + `remark-breaks` |
| HTML 支持 | `rehype-raw` + `rehype-sanitize`（README 路径启用） |
| 代码高亮 | `highlight.js` 自定义 `CodeBlock` |
| 图片解析 | 自定义 `resolveImageSrc()` + `MarkdownImage` 组件 |
| 链接解析 | 相对链接以 `{html_url}/blob/HEAD/` 为 base |

**图片 URL 解析（核心）**：

```typescript
// MarkdownRenderer.tsx
const resolveImageSrc = (imageSrc: string, baseUrl?: string): string => {
  if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://') || imageSrc.startsWith('//')) {
    return imageSrc;
  }
  if (baseUrl) {
    return new URL(imageSrc, baseUrl + '/raw/HEAD/').href;
  }
  return imageSrc;
};
```

ReadmeModal 传入 `baseUrl={repository.html_url}`，因此 `./images/logo.png` 会解析为：

`https://github.com/{owner}/{repo}/raw/HEAD/images/logo.png`

**MarkdownImage 额外能力**：

- loading / error 状态 + 重试按钮
- 小图 inline、大图居中限高
- 点击 zoom（portal 全屏）、滚轮缩放、拖拽
- 下载（`fetch` + fallback 为 `<a download>`）
- 检测是否包在 `<a>` 内，区分点击行为

**后端边界**：Express proxy 仅转发 `api.github.com`，**不代理 raw 图片**；浏览器直接向 GitHub/CDN 发起 `<img>` 请求。

### 2.2 Project Pilot 的现状

`MarkdownContent`（`frontend/src/components/project/detail/markdown-content.tsx`）：

- 使用 `react-markdown` + `remark-gfm` + `rehype-sanitize`
- **未启用** `rehype-raw` → README 内嵌 HTML（`<img>`、`<div align="center">` 等）不会被解析
- **无自定义 `img` 组件** → 相对路径图片 `src` 保持原样，浏览器无法加载
- 链接解析较完善（`readme-link-resolve.ts` 支持同仓库 Markdown 内链跳转），但**未覆盖图片**
- `readmeBasePath` 已传入（支持子目录 README 导航），但**未用于图片 base 计算**

### 2.3 图片加载失败的根因对照

| 场景 | GithubStarsManager | Project Pilot |
|------|-------------------|---------------|
| 相对路径 `![x](./img/a.png)` | ✅ 解析为 `raw/HEAD/` URL | ❌ 保持 `./img/a.png`，404 |
| HTML `<img src="...">` | ✅ rehype-raw 解析后再 sanitize | ❌ 当作文本或 stripped |
| 子目录 README `docs/README.md` 内 `./img/x.png` | ⚠️ 仍假设根目录（有局限） | ❌ 同上，且 base 信息未用上 |
| 绝对路径 `/assets/x.png` | ⚠️ 会解析到 `github.com/assets/...` | ❌ 无效 |
| shields.io / user-images.githubusercontent.com | ✅ 绝对 URL 原样 | ✅ 若 Markdown 语法正确则可用 |
| 私有仓库图片 | ⚠️ 无 Token，可能 404 | ⚠️ 同 |
| Release body 内相对图片 | ❌ ReleaseCard 未传 baseUrl | ❌ 未传 githubUrl/base |

### 2.4 可借鉴方案（按优先级）

1. **添加 `resolveImageSrc`，自定义 `img` 组件**  
   - 图片 base：`{github_html_url}/raw/HEAD/`  
   - 若存在 `readmeBasePath`（如 `docs/README.md`），base 应改为 `{html_url}/raw/HEAD/docs/`（取 README 所在目录），比对方更精确  
   - 参考：`MarkdownRenderer.tsx` 的 `resolveImageSrc` + `MarkdownImage`

2. **README 路径启用 `rehype-raw`**  
   - 许多 README 使用 `<div align="center">`、`<img width="...">` 等 HTML  
   - 保持 `rehype-sanitize`，按需扩展 schema（允许 `img` 的 `width`/`height`/`align` 等）

3. **错误态与重试**  
   - 图片 onError 显示占位 + 重试，避免空白  
   - 可选：zoom / 下载（UX 加分，非必须）

4. **Release Tab 同步修复**  
   - `project-releases-tab.tsx` 中 `MarkdownContent` 未传 `githubUrl`，Release 内相对图片同样会失败

5. **（可选）私有仓库**  
   - 若需支持私有 repo 图片，需后端 proxy raw 文件并带 Token；双方均未实现，属进阶需求

---

## 3. 翻译机制

### 3.1 GithubStarsManager 的做法

**链路**：Markdown 先完整渲染 → DOM 扫描可译块 → 批量调用 **Microsoft Edge Translator** → 注入双语 DOM。

| 维度 | 细节 |
|------|------|
| API | 浏览器直连 `edge.microsoft.com/translate/auth` + `api-edge.cognitive.microsofttranslator.com` |
| 认证 | JWT 缓存（内存 + localStorage），8 分钟 TTL，提前 5 分钟刷新 |
| 批处理 | UI 层每 10 块一批；服务层单请求最多 100 条 / 50k 字符 |
| 分段 | `domTextScanner` 跳过 `pre`/`code`/`img`；含 inline code 的块走 `textType=html` |
| 语言检测 | 客户端 Unicode 启发式（前 20 块采样） |
| 显示模式 | CSS 切换：原文 / 译文 / 双语（无 re-render） |
| 持久化 | **仅缓存 auth token，不缓存译文** |
| 流式 | 无；全部 API 完成后一次性注入 DOM |

**感觉更快的原因**：

1. 原文立即可读，翻译不阻塞渲染  
2. Edge Translator 为浏览器场景优化，无需 API Key  
3. 批量请求（100 条/次）减少 HTTP 往返  
4. JWT 跨会话复用，省去重复 auth  
5. 进度条 `current/total` 提供反馈  

**感觉慢的场景**：长 README 需等全部批次完成才看到译文；无译文持久化，每次打开重译。

### 3.2 Project Pilot 的现状

| 维度 | 细节 |
|------|------|
| API | 后端 `POST /projects/{id}/translate/readme-block` |
| 引擎 | `deep-translator` → Google 非官方免费通道 |
| 分段 | 后端 `readme/blocks` 按 Markdown 结构切块 |
| 批处理 | 前端逐段串行，段间 `README_BLOCK_TRANSLATE_DELAY_MS = 450ms` |
| 持久化 | ✅ 译文写入 `projects.readme_translated`（SQLite） |
| 流式 | ✅ 渐进式上屏（`progressiveChunks` + skeleton） |
| 重试 | 单段最多 3 次，指数退避 |

### 3.3 对比与建议

| 能力 | GithubStarsManager | Project Pilot | 建议 |
|------|-------------------|---------------|------|
| 首次翻译速度 | 批量 API，较快 | 逐段 + 450ms 延迟 + 后端往返，较慢 | 考虑批量 endpoint 或降低 delay |
| 二次打开 | 需重译 | ✅ 读库 instant | **保持 Project Pilot 优势** |
| 翻译引擎 | MS Edge（免 Key） | Google free（易限流） | 可增加 MS Edge provider 作 fallback |
| 代码块保护 | DOM 扫描 | 后端 Markdown AST | 后端方案更稳，保持 |
| 双语对照 | ✅ 三模式 CSS | 原文/译文 Tab 切换 | 可借鉴 CSS 双语模式 |
| 进度反馈 | 数字进度 | skeleton 逐段 | 已有 progressive，可叠加 `3/47` |

**推荐改进（不改变持久化优势的前提下）**：

1. **新增 Microsoft Edge Translation Provider**（前端或后端均可；前端直连零配置）  
2. **批量翻译 API**：`POST /translate/readme-blocks`，一次提交多段，减少 RTT  
3. **缩短或动态调整** `README_BLOCK_TRANSLATE_DELAY_MS`（Edge 通道限流策略不同）  
4. **可选双语 CSS 模式**：在已有译文上叠加 `[data-translation]` 块，而非仅 Tab 切换  

---

## 4. DeepWiki 接入方式

### 4.1 结论：纯外链，零 API 集成

GithubStarsManager **没有** DeepWiki SDK、iframe、API Key 或内容拉取。实现仅为仓库卡片上的 **BookOpen 按钮**，根据 UI 语言跳转第三方：

| UI 语言 | 目标 |
|---------|------|
| 英文 (`en`) | `repository.html_url.replace('github.com', 'deepwiki.com')` |
| 中文 (`zh`) | `https://zread.ai/{owner}/{repo}` |

**关键代码**（`RepositoryCard.tsx`）：

```typescript
const getDeepWikiUrl = (githubUrl: string) => {
  return githubUrl.replace('github.com', 'deepwiki.com');
};
const getZreadUrl = (fullName: string) => {
  return `https://zread.ai/${fullName}`;
};
// href={language === 'zh' ? getZreadUrl(...) : getDeepWikiUrl(...)}
```

**特点**：

- 实现成本 O(1)，无维护 DeepWiki 契约  
- 中文用户走 Zread，英文走 DeepWiki  
- Subscription 视图卡片仅 Zread，无 DeepWiki 分支  
- 与自建 LLM 分析（README → summary/tags）完全独立  

### 4.2 对 Project Pilot 的启示

若只需「快速查看 AI 生成的仓库 Wiki」，**外链是最低成本的 MVP**：

- 项目详情顶栏或 GitHub 卡片旁增加「DeepWiki / Zread」按钮  
- 按 UI 语言或用户偏好选择目标  
- 无需后端、无需 embedding  

若需应用内 Wiki 体验，才需要考虑 iframe/API（DeepWiki 是否提供需另行调研）。

---

## 5. 「趋势」板块（重点）

### 5.1 功能定位

GithubStarsManager 的「趋势」位于 **发现中心（DiscoveryView）**，是顶部导航独立 Tab（内部 view 键仍为历史命名 `subscription`）。发现中心共 **5 个频道**：

| 频道 ID | 名称 | 数据源 |
|---------|------|--------|
| `trending` | 趋势 | **GitHubTrendingRSS**（第三方 RSS） |
| `hot-release` | 热门发布 | GitHub Search API |
| `most-popular` | 最受欢迎 | GitHub Search API |
| `topic` | 主题探索 | GitHub Search API |
| `search` | 搜索发现 | GitHub Search API |

默认频道为 `trending`。

### 5.2 数据流架构

```
用户进入「趋势」Tab
    ↓
DiscoveryView.refreshChannel('trending', page)
    ↓
githubApi.getTrendingRepositories(platform, page, perPage, timeRange)
    ↓
① fetch RSS XML（浏览器直连，不经后端）
   URL: https://mshibanami.github.io/GitHubTrendingRSS/{daily|weekly|monthly}/all.xml
    ↓
② DOMParser 解析 <item>
   - title → 仓库名
   - link → github.com/{owner}/{repo}
   - description → 正则提取 ⭐ / 🍴 数量
   - rank = RSS 中的顺序（index + 1）
    ↓
③ 客户端分页：每页 20 条，对 RSS 全列表 slice
    ↓
④ GitHub REST API 补全字段（需 Token）
   GET /repos/{owner}/{repo}
   补：id, stargazers_count, language, topics, description, dates...
   每个请求间隔 80ms 防 rate limit
    ↓
⑤ 写入 Zustand discoveryRepos['trending']（内存，不持久化列表）
    ↓
SubscriptionRepoCard 渲染排名列表
```

**无后端参与**：Express/SQLite 无 trending 表、无相关 API。

### 5.3 趋势「算法」

**本应用不算趋势**——排名完全委托第三方 RSS，而 RSS 上游（GitHubTrendingRSS）抓取 [github.com/trending](https://github.com/trending) 页面。

GitHub 官方 Trending（非公开算法）大致考虑：

- 时间窗口内 **star 增速**（非总 star）
- 仓库活跃度、fork 等信号
- 按 daily / weekly / monthly 分榜

本应用只做：选 RSS URL → 保持顺序 → 分页 → API enrich。

**历史演进**：

- v0.5.2 之前：用 GitHub Search API 自研（`stars:>50 pushed:>=30天` 等），与真实 Trending 差异大  
- v0.5.2+：改用 GitHubTrendingRSS，更贴近 GitHub 官网趋势榜  

遗留代码 `searchTrending()` 仍存在但**无任何调用方**。

### 5.4 UI 与交互

**DiscoveryView 提供**：

- 时间范围切换：`daily` / `weekly` / `monthly`（切换 RSS URL）
- 手动刷新、侧边栏「刷新全部」
- 分页「加载更多」（客户端对 RSS 全量 slice）
- 平台筛选下拉（All / macOS / Windows / Linux / Android）
- AI 一键分析（结果存 IndexedDB）
- Star / Unstar、README 预览、Zread 跳转

**SubscriptionRepoCard 展示**：

- 排名徽章（rank）
- star / fork 总数（**非增长率**）
- 语言色点、描述 / AI 摘要
- **无图表、无 star 历史曲线、无「今日 +N stars」**

### 5.5 缓存与刷新策略

| 层级 | 内容 | 持久化 |
|------|------|--------|
| 会话内存 | `discoveryRepos.trending` | ❌ 刷新页面即失 |
| IndexedDB | AI 分析结果 | ✅ |
| localStorage | 频道选择、平台偏好 | ✅ |
| 定时任务 | **无** | — |

README 写「每 30 分钟自动更新」指的是 **RSS 上游更新频率**，不是应用内 background job。

### 5.6 实现与文档的不一致（需注意）

| 项目 | 文档/UI 描述 | 实际代码 |
|------|-------------|----------|
| 平台筛选 | 趋势频道可筛 macOS/Windows 等 | `getTrendingRepositories()` **未使用** platform 参数过滤 |
| 语言筛选 | changelog 曾提 language input | 趋势 RSS 硬编码 `all.xml`，未支持 `/weekly/javascript.xml` 等 |
| 算法说明 | SortAlgorithmTooltip：30 天内更新、50+ star、按 star 降序 | 已过时，实为 RSS 顺序 |
| 命名 | Tab 叫「趋势」，view 叫 `subscription`，组件叫 `DiscoveryView` | 历史重构遗留 |

### 5.7 其它发现频道（可一并参考）

**Hot Release**（GitHub Search）：

```
stars:>10 archived:false pushed:>=14天前 [+ platform keywords]
sort=updated desc
```

**Most Popular**：

```
stars:>1000 created:<6个月前 pushed:>=1年前
sort=stars desc
```

**Topic / Search**：关键词 + `in:name,description,topics stars:>10`

这些频道与 Trending 共用 DiscoveryView 框架，切换频道时清空缓存并按需拉取。

### 5.8 Project Pilot 发现中心已实现对照（2026-05-30）

Project Pilot 已实现 **发现中心**（路由 `/discovery`，详见 [`README.md`](../README.md)、[`changelogs/CHANGELOG_2026-05-30.md`](../changelogs/CHANGELOG_2026-05-30.md) §7–§11）。下表对照 GithubStarsManager **DiscoveryView** 与当前实现。

| 能力 | GithubStarsManager | Project Pilot（已实现） | 差异 / 备注 |
|------|-------------------|------------------------|-------------|
| **入口与布局** | 顶栏独立 Tab | 最左功能轨 → **发现侧栏**（`w-72`）→ 主内容；顶栏 **`h-12`** 与资料库统一 | 语雀式三栏，非顶栏 Tab |
| **五频道** | trending / hot-release / most-popular / topic / search | ✅ 同五频道，默认 `/discovery/trending` | 频道 ID 与命名对齐 |
| **趋势数据源** | 浏览器直连 GitHubTrendingRSS XML | ✅ 后端 `GET /api/discovery/trending` 拉 RSS | **不经前端直连** RSS；可 SQLite 缓存 |
| **Search 四频道** | 浏览器直连 GitHub Search API | ✅ 后端 `GET /api/discovery/{hot-release\|most-popular\|topic\|search}` | Token 与限流在后端 |
| **Star/Fork/语言补全** | 前端 `GET /repos/{owner}/{repo}`，间隔 80ms | ✅ **`POST /api/discovery/repos/enrich`**，后端并行 + 仓库缓存（6h） | 趋势 **两阶段**：RSS 先返回，enrich 后台分批 |
| **时间范围** | daily / weekly / monthly（换 RSS URL） | ✅ 趋势工具条 Toggle，`?range=` | — |
| **分页 / 加载更多** | 客户端对 RSS 全量 slice，按钮加载 | ✅ **`useInfiniteQuery` + IntersectionObserver** 滚到底自动加载 | 每页 20 条 |
| **手动刷新** | 刷新当前频道 / 刷新全部 | ✅ 顶栏刷新、侧栏「刷新全部」、再次点击当前频道；均 **`fresh=true`** 绕过缓存 | 刷新中图标旋转 |
| **被动刷新冷却** | 无（会话内存，刷新页即失） | ✅ **5 分钟内**切换频道等不重复 `fresh`；**手动刷新不受限** | `discovery-last-refresh.ts` + `localStorage` |
| **侧栏「上次刷新」** | 无 per-channel 时间 | ✅ 5 分钟内 **「刚刚」**；5 分～1 小时 **15 分钟粒度**；其后小时/天/周/月 | 每分钟 tick 更新文案 |
| **列表持久化** | Zustand 内存，刷新页丢失 | ✅ React Query 内存 + 后端 **SQLite**（趋势 30min、Search 10min） | 跨会话仍可从缓存秒开 |
| **加入资料库** | Star / Unstar（GitHub） | ✅ **「加入资料库」** 弹窗（选库 + 文件夹、去重） | **差异化**：导入当前项目库而非 Star |
| **Zread 外链** | 卡片 BookOpen → zread.ai | ✅ 卡片 **Zread** 按钮 | 中文 Wiki 外链 |
| **DeepWiki 外链** | 英文 → deepwiki.com | ❌ 未做 | 可按语言二选一（见 §4） |
| **README 预览** | ReadmeModal | ✅ **`/discovery/r/:owner/:repo`** 只读预览页（README / Release Tab） | 未收录不写入项目库；已收录进完整 `/projects/:id` |
| **AI 一键分析** | README → LLM → IndexedDB | ❌ 未做 | — |
| **平台筛选（趋势）** | UI 有，代码**未过滤** | ❌ 未做 | 避免竞品「UI 有、逻辑无」坑 |
| **语言 RSS** | 硬编码 `all.xml` | ❌ 未做 | 可后续 `/weekly/python.xml` |
| **趋势快照 / 增长曲线** | 无 | ❌ 未做 | 增强项，需自建采样 |
| **滚动容器** | 整页滚动 | ✅ 列表区 **独立滚动**；发现页 **禁用** `html/body` 全局滚动 | 侧栏/顶栏固定 |

**架构对照（数据流）**：

```
GithubStarsManager                         Project Pilot
─────────────────                         ─────────────
浏览器 fetch RSS                    →     后端 fetch RSS → SQLite 可选缓存
浏览器 enrich /repos (Token)        →     前端 POST /repos/enrich → 后端 GitHub API
Zustand 内存列表                    →     React Query + 无限滚动 + enrich 合并
Star 操作                           →     POST /api/projects（加入资料库）
```

**相对竞品的 deliberate 选择**：

1. **后端代理 + 缓存**：避免前端 Token 暴露与 CORS；趋势 RSS 描述已无 ⭐/🍴，stars 需 enrich。  
2. **资料库导入替代 Star**：与「项目库 / 文件夹」模型一致。  
3. **刷新策略**：5 分钟冷却减少无效 GitHub/RSS 请求；手动操作始终 `fresh=true`。

**后续可增强（仍未做）**：

| 能力 | 说明 |
|------|------|
| 语言 RSS | `/weekly/{language}.xml` |
| 平台/Topic 客户端过滤 | enrich 后 filter，或独立 Search 频道 |
| 趋势快照入库 | `trending_snapshots` 表 + 定时任务，支持历史对比 |
| Star 增长曲线 | 定时采样 + 图表（双方均无） |
| DeepWiki 按语言外链 | 英文 DeepWiki / 中文 Zread（项目详情已有 Zread） |
| 发现列表 README 预览 | ✅ 只读预览页（`/discovery/r/...`），不必导入即可浏览 |

---

## 6. 其它可借鉴点（简表）

| 能力 | 做法摘要 |
|------|----------|
| AI 仓库分析 | README 前 2000 字 → 用户自配 LLM → summary/tags/platforms → IndexedDB |
| Release 订阅 | 统一时间线 + 平台资产过滤（dmg/arm64 等关键词） |
| 语义搜索 | LLM 提取关键词 + 本地 rerank |
| 数据导入导出 | 发现列表、AI 分析结果可 JSON 导入导出 |
| Electron 代理 | 可选后端绕过 CORS，Token 加密存储 |

---

## 7. Project Pilot 行动清单（汇总）

### 高优先级

1. ~~**README 图片**~~：✅ 已实现（`readme-media-resolve.ts`、`rehype-raw`、Release 传 `githubUrl`）— 见 [`CHANGELOG_2026-05-30.md`](../changelogs/CHANGELOG_2026-05-30.md)  
2. ~~**Release 图片**~~：✅ 同上  

### 中优先级

3. **翻译加速**：评估 MS Edge Translator provider；批量翻译 API；调整段间 delay  
4. ~~**DeepWiki/Zread 外链**~~：✅ 项目详情 **Zread**；发现卡片 **Zread**（DeepWiki 英文分支未做）  

### 发现中心（已实现，2026-05-30）

5. ~~**Discovery 频道框架**~~：✅ 五频道 + 后端 RSS/Search + enrich API — 见 §5.8 对照表  
6. ~~**资料库导入**~~：✅ `ImportToLibraryDialog`（选库 + 文件夹、去重）  
7. **待增强**：语言 RSS、平台真实过滤、趋势快照、Star 曲线；算法/筛选 UI 须与实现一致（避免竞品式「UI 有、逻辑无」）  

### 保持 Project Pilot 已有优势

- 译文持久化（`readme_translated`）  
- 后端 Markdown 切块翻译（比 DOM 扫描更可控）  
- 资料库/文件夹/标签体系  
- 服务端 OpenAPI 契约  

---

## 8. 关键文件索引（GithubStarsManager）

| 主题 | 路径 |
|------|------|
| Markdown 渲染与图片 | `src/components/MarkdownRenderer.tsx` |
| README 弹窗 | `src/components/ReadmeModal.tsx` |
| 双语翻译 | `src/components/BilingualMarkdownRenderer.tsx` |
| 翻译 API | `src/services/translateService.ts` |
| DOM 扫描 | `src/utils/domTextScanner.ts` |
| DeepWiki 外链 | `src/components/RepositoryCard.tsx` |
| 趋势 RSS | `src/services/githubApi.ts` → `getTrendingRepositories()` |
| 发现中心 UI | `src/components/DiscoveryView.tsx` |
| 趋势卡片 | `src/components/SubscriptionRepoCard.tsx` |
| 状态 | `src/store/useAppStore.ts` |

---

## 9. 参考资料

- [GithubStarsManager README（中文）](https://github.com/AmintaCCCP/GithubStarsManager/blob/main/README_zh.md)
- [GitHubTrendingRSS](https://github.com/mshibanami/GitHubTrendingRSS)
- [DeepWiki](https://deepwiki.com/)
- [Zread](https://zread.ai/)
- Project Pilot 相关实现：  
  - README / 翻译：`frontend/src/components/project/detail/markdown-content.tsx`、`frontend/src/lib/project-translate.ts`、`backend/app/services/translation/google_provider.py`  
  - **发现中心**：`backend/app/api/discovery.py`、`backend/app/services/discovery_*.py`、`frontend/src/components/discovery/`、`frontend/src/lib/discovery-last-refresh.ts`
