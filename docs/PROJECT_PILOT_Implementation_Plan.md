# Project Pilot — 实现计划

> 产品设计：[[PROJECT_PILOT_Design.canvas]]
> 文档版本：v1.0
> 更新日期：2026-05-14

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

### 📦 Phase 1：项目脚手架 + 数据库基础
**目标**：跑通前后端架子，完成项目 CRUD

- [ ] 初始化 FastAPI 项目结构
  - `app/main.py` — 入口
  - `app/api/` — API 路由
  - `app/models/` — SQLAlchemy 模型
  - `app/schemas/` — Pydantic 请求/响应模型
  - `app/core/` — 配置、数据库连接
- [ ] 初始化 SQLite 数据库 + 建表脚本
- [ ] 实现项目基础 CRUD API
  - `GET /projects` — 列表（状态筛选；`deleted_only` 仅回收站）
  - `POST /projects` — 创建（手动录入，不含 AI）
  - `GET /projects/{id}` — 详情（已软删返回 404）
  - `PATCH /projects/{id}` — 更新（已软删返回 404）
  - `DELETE /projects/{id}` — 软删除（移入回收站）
  - `POST /projects/{id}/restore` — 从回收站恢复
  - `DELETE /projects/{id}/permanent` — 彻底删除（仅回收站内）
- [ ] 初始化 React + Refine + shadcn/ui 前端
- [ ] 搭建基础布局：侧边栏 + 主内容区
- [ ] 搭建简单看板视图（前端模拟数据，不连 API）

**产出**：前后端可独立运行，基础看板界面可见

---

### 🔌 Phase 2：GitHub 数据拉取 + AI 摘要
**目标**：粘贴 URL → 自动填满项目基础信息 + AI 摘要

- [ ] 实现 GitHub API 集成
  - 获取仓库基础信息（stars、language、license）
  - 获取并解析 README.md 内容
  - 解析仓库根目录的部署相关文件（Dockerfile、docker-compose.yml、Makefile、package.json 等）
- [ ] 实现 AI 摘要服务
  - 调用 OpenAI API（或兼容接口）解析 README
  - 生成结构化摘要：项目核心能力、适用场景、部署方式列表
  - 提取部署方式标签（Docker / npm / pip / pipx / 二进制 / 源码 / 在线 Demo）
- [ ] 完善 `POST /projects` API
  - 接收 GitHub URL
  - 异步拉取 GitHub 数据（可后台任务）
  - AI 解析 + 标签生成
  - 存入数据库，返回完整项目信息
- [ ] 前端添加项目弹窗：输入 GitHub URL → 显示加载状态 → 显示解析结果 → 确认添加

**产出**：粘贴 GitHub URL，3-5 秒内自动完成信息填充

---

### 📋 Phase 3：看板 + 标签 + 筛选
**目标**：完整看板交互 + 标签系统 + 多维筛选

- [ ] 完善四列看板
  - 未体验 / 正在体验 / 推荐归档 / 放弃归档
  - 拖拽卡片切换状态（可选，先做按钮切换）
  - 归档列内分区展示（推荐区 / 放弃区）
- [ ] 标签系统
  - [x] 数据与 API：`tag_categories`；`tags` / `project_tags`；`category_id` 可空（未分类）；`GET/POST/PATCH/DELETE /tags`、`/tag-categories`；`usage_count` / `category_name`
  - [x] 资料库 **标签管理**：**所有标签**、**标签分类**（自建分类 + 未分类首栏、**拖拽**归类）、搜索、创建标签/分类、删除（标签有关联项目时 409；删分类则标签回未分类）；拖拽侧见 [`CHANGELOG_2026-05-13.md`](../changelogs/CHANGELOG_2026-05-13.md)（`DragOverlay`、分类栏碰撞、乐观更新、**无**浮层退回动画）
  - [x] 项目与标签绑定：`PATCH /projects/{id}` 的 `tag_ids`；侧栏 **无标签** + `GET /projects?missing_tags=true`；详情页勾选编辑（闭环 `usage_count`）
  - [ ] 部署信息自动生成标签（待 Phase 2 流水线接入 `project_tags`，可与分类策略另定）
  - [x] 项目详情页显示 + 编辑标签（见上一项）
