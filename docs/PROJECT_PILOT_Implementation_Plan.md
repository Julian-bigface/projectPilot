# Project Pilot — 实现计划

> 产品设计：[[PROJECT_PILOT_Design.canvas]]
> 文档版本：**v1.2**
> 更新日期：**2026-06-27**
> 状态快照：与 [`CHANGELOG_2026-06-27.md`](../changelogs/CHANGELOG_2026-06-27.md) 及代码一致。**产品方向**见 v0.1 设计文档 [§0](../docs/PROJECT_PILOT_v0.1_设计文档.md#0-方向修订2026-06-27)（不再做看板/部署辅助）。待办见 [`PROJECT_PILOT_待办清单_2026-06-27.md`](./PROJECT_PILOT_待办清单_2026-06-27.md)

---

## 一、技术架构总览

```
┌─────────────────────────────────────────────────────┐
│                    用户浏览器                        │
│                  localhost:3000                     │
└──────────────────────┬──────────────────────────────┘
                       │  REST API (JSON)
┌──────────────────────▼──────────────────────────────┐
│                   FastAPI 后端                       │
│                 localhost:8000                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ GitHub API   │  │ AI 摘要服务   │  │  文件写入 │  │
│  │ 数据拉取      │  │ (OpenAI/本地) │  │ (Obsidian)│  │
│  └──────────────┘  └──────────────┘  └───────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │  SQLite (本地文件)
┌──────────────────────▼──────────────────────────────┐
│               project_pilot.db                      │
│           (存储于项目根目录/指定目录)                 │
└─────────────────────────────────────────────────────┘
```

---

## 二、技术栈详情

| 层级 | 技术选型 | 说明 |
|---|---|---|
| 后端框架 | FastAPI | 异步支持，自动化 API 文档 |
| 数据库 | SQLite + aiosqlite | 本地持久化，无需额外服务 |
| ORM | SQLAlchemy 2.0 + apiv2 | 类型安全，异步操作 |
| 前端框架 | React 18 + TypeScript | 主流，稳定 |
| 前端 UI | Refine + shadcn/ui | 快速 CRUD，优美组件 |
| AI 摘要 | OpenAI API / 兼容接口 | 支持切换本地模型 |
| 文件同步 | Obsidian 笔记生成 | Markdown 文件单向写入 |

---

## 三、数据库设计

### 3.1 数据模型（ER 简图）

```
tag_categories ─────< tags
projects ─────────< project_tags >──────── tags
   │
   ├── project_states（状态变更记录）
   │
   ├── deploy_logs（部署日志）
   │
   └── project_notes（个人笔记）
```

### 3.2 表结构

#### projects（项目主表）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 自增 ID |
| github_url | TEXT（索引，非全局唯一） | GitHub 地址；同一仓库可多次入库（多条 `projects` 行） |
| name | TEXT | 项目名称 |
| full_name | TEXT | 完整路径 (owner/repo) |
| description | TEXT | 官方描述 |
| stars | INTEGER | Star 数 |
| language | TEXT | 主要语言 |
| author | TEXT | 作者 |
| license | TEXT | 许可证 |
| ai_summary | TEXT | AI 摘要（Markdown） |
| deploy_methods | TEXT | 部署方式 JSON 数组 |
| state | TEXT | 未体验/正在体验/推荐/放弃 |
| state_changed_at | DATETIME | 状态变更时间 |
| created_at | DATETIME | 添加时间 |
| updated_at | DATETIME | 更新时间 |

#### tag_categories（标签分类表）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 自增 ID |
| name | TEXT UNIQUE | 分类名 |
| sort_order | INTEGER | 排序 |

#### tags（标签表）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 自增 ID |
| name | TEXT UNIQUE | 标签名 |
| category_id | INTEGER FK nullable | 所属分类；空为未分类 |

#### project_tags（项目-标签关联表）
| 字段 | 类型 | 说明 |
|---|---|---|
| project_id | INTEGER FK | 项目 ID |
| tag_id | INTEGER FK | 标签 ID |

#### deploy_logs（部署日志表）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 自增 ID |
| project_id | INTEGER FK | 项目 ID |
| method | TEXT | Docker / npm / pip / 其他 |
| command | TEXT | 启动命令（可选） |
| notes | TEXT | 备注 |
| logged_at | DATETIME | 记录时间 |

#### project_notes（个人笔记表）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 自增 ID |
| project_id | INTEGER FK | 项目 ID |
| content | TEXT | Markdown 笔记内容 |
| updated_at | DATETIME | 更新时间 |

---

## 补充：资料库 `/library` 前端布局与右栏（已实现）

与根目录 [`README.md`](../README.md) 中「默认打开 `/library`」及右栏行为段落一致，便于对照代码审阅。

| 能力 | 要点 | 主要代码路径 |
|------|------|----------------|
| 主壳三栏 + 可拖拽右栏 | `PanelGroup`：主区 + 竖分隔条 + `feature-drawer`；右栏可 `collapsible`；**react-resizable-panels v4** 中 `defaultSize` / `minSize` / `maxSize` 的**百分比**须为带 `%` 的字符串（裸 `number` 按 **px** 解析） | [`frontend/src/components/layout/app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx) |
| 右栏整组显隐 | 路由 **`/library`** 且 `libraryScope` **非**「标签管理」、**非**回收站时展示右栏 | 同上（`showPreviewRail`） |
| 右栏内容分支 | 选中项目卡片 → `ProjectLibraryPreviewPanel`；否则按 scope → `LibraryScopeSummaryPanel` 或 `LibraryFolderInfoPanel` | [`frontend/src/components/layout/library-feature-aside.tsx`](../frontend/src/components/layout/library-feature-aside.tsx) |
| 收起后单击卡片 | `LibraryFeatureDrawerProvider.ensureFeatureDrawerOpen` 先展开右栏再显示预览 | [`frontend/src/context/library-feature-drawer.tsx`](../frontend/src/context/library-feature-drawer.tsx) |
| 项目预览面板交互 | 顶栏（头像+标题+路径）整块进入 **`/projects/:id`**（`full_name` 外链 **`stopPropagation`**）；简介 **双击编辑、失焦 `PATCH`、Escape 放弃**；领域标签行悬停 **「+」** 打开标签对话框；**语言**在基本信息纯文本；预览不重复 **topics** 列表 | [`frontend/src/components/project/project-library-preview-panel.tsx`](../frontend/src/components/project/project-library-preview-panel.tsx) |
| 主内容区滚动条 | **`AppLayoutMainShell`** 的 `<main>`：**默认隐藏**滚动条拇指，**滚动时**短暂显示（`index.css` **`.main-auto-scrollbar`**） | [`frontend/src/components/layout/app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx)、[`frontend/src/index.css`](../frontend/src/index.css) |
| GitHub 卡片外链命中 | **`full_name`** 链接 **`w-max`** 等，可点区域为文本宽度，减少误触 | [`frontend/src/components/project/project-github-card.tsx`](../frontend/src/components/project/project-github-card.tsx) |
| 主区布局切换（网格 / 瀑布流） | `LibraryProjectsLayoutProvider` + `localStorage`（`projectPilot.libraryProjectsLayout`）；顶栏 [`library-projects-layout-toggle.tsx`](../frontend/src/components/layout/library-projects-layout-toggle.tsx)；[`home.tsx`](../frontend/src/pages/library/home.tsx) 在 `grid` 与 CSS `columns` 间切换；`ProjectGithubCard` 的 **`fillGridCell`** 控制等高 vs 随内容变高 | [`frontend/src/context/library-projects-layout.tsx`](../frontend/src/context/library-projects-layout.tsx)、[`frontend/src/App.tsx`](../frontend/src/App.tsx) |
| GitHub 卡片右键菜单 | `ContextMenu` 与 dnd 同根；复制 `github_url`、进详情、`PATCH folder_id` 子菜单、**移入回收站**（`DELETE` 软删 + 确认）；回收站内 **恢复** / **彻底删除** | [`frontend/src/components/project/project-github-card.tsx`](../frontend/src/components/project/project-github-card.tsx) |
| 文件夹描述与标签 | `folders.description` + `folder_tags`；`PATCH` 支持 `description`、`tag_ids`；`GET /api/folders` 返回 `tags`；右栏描述失焦保存、标签悬停 **「+」** 弹窗 | [`backend/app/api/folders.py`](../backend/app/api/folders.py)、[`library-folder-info-panel.tsx`](../frontend/src/components/library/library-folder-info-panel.tsx)、[`folder-domain-tags-dialog.tsx`](../frontend/src/components/library/folder-domain-tags-dialog.tsx) |

---

## 四、实现阶段

### 📦 Phase 1：项目脚手架 + 数据库基础 ✅
**目标**：跑通前后端架子，完成项目 CRUD

- [x] 初始化 FastAPI 项目结构
  - `app/main.py` — 入口
  - `app/api/` — API 路由
  - `app/models/` — SQLAlchemy 模型
  - `app/schemas/` — Pydantic 请求/响应模型
  - `app/core/` — 配置、数据库连接
- [x] 初始化 SQLite 数据库 + 建表脚本
- [x] 实现项目基础 CRUD API
  - `GET /projects` — 列表（状态筛选；`deleted_only` 仅回收站）
  - `POST /projects` — 创建（手动录入 + GitHub enrich，见 Phase 2）
  - `GET /projects/{id}` — 详情（已软删返回 404）
  - `PATCH /projects/{id}` — 更新（已软删返回 404）
  - `DELETE /projects/{id}` — 软删除（移入回收站）
  - `POST /projects/{id}/restore` — 从回收站恢复
  - `DELETE /projects/{id}/permanent` — 彻底删除（仅回收站内）
- [x] 初始化 React + Refine + shadcn/ui 前端
- [x] 搭建基础布局：语雀式功能区 + 库侧栏 + 主内容区（见 [`CHANGELOG_2026-05-08.md`](../changelogs/CHANGELOG_2026-05-08.md)）
- [x] 搭建看板视图（`/projects/board`，连 API + 下拉切换状态，见 [`board.tsx`](../frontend/src/pages/projects/board.tsx)）

**产出**：前后端可独立运行，基础看板界面可见 ✅

---

### 🔌 Phase 2：GitHub 数据拉取 + AI 摘要（部分完成）
**目标**：粘贴 URL → 自动填满项目基础信息 + AI 摘要

- [x] 实现 GitHub API 集成
  - [x] 获取仓库基础信息（stars、language、license 等）— `try_enrich_project_from_github`
  - [x] 获取并解析 README.md 内容 — `GET /projects/{id}/readme`、详情 Tab
  - [x] Release 列表 — `GET /projects/{id}/releases`
  - [ ] 解析仓库根目录的部署相关文件（Dockerfile、docker-compose.yml 等）→ 自动 `deploy_methods`
- [~] 实现 AI 摘要服务 — **战略放弃**（见 [`PROJECT_PILOT_AI_Agent_接入分析.md`](./PROJECT_PILOT_AI_Agent_接入分析.md)）；项目理解改 **Zread / DeepWiki 外链** + 可选手动 `ai_summary` 字段
- [x] 完善 `POST /projects` API
  - [x] 接收 GitHub URL，创建后 `try_enrich_project_from_github`
  - [ ] 异步后台任务 + AI 解析 + 部署标签自动生成
- [x] 前端添加项目：侧栏 / 树 **GitHub URL** 录入 + enrich（[`library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx)）

**产出**：粘贴 GitHub URL 可自动填充 REST 元数据 ✅；AI 摘要 / 部署文件解析仍待办或已放弃

---

### 📋 Phase 3：资料库 + 标签 + 筛选（大部分完成）
**目标**：资料库整理 + 标签系统 + 多维筛选（**不含**看板模块）

- [~] **四列看板** — **移出产品**（2026-06-27）；代码 `/projects/board` 仍存但入口关闭；`projects.state` 字段保留、不扩展看板 UI
  - [~] 拖拽 / 归档内分区 / 看板页筛选 — 随看板一并 **不再规划**
- [x] 标签系统
  - [x] 数据与 API：`tag_categories`；`tags` / `project_tags`；`category_id` 可空（未分类）；`GET/POST/PATCH/DELETE /tags`、`/tag-categories`；`usage_count` / `category_name`
  - [x] 资料库 **标签管理**：**所有标签**、**标签分类**（自建分类 + 未分类首栏、**拖拽**归类）、搜索、创建标签/分类、删除（标签有关联项目时 409；删分类则标签回未分类）；拖拽侧见 [`CHANGELOG_2026-05-13.md`](../changelogs/CHANGELOG_2026-05-13.md)（`DragOverlay`、分类栏碰撞、乐观更新、**无**浮层退回动画）
  - [x] 项目与标签绑定：`PATCH /projects/{id}` 的 `tag_ids`；侧栏 **无标签** + `GET /projects?missing_tags=true`；详情页勾选编辑（闭环 `usage_count`）
  - [x] **标签 AI 分类**（P0）：`suggest-categories` / `apply-category-suggestions` + 标签管理 UI（见 [`CHANGELOG_2026-06-02.md`](../changelogs/CHANGELOG_2026-06-02.md)）
  - [~] 部署信息自动生成标签 — **不再规划**（不做部署文件解析）
  - [x] 项目详情页显示 + 编辑标签（见上一项）
- [x] 筛选与搜索（资料库主区，见 [`CHANGELOG_2026-05-16.md`](../changelogs/CHANGELOG_2026-05-16.md)）
  - [x] 按标签 / 分类筛选（多选，或/且）
  - [x] 按文件夹多选筛选
  - [x] 全文搜索（名称等，`browseFilters.searchQuery`）
  - [x] 按 **添加时间** 快捷筛选（最近 7/30/90/365 天，资料库 `LibraryBrowseToolbar` 客户端过滤）
  - [ ] 看板页按状态 / 标签 / 语言 / Stars / 时间范围筛选 — **随看板废止**
  - [ ] 全文搜索扩展至 AI 摘要 / 笔记字段
- [x] 项目详情页（见 [`CHANGELOG_2026-05-17.md`](../changelogs/CHANGELOG_2026-05-17.md)）
  - [x] Steam 式英雄区 + README / Release / 笔记 Tab；`GET .../readme`、`GET .../releases`；进入页 `refresh-github?scope=stats`
  - [x] 简介双击编辑；领域标签「+」；Tab 栏「更多信息」（含许可证等）；`notes` 字段与笔记 Tab
  - [x] **机器翻译**：`/settings/translation`；简介 Sparkles 翻译；README 分段翻译 + 右键菜单 + 重试失败段（见 [`CHANGELOG_2026-05-24.md`](../changelogs/CHANGELOG_2026-05-24.md)）
  - [x] Release 卡片：标题链 GitHub；Tab 内容区无外层边框（仅卡片边框）
  - [ ] 完整展示所有字段 / 站内编辑 name·full_name（详情页已移除身份编辑入口）
  - [ ] 跳转 Demo（可选）
  - [~] 部署日志 Tab — **不再规划**

**产出**：资料库筛选与详情主路径可用 ✅

---

### 📝 Phase 4：个人笔记（部分完成；部署日志已移出方向）
**目标**：项目详情内可持续沉淀笔记

- [~] **部署日志** — **不再规划**（2026-06-27 产品方向调整）
- [x] 个人笔记
  - [x] 详情页「笔记」Tab：`projects.notes` + `PATCH /projects/{id}`（`notes` 字段）；显式保存 / Ctrl+S（见 2026-05-17 changelog）
  - [ ] 独立 `GET/PATCH /projects/{id}/notes` 路由（可选）
  - [ ] Markdown 编辑器增强（当前为 `Textarea` + 纯文本）
  - [x] 保存时自动更新 `updated_at`（随项目 `PATCH` 已生效）
- [x] 状态变更记录（部分）
  - [x] 切换状态时自动记录 `state_changed_at`（`PATCH` 更新 state 时写入）
  - [~] 归档结论表单 — 随看板流转 **不再规划**

**产出**：笔记可用 ✅

---

### 🔄 Phase 5：Obsidian 笔记同步 + 快捷收藏
**目标**：一键生成 Obsidian 笔记 + 浏览器快捷添加

- [ ] Obsidian 笔记生成
  - 读取 Obsidian 库路径配置
  - 生成 Markdown 文件至 `.github-projects/` 目录
  - 笔记模板：
    ```markdown
    ---
    url: https://github.com/xxx/xxx
    tags: [AI, Docker]
    state: 未体验
    created: 2026-04-30
    ---

    # 项目名称

    ## AI 摘要
    （AI 生成的摘要内容）

    ## 部署方式
    - [ ] Docker
    - [ ] npm

    ## 个人笔记
    （个人笔记内容）

    ## 部署日志
    - 2026-04-30：Docker 部署成功
    ```
  - 支持开关（后台设置页）
  - 支持手动触发同步
- [ ] 快捷收藏入口
  - 浏览器书签脚本（Bookmarklet）
  - 或 Chrome 扩展（可选，Phase 6 做）
  - 行为：在任意 GitHub 页面点击 → 自动跳转 Project Pilot 添加页，预填 URL

**产出**：Obsidian 笔记一键生成，浏览器可快捷添加项目

---

### ✨ Phase 6：优化 + 打包 + 部署（部分完成）
**目标**：本地一键启动，可靠易用

- [x] 环境变量 / 配置文件（部分）
  - [x] GitHub Token、AI 设置（KV + `/settings/ai`）
  - [x] 翻译、内容工厂资产目录等
  - [ ] 统一 Obsidian 库路径、数据库路径文档化配置项
- [ ] Docker 一键部署（可选）
  - `docker-compose.yml`：FastAPI + 前端 Build
  - 用户一条命令启动整个服务
- [x] 前端优化（部分）
  - [x] 欢迎页、发现中心、资料库空态与加载态
  - [ ] 看板空状态、系统骨架屏、移动端基础适配
- [x] 错误处理（部分）
  - [x] GitHub / AI 无 Key 门禁与设置引导（多处）
  - [ ] GitHub API 限流统一提示、网络异常全覆盖

**产出**：Web 双终端 + 桌面 Phase 0 可开发 ✅；Docker / 全面体验优化仍待办

---

## 补充：资料库扩展、发现中心、内容工厂、桌面（2026-06-27 快照）

| 模块 | 状态 | 要点 / 文档 |
|------|------|-------------|
| **项目库层级** | ✅ | `/libraries` 首页、scoped API、文件夹包 — [`CHANGELOG_2026-05-27.md`](../changelogs/CHANGELOG_2026-05-27.md) |
| **发现中心** | ✅ | 五频道、无限滚动 — [`CHANGELOG_2026-05-30.md`](../changelogs/CHANGELOG_2026-05-30.md) |
| **桌面 Phase 0** | ✅ 代码 / ⏳ 冒烟 | Tauri + sidecar — [`PROJECT_PILOT_Desktop_Engineering_Guide.md`](./PROJECT_PILOT_Desktop_Engineering_Guide.md) |
| **内容工厂 Step 1–4** | ✅ | 选择项目 → 分析 → 编辑优化 → 导出发布 — [`CHANGELOG_2026-06-26.md`](../changelogs/CHANGELOG_2026-06-26.md) |
| **README 封面** | ✅ | DOM 截图 1242×1660 — [`CHANGELOG_2026-06-12.md`](../changelogs/CHANGELOG_2026-06-12.md) |
| **AI 封面 Phase 1** | ✅ | 5 内置风格 + `generate-ai-cover` — [`CHANGELOG_2026-06-17.md`](../changelogs/CHANGELOG_2026-06-17.md) |
| **风格库 Phase 2 / 2.5** | ✅ | CRUD、vision 参考图、AI refine — [`CHANGELOG_2026-06-22.md`](../changelogs/CHANGELOG_2026-06-22.md)、[`CHANGELOG_2026-06-25.md`](../changelogs/CHANGELOG_2026-06-25.md) |
| **轮播图 / 多图发布** | ⏳ | UI Tab disabled；`publish_images[]` 待办 — 融合方案 Phase 3、06-26 后续建议 |
| **首次 GitHub Release** | ⏳ | 整清单未执行 — [`PROJECT_PILOT_Release_Checklist.md`](./PROJECT_PILOT_Release_Checklist.md) |

---

## 五、优先级与排期建议

| 优先级 | 阶段 | 核心价值 | 建议顺序 |
|---|---|---|---|
| P0 | Phase 1 | 能跑起来 | 必做 |
| P0 | Phase 2 | 解决「信息碎片化」痛点 | 必做 |
| P0 | Phase 3 | 资料库 + 标签 + 筛选 | 必做 ✅ |
| ~~P1~~ | ~~Phase 4 部署日志~~ | — | **已移出方向** |
| P1 | 内容工厂 / 详情增强 | 创作与理解 | 当前主线 |
| P2 | Phase 5 | Obsidian + 快捷收藏 | 有余力 |
| P3 | Phase 6 | 优化 + 桌面发版 | 工程化 |

---

## 六、文件目录结构（参考）

```
project-pilot/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── api/
│   │   │   ├── projects.py
│   │   │   ├── tags.py
│   │   │   └── deploy_logs.py
│   │   ├── models/
│   │   │   ├── project.py
│   │   │   ├── tag.py
│   │   │   └── deploy_log.py
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── github.py
│   │   │   ├── ai_summary.py
│   │   │   └── obsidian_sync.py
│   │   └── core/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   ├── components/
│   │   └── providers/
│   ├── package.json
│   └── ...
└── docker-compose.yml
```

---

## 七、决策记录

| 日期 | 决策 | 理由 |
|---|---|---|
| 2026-04-30 | 数据存储用 SQLite 而非 Obsidian 双向联动 | Project Pilot 自成体系，Obsidian 笔记为可选输出 |
| 2026-04-30 | AI 摘要支持 OpenAI API + 本地模型双模式 | 用户可根据自身情况灵活切换 |
| 2026-04-30 | 初始状态默认为「未体验」 | 保守策略，不会遗漏任何一个项目 |
| 2026-04-30 | 看板列：推荐/放弃归档内分区展示 | 避免列过多难以浏览，同时保留分类信息 |
| 2026-06-02 | 不做 README LLM 自动摘要 | 改 Zread/DeepWiki；见 AI Agent 接入分析 v2 |
| 2026-06-27 | 实现计划 v1.1 状态同步 | 勾选与代码 / changelog 对齐 |
| 2026-06-27 | **移出看板与部署辅助** | 重心转向资料库 + 详情 + 内容工厂；见 v0.1 §0 |
