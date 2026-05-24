# GitHub 项目管理 — 思路整理

## 背景

之前在 X 上看到推荐 **Kan**（开源项目管理看板，Trello 替代品，支持 Docker 部署），以为是「从 GitHub 拉项目到本地统一管理」的工具，实际不是。

**核心痛点：** 看到有意思的 GitHub 项目，但部署麻烦（Docker / 手动拷贝代码），导致懒得去体验，长期积累了大量「未体验」项目。

---

## 产品定位

### 核心思路

**Project Pilot = GitHub 项目的书架/阅读器**

像 BookNote 管理书籍一样管理 GitHub 项目——收集、AI 摘要、状态追踪、部署记录、归档沉淀。

不是「知识管理系统的扩展」，而是**专门为 GitHub 项目打造的管理工具**。

原型图里的布局是 UI 参考（Readest 三栏布局），图中的「书籍」均为 GitHub 项目，仅为方便展示随手标注。

产品参考原型：
![产品原型图](https://minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com/ccv2%2F2026-05-07%2FMiniMax-M2.7%2F2034144961691128014%2F54fa2c8507d3eb27ad73a0d5b4bffbd3ffc9ff464b1efd6236b999ee5e631520..png?Expires=1778211152&OSSAccessKeyId=LTAI5tGLnRTkBjLuYPjNcKQ8&Signature=QowBmONtcOYITW%2FrUycotbEscl0%3D)

界面采用三栏布局：
- **左侧导航**：领域分类、收藏夹、星级
- **中间网格**：项目封面展示（GitHub OG image / star history / 自生成封面）
- **右侧详情面板**：标签、星级、备注、创建时间、阅读状态

---

## 产品参考

### Readest（UI 布局参考）

> github.com/readest/readest | 1928 commits | 活跃

**参考原因：** UI 布局参考，非内容参考。产品定位是纯 GitHub 项目管理，不是电子书管理。

- 三栏布局和你原型图几乎完全一致
- 元数据面板：标签、星级、备注、创建时间，完全对应原型设计
- 有笔记、高亮、阅读状态、标签系统

**差距（需要自己做的差异化）：**
- 没有 GitHub 项目专有逻辑（README 解析、部署方式标签、部署日志）
- 没有 AI 自动摘要
- 没有领域标签系统
- 没有看板状态流转（未体验→正在体验→归档）

---

### Readest 代码深度分析

本地克隆路径：`B:\05_obsidian\Repository\.projects_reference\readest`

#### 目录结构

```
readest/
├── apps/
│   ├── readest-app/          # 主应用（Next.js + Tauri）
│   │   ├── src/              # 前端源代码
│   │   └── src-tauri/         # Rust/Tauri 后端
│   ├── readest.koplugin/     # KOReader 插件（Lua）
│   └── ...
├── packages/                 # 共享包
│   ├── foliate-js/          # EPUB/PDF 解析引擎
│   └── ...
└── ...
```

**前端架构：**
- **Framework**: Next.js 16.2.3 + React 19.2.5（App Router）
- **Backend**: Rust + Tauri 2.x（本地桌面应用）
- **Styling**: Tailwind CSS 3.4.18 + daisyUI 4.12.24

#### 关键技术栈

| 类别 | 技术 | Project Pilot 对应 |
|------|------|-----------------|
| 框架 | Next.js + React | React + Refine |
| 状态管理 | Zustand 5.0.10 | Zustand 或 Jotai |
| 虚拟列表 | react-virtuoso 4.17.0 | react-virtuoso ✅ |
| 样式 | Tailwind + daisyUI | Tailwind + shadcn/ui |
| 数据库 | Turso (libSQL/SQLite) | SQLite ✅ |
| 认证 | Supabase Auth (多 OAuth) | GitHub OAuth（自实现） |
| AI | @ai-sdk/react + AI SDK 6.x | OpenAI API ✅ |
| 国际化 | i18next 24.2.0 | react-i18next |
| 拖拽 | @dnd-kit/core | — |

#### 三栏布局具体实现

**左侧栏**（`src/app/library/components/LibraryHeader.tsx`）
- 搜索栏（500ms 防抖）
- 导入按钮（下拉菜单）
- 视图切换（网格/列表）
- 设置菜单

**中间网格**（`src/app/library/components/Bookshelf.tsx`）
- 使用 `react-virtuoso` 的 `VirtuosoGrid` 实现虚拟化网格
- CSS Grid 响应式列数：
  ```tsx
  'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-12'
  ```
- 支持按 Group / Series / Author 分组
- 支持按 Title / Author / Updated / Created 排序

**右侧详情面板**（`src/components/metadata/BookDetailView.tsx`）
- Dialog 弹窗实现
- 可折叠区块：封面+标题 / Metadata / Series / Description
- 查看模式 + 编辑模式切换

#### Zustand Store 设计（可复用）

```
store/
├── libraryStore.ts    # 书架数据、分组、选中状态 ← 【Project Pilot 可复用：projectStore】
├── settingsStore.ts  # 用户设置
├── bookDataStore.ts  # 数据缓存
├── sidebarStore.ts   # 侧边栏状态 ← 【Project Pilot 可复用：sidebarStore】
├── themeStore.ts     # 主题/颜色
└── ...
```

#### 数据模型（参考）

```typescript
interface Book {
  hash: string;              // 唯一标识
  title: string;
  author: string;
  groupId?: string;           // 分组/文件夹
  groupName?: string;        // 分组名称
  tags?: string[];           // ← 【Project Pilot 对应：领域标签 + 部署标签】
  coverImageUrl?: string;
  createdAt: number;         // ← 对应：添加时间
  updatedAt: number;
  readingStatus?: 'unread' | 'reading' | 'finished';
  // ← 【Project Pilot 对应：未体验 | 正在体验 | 推荐归档 | 放弃归档】
}
```

#### GitHub OAuth 流程（可参考）

- 使用 Supabase Auth，支持 GitHub OAuth Provider
- Tauri 平台通过深度链接（deeplink）捕获回调
- Web 平台通过 OAuth URL 跳转
- AuthContext 管理会话持久化

#### 对 Project Pilot 的复用建议

| Readest 部分 | 复用建议 | 优先级 |
|-------------|---------|------|
| react-virtuoso 虚拟网格 | 直接复用到项目列表 | ⭐⭐⭐ |
| Zustand 模块化 store 设计 | 照搬 store 分离模式 | ⭐⭐⭐ |
| CSS Grid 响应式列数 | 直接复用 | ⭐⭐⭐ |
| BookDetailView 可折叠面板 | 参考详情面板布局 | ⭐⭐ |
| daisyUI 主题系统 | 参考但用 shadcn/ui 重实现 | ⭐⭐ |
| Turso/SQLite 数据库 | 直接复用 | ⭐⭐ |
| Supabase Auth OAuth 流程 | 参考 GitHub OAuth 实现 | ⭐⭐ |
| 数据库迁移 PRAGMA 模式 | 参考 | ⭐ |

**不建议复用：**
- Tauri/Rust 后端（改用 FastAPI）
- foliate-js EPUB 解析（无阅读器需求）
- daisyUI 复杂组件（改用 shadcn/ui）

---

### Calibre + Calibre-Web

- 书架视图（和你原型的网格封面感一致）
- 详细的元数据面板
- **差距**：没有 GitHub 专有逻辑，更偏本地文件管理

---

### BookStack

- Shelf → Book → Chapter → Page 层级
- 标签 + 备注系统完善
- **差距**：是文档 wiki，阅读状态管理弱
- **可参考**：shelf = 领域，book = 项目的层级映射关系

---

### Hoarder

- AI 自动打标签
- 全文搜索
- 链接元数据抓取
- 自托管
- **差距**：是通用书签管理器，没有看板，没有 GitHub 专有逻辑
- **可参考**：AI 处理链接的工作流架构

---

## 产品功能矩阵

### 完整工作流

```
粘贴 GitHub URL
    ↓
后端自动抓取仓库信息
    ↓
AI 解析 README
    ├── 生成项目总结（中英文混合，总结核心能力+适用场景）
    └── 解析部署方式 → 打上部署标签
         如：Docker / npm / pip / 二进制 / 在线 Demo / 云部署
    ↓
存入数据库 → 进入「未体验」
    ↓
同步生成 Obsidian 笔记（可选）
```

---

## 问题拆解

### 你以为的需求 ❌
> 从 GitHub 拉项目到本地，统一管理/体验

→ 现实中这类工具极少，且需求边界模糊

### 你真正的需求 ✅
> **低成本、快速地体验 GitHub 开源项目**

完整链路：
1. **发现** → 收集感兴趣的 GitHub 项目
2. **筛选** → 快速判断项目是否值得深入
3. **部署** → 低摩擦地把项目跑起来
4. **记录** → 体验后记录，决定「收藏」还是「放弃」

---

## 可行性分析

| 方向                       | 可行性     | 说明                              |
| ------------------------ | ------- | ------------------------------- |
| 自己搭一套工作流                 | ✅ 可行    | Obsidian 记录 + Docker/脚本，已能实现    |
| 用 Portainer 管理 Docker 容器 | ⚠️ 部分可行 | 能管容器，但管不了「从哪拉项目」                |
| AI 辅助判断项目值不值得试           | ✅ 可行    | WebFetch 抓 README → AI 总结能力/复杂度 |
| 完全自动化的一键体验平台             | ❌ 复杂    | 需安全隔离、依赖兼容等，门槛高                 |

---

## 设计文档

详细设计见：[[项目集合/github项目管理/PROJECT_PILOT_Design.canvas]]

---

## 建议的轻量方案

### 发现 + 筛选
- 用 Obsidian 记录 GitHub 项目笔记
- 在笔记里放 `[[项目名|链接]]`，方便快速打开 GitHub
- **AI 辅助筛选**：WebFetch README → 让 AI 告诉你「这个项目适合什么场景」「部署难度如何」

### 部署
- **Docker 项目** → 用 Portainer 统一管理容器
- **脚本化** → 写一个通用 `deploy.sh`，输入 GitHub 地址，自动 clone + 启动
- **尝鲜优先** → 先看有没有在线 Demo（Replit / GitHub Codespaces / 一键部署按钮）

### 记录
- 在 Obsidian 笔记末尾加上「体验结论」字段：
  ```yaml
  状态: 未体验 / 已体验-推荐 / 已体验-放弃
  部署难度: ⭐ ~ ⭐⭐⭐⭐⭐
  适用场景: ...
  ```

---

## 延伸思考

- **GitHub 项目管理的其他理解**：
  - 用 GitHub Issues / Projects 做个人项目管理 → 这是 GitHub 自带的功能
  - 把你自己的多个 GitHub 仓库用 Projects 统一跟踪进度
  - 你现在的 Obsidian 其实已经在做这件事了，只是更偏向「知识收集」而非「任务追踪」