- [ ] 筛选与搜索
  - 按状态筛选
  - 按标签 / 分类筛选（多选，待与项目绑定标签一并实现）
  - 按语言筛选
  - 按 Stars 范围筛选
  - 全文搜索（名称 + 描述 + AI 摘要）
- [ ] 项目详情页（**进行中**，见 [`CHANGELOG_2026-05-17.md`](../changelogs/CHANGELOG_2026-05-17.md)）
  - [x] Steam 式英雄区 + README / Release / 笔记 Tab；`GET .../readme`、`GET .../releases`；进入页 `refresh-github?scope=stats`
  - [x] 简介双击编辑；领域标签「+」；Tab 栏「更多信息」（含许可证等）；`notes` 字段与笔记 Tab
  - [x] **机器翻译**：`/settings/translation`；简介 Sparkles 翻译；README 分段翻译 + 右键菜单 + 重试失败段（见 [`CHANGELOG_2026-05-24.md`](../changelogs/CHANGELOG_2026-05-24.md)）
  - [x] Release 卡片：标题链 GitHub；Tab 内容区无外层边框（仅卡片边框）
  - [ ] 完整展示所有字段 / 站内编辑 name·full_name（详情页已移除身份编辑入口）
  - [ ] 跳转 Demo、部署日志、独立笔记 API 路由

**产出**：看板可正常流转，筛选实时生效

---

### 📝 Phase 4：部署日志 + 个人笔记
**目标**：每个项目有独立的部署记录和笔记

- [ ] 部署日志
  - `POST /projects/{id}/deploy-logs` — 记录一条部署
  - `GET /projects/{id}/deploy-logs` — 列表
  - 字段：时间、方式（Docker/npm/pip/其他）、启动命令、备注
  - 前端：在项目详情页添加「记录本次部署」入口
- [ ] 个人笔记
  - [x] 详情页「笔记」Tab：`projects.notes` + `PATCH /projects/{id}`（`notes` 字段）；显式保存 / Ctrl+S（见 2026-05-17 changelog）
  - [ ] 独立 `GET/PATCH /projects/{id}/notes` 路由（可选）
  - [ ] Markdown 编辑器增强（当前为 `Textarea` + 纯文本）
  - 保存时自动更新 `updated_at`（随项目 `PATCH` 已生效）
- [ ] 状态变更记录
  - 切换状态时自动记录 `state_changed_at`
  - 归档时可选填写结论（推荐理由 / 放弃原因）

**产出**：项目详情页完整，部署记录和笔记可持续沉淀

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

### ✨ Phase 6：优化 + 打包 + 部署
**目标**：本地一键启动，可靠易用

- [ ] 环境变量 / 配置文件
  - 数据库路径
  - Obsidian 库路径
  - OpenAI API Key
  - 监听地址（默认 127.0.0.1）
- [ ] Docker 一键部署（可选）
  - `docker-compose.yml`：FastAPI + 前端 Build
  - 用户一条命令启动整个服务
- [ ] 前端优化
  - 加载状态优化（骨架屏）
  - 空状态提示（看板为空时）
  - 移动端基础适配
- [ ] 错误处理
  - GitHub API 限流提示
  - AI 服务不可用降级处理
  - 网络异常友好提示

**产出**：本地安装后两条命令启动，用户体验流畅

---

## 五、优先级与排期建议

| 优先级 | 阶段 | 核心价值 | 建议顺序 |
|---|---|---|---|
| P0 | Phase 1 | 能跑起来 | 必做 |
| P0 | Phase 2 | 解决「信息碎片化」痛点 | 必做 |
| P0 | Phase 3 | 解决「分类混乱」痛点 | 必做 |
| P1 | Phase 4 | 解决「部署记录缺失」痛点 | 强烈建议 |
| P2 | Phase 5 | Obsidian 联动 + 快捷收藏 | 有余力做 |
| P3 | Phase 6 | 优化体验 | 最后做 |

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
