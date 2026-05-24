# 更新日志（2026-05-13）

## 范围

- **资料库 → 标签管理 → 标签分类**：拖拽归类交互与观感优化——**整块标签**可拖、**浮层**不被分类栏 `overflow` 裁切；松手目标稳定落在 **分类栏**（`tm-drop-*`）而非误命中其他标签；**`DragOverlay` 关闭松手退回动画**（`dropAnimation: null`），松手后 **`finally` 内同步**清空浮层状态，避免与 **乐观更新** 叠帧闪动；横向分类行 **内边距** 减轻首栏高亮/描边被裁切；`PATCH /tags/:id` 的 **`category_id`** 更新配合 **React Query 乐观缓存** 与失败回滚。
- **GitHub topics 与领域标签统一**：成功拉取仓库后，将 **`topics`** 按名 **get-or-create** 写入 **`tags`**（新建仅 **未分类**；已存在标签 **不改分类**）并写入 **`project_tags`**；`POST /projects` 在无 Token 拉取失败时，若请求体含 **`topics`** 亦同步。资料库 **GitHub 卡片 / 右栏预览** 不再单独展示 topics 浅色胶囊（**保留 `language`**），与 **`tags`** 一套展示。
- **标签名规范化**：与 **`POST/PATCH /tags`** 共用 **`normalize_tag_name`**（[`app/services/tag_normalize.py`](../backend/app/services/tag_normalize.py)）。
- **GitHub 项目卡片**：对齐参考布局——顶栏强调色条、**`owner/repo` 头像**、**显示名 + 仓库路径**、简介、`language`/topics **浅色胶囊**、应用标签 **彩色胶囊**、底栏 Star/Fork/时间；**单击**在布局右侧 **`feature-drawer` Panel** 中预览；**双击**进入 `/projects/:id`；**保留**资料库拖拽与 **GitHub 外链**（`stopPropagation`）。
- **资料库右侧预览（`feature-drawer`）**：删除、编辑简介、管理领域标签在 **常驻右栏**（`ProjectLibraryPreviewPanel` + `LibraryProjectPreviewProvider`）内；**「查看完整详情」** 进入 `/projects/:id`（已替代叠层 **Sheet** 方案）。
- **`feature-drawer` 宽度**：右栏 **`minSize` 280px**（约等于资料库 GitHub 卡片栅格中的 **单卡宽度**）；**`defaultSize` / `maxSize` 等须使用 `"xx%"` 字符串**（**v4 中裸 `number` 为像素**，曾误将 **`maxSize={56}`** 当作 56% 导致右栏约 56px）；默认主区/右栏约 **68% / 32%**，右栏 **`maxSize` 85%**；**`Group.resizeTargetMinimumSize`** 与 **`Separator`** 加宽以改善拖拽命中。
- **资料库右栏板块信息**：无选中项目时，**全部 / 未分类 / 回收站**（及 **文件夹总览、无标签**）展示可折叠 **「基本信息」**（名称 + 文件数量）；**文件夹**视图展示 **文件夹信息**（名称 **`PATCH`**、标签/描述占位、可折叠元数据）；仍选中项目卡片时展示 **`ProjectLibraryPreviewPanel`**。
- **文档**：根 [`README.md`](../README.md) 与 [`docs/PROJECT_PILOT_Implementation_Plan.md`](../docs/PROJECT_PILOT_Implementation_Plan.md)、[`docs/PROJECT_PILOT_v0.1_设计文档.md`](../docs/PROJECT_PILOT_v0.1_设计文档.md) 对齐上述 **资料库三栏 + `feature-drawer`**、右栏显隐与内容分支、**`LibraryFeatureDrawerProvider.ensureFeatureDrawerOpen`**、**`react-resizable-panels` v4** 百分比须 **`"xx%"`** 等实现说明；[`CHANGELOG_2026-05-08.md`](./CHANGELOG_2026-05-08.md) **「## 文档」** 索引同步补充右栏与计划文档交叉引用。

---

## 代码变更

### 1) `tag-management.tsx` 拖拽与碰撞

- **修改**：[`frontend/src/pages/library/tag-management.tsx`](../frontend/src/pages/library/tag-management.tsx)  
  - **`useDraggable`** 的 `ref` / `listeners` / `transform` 绑在**整块标签**外层，避免只拖文字。  
  - **`DragOverlay` + `TagChipDragPreview`**：拖拽预览挂到文档层；源项拖拽中 **`opacity: 0`** 且**不应用** `transform`，避免在 `overflow` 容器内被裁切。  
  - **碰撞**：仅参与 **`tm-drop-*`** 分类栏；顺序 **`pointerWithin` → `closestCorners` → `closestCenter`**，减少缝隙松手时 `over` 为空导致不提交 **`PATCH`**。  
  - **横向滚动容器**：`px-3 py-1` 等，减轻首列 **`ring`** 被裁切。

### 2) `patchTagMutation` 与拖拽浮层收尾

- **修改**：[`frontend/src/pages/library/tag-management.tsx`](../frontend/src/pages/library/tag-management.tsx)  
  - **`patchTagMutation`**：`onMutate` 乐观更新 **`["tags"]`**，`onError` 回滚（重命名失败时不重复全局 **`toast`**），**`onSettled`** 再 **`invalidateQueries(["tags"])`**。  
  - **`DragOverlay`**：恒 **`dropAnimation={null}`**，彻底关闭 dnd-kit 松手「飞回原位」动画。  
  - **`handleDragEnd`**：**`finally`** 内 **`setActiveDragTag(null)`**（同步，不再 **`queueMicrotask`**），尽快卸掉浮层，减少与乐观列表的一帧错位。

### 3) `ProjectGithubCard` 参考稿式布局

- **修改**：[`frontend/src/components/project/project-github-card.tsx`](../frontend/src/components/project/project-github-card.tsx) — 顶 **`h-1` 琥珀色条**；**`RepoAvatar`**（`parseGithubOwner` + `https://github.com/{owner}.png?size=80`，**`onError`** 首字母占位）；主标题 **`name`**、次行 GitHub 标 + **`full_name`**；简介 **`line-clamp-3`**（无简介且与路径重复时 **「暂无仓库简介」**）；**`language` + topics** 浅色圆角胶囊（色序循环）；**`tags`** 与 GitHub issue label 接近的 **实线边框 + 浅底** 小胶囊；底栏元数据 + **外链** **`stopPropagation`**。  
- **修改**：[`frontend/src/lib/project-display.ts`](../frontend/src/lib/project-display.ts) — **`parseGithubOwner(full_name)`** 供头像 URL。  
- **验证**：`npm run build`、`npm run lint`。

---

### 4) `ProjectGithubCard` 删除、外链、简介与标签编辑

- **新建**：[`frontend/src/lib/invalidate-project-queries.ts`](../frontend/src/lib/invalidate-project-queries.ts) — **`invalidateProjectRelated`**，供卡片与详情缓存一致。  
- **修改**：[`frontend/src/components/project/project-github-card.tsx`](../frontend/src/components/project/project-github-card.tsx) — **删除**（`Trash2` + **`AlertDialog`** + **`DELETE`** + **`toast`**）；**`full_name`** 链至 **`github_url`**（**`stopPropagation`**）；底栏 **移除** 重复 GitHub 图标；**简介**（`Pencil` + **`Dialog`** + **`Textarea`** + **`PATCH` description**）；**`group/tags` 悬停** 显示 **「添加标签」**；交互控件 **`onPointerDown` stopPropagation** 避免误拖。  
- **验证**：`npm run build`、`npm run lint`。

### 5) 领域标签弹窗抽组件 + 卡片/详情复用

- **新建**：[`frontend/src/components/project/project-domain-tags-dialog.tsx`](../frontend/src/components/project/project-domain-tags-dialog.tsx) — **`ProjectDomainTagsDialog`**：双栏（分类导航 + 搜索勾选）、**`PATCH { tag_ids }`**、成功 **`invalidateProjectRelated`**；**`DialogContent`** **`onPointerDown` stopPropagation** 便于与 dnd-kit 共存。  
- **修改**：[`frontend/src/pages/projects/detail.tsx`](../frontend/src/pages/projects/detail.tsx) — 详情页 **「编辑领域标签」** 改为挂载 **`ProjectDomainTagsDialog`**，**`onSaved`** 写回 **`["projects","detail",id]`** 缓存。  
- **修改**：[`frontend/src/components/project/project-github-card.tsx`](../frontend/src/components/project/project-github-card.tsx) — **「添加标签」** 与详情共用 **`ProjectDomainTagsDialog`**；卡片上 **`tags`** 展示为 **GitHub 式** 实线小标签。  
- **删除**：`project-github-card-tag-dialog.tsx`（单栏弹窗，已由 **`ProjectDomainTagsDialog`** 替代）。  
- **验证**：`npm run build`、`npm run lint`。

### 6) 资料库项目右侧预览（`feature-drawer` Panel）

- **新建**：[`frontend/src/components/ui/sheet.tsx`](../frontend/src/components/ui/sheet.tsx) — Radix **Sheet**（保留作通用 UI；资料库预览**不再依赖**该组件）。  
- **新建**：[`frontend/src/context/library-project-preview.tsx`](../frontend/src/context/library-project-preview.tsx) — **`LibraryProjectPreviewProvider`** / **`useLibraryProjectPreview`**：当前预览项目状态。  
- **新建**：[`frontend/src/components/project/project-library-preview-panel.tsx`](../frontend/src/components/project/project-library-preview-panel.tsx) — **`ProjectLibraryPreviewPanel`**：摘要、**`DELETE` / `PATCH` description**、**`ProjectDomainTagsDialog`**、**「查看完整详情」**。  
- **新建**：[`frontend/src/components/layout/library-feature-aside.tsx`](../frontend/src/components/layout/library-feature-aside.tsx) — 在 **`/library`** 且有预览时挂载 **`ProjectLibraryPreviewPanel`**，否则占位说明。  
- **修改**：[`frontend/src/components/layout/app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx) — 用 **`LibraryProjectPreviewProvider`** 包裹 **`Group`**；右侧 **`Panel`** 内渲染 **`LibraryFeatureAside`**（替代原占位 `<aside>`）。  
- **修改**：[`frontend/src/components/project/project-github-card.tsx`](../frontend/src/components/project/project-github-card.tsx) — **单击/双击** 区分预览与 **`navigate(/projects/:id)`**；移除 **`onOpenSheet`**。  
- **修改**：[`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx) — 与预览上下文同步列表中的项目引用；不再挂载单例 Sheet。  
- **删除**：[`frontend/src/components/project/project-library-preview-sheet.tsx`](../frontend/src/components/project/project-library-preview-sheet.tsx) — 与 **`ProjectLibraryPreviewPanel`** 重复。  
- **验证**：`npm run build`、`npm run lint`。

### 7) `feature-drawer` 最小宽度（约单卡）

- **修改**：[`frontend/src/components/layout/app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx) — 右侧 **`Panel`**（`id="feature-drawer"`）**`minSize="280px"`**；**`defaultSize="32%"`**、**`maxSize="85%"`**（百分比须为带 **`%`** 的字符串，见 **`### 8)`**）；**`Group`** 增加 **`resizeTargetMinimumSize={{ fine: 12, coarse: 24 }}`**；**`Separator`** 加宽为 **`w-3`** 并 **`relative z-10`** 便于抓取。  
- **验证**：`npm run build`。

### 8) `react-resizable-panels` v4：Panel 尺寸数字为像素

- **修改**：[`frontend/src/components/layout/app-layout.tsx`](../frontend/src/components/layout/app-layout.tsx) — **v4** 中 **`defaultSize` / `minSize` / `maxSize` 传入 `number` 时按像素解析**，不是百分比；将主区 **`defaultSize="68%"`**、**`minSize="40%"`** 与右栏比例类 props 全部改为 **`"xx%"`** 字符串，修复右栏被 **`maxSize={56}`** 误解析为 **56px** 上限导致的极窄栏与分割条拖拽异常。  
- **验证**：`npm run build`。

### 9) 资料库右栏：板块摘要与文件夹信息

- **新建**：[`frontend/src/components/library/library-scope-summary-panel.tsx`](../frontend/src/components/library/library-scope-summary-panel.tsx) — **`LibraryScopeSummaryPanel`**：可折叠 **「基本信息」**；**`all` / `folders_all` / `uncategorized` / `no_tags` / `trash`** 的名称与文件数量（**`no_tags`** 独立 **`useQuery`**；**`trash`** 占位 **0**）。  
- **新建**：[`frontend/src/components/library/library-folder-info-panel.tsx`](../frontend/src/components/library/library-folder-info-panel.tsx) — **`LibraryFolderInfoPanel`**：文件夹名 **`PATCH /api/folders/:id`**；标签/描述 **disabled** + **`HoverHelp`**；可折叠 **「文件夹信息」**（子树项目数、大小 **「—」**、**`created_at`** 来自 **`["folders","flat"]`**）。  
- **修改**：[`frontend/src/components/layout/library-feature-aside.tsx`](../frontend/src/components/layout/library-feature-aside.tsx) — 按 **`previewProject` / `libraryScope`** 分支渲染上述面板与标题副文案。  
- **验证**：`npm run build`。

---

### 10) 文档：资料库布局与右栏写入 README / 计划 / v0.1 设计

- **修改**：[`README.md`](../README.md) — **`/library`** 主区与侧栏行为表后补充 **语雀式三栏 + 可拖拽右栏**（`react-resizable-panels`、`feature-drawer`、v4 **`Panel`** 尺寸字符串约定）；**右栏行为**（非标签管理/非回收站占位时显示；无选中 → 板块摘要 / 文件夹信息；选中 → **`ProjectLibraryPreviewPanel`**；收起后单击 **`ensureFeatureDrawerOpen`**；顶栏收起/展开）。
- **修改**：[`docs/PROJECT_PILOT_Implementation_Plan.md`](../docs/PROJECT_PILOT_Implementation_Plan.md) — 文首 **更新日期** 修订；在数据库设计与 Phase 1 之间新增 **「补充：资料库 `/library` 前端布局与右栏（已实现）」** 表格（主路径与 README 交叉引用）。
- **修改**：[`docs/PROJECT_PILOT_v0.1_设计文档.md`](../docs/PROJECT_PILOT_v0.1_设计文档.md) — 技术栈章增加 **§5.1 资料库主界面（Web）** 与实现对齐的简要说明。
- **修改**：[`CHANGELOG_2026-05-08.md`](./CHANGELOG_2026-05-08.md) — **「## 文档」** 列表追加 README 右栏要点、实现计划补充小节、v0.1 §5.1。

### 11) GitHub topics 同步为领域标签 + 前端展示统一

- **新建**：[`backend/app/services/tag_normalize.py`](../backend/app/services/tag_normalize.py) — **`normalize_tag_name`**。  
- **修改**：[`backend/app/api/tags.py`](../backend/app/api/tags.py) — 创建/重命名使用 **`normalize_tag_name`**。  
- **新建**：[`backend/app/services/project_tags_from_topics.py`](../backend/app/services/project_tags_from_topics.py) — **`sync_project_tags_from_github_topics`**。  
- **修改**：[`backend/app/services/github_enrich.py`](../backend/app/services/github_enrich.py) — **`commit`** 前调用同步。  
- **修改**：[`backend/app/api/projects.py`](../backend/app/api/projects.py) — **`POST /projects`**：拉取失败且 **`body.topics`** 非空时同步并 **`commit`**。  
- **修改**：[`frontend/src/components/project/project-github-card.tsx`](../frontend/src/components/project/project-github-card.tsx)、[`project-library-preview-panel.tsx`](../frontend/src/components/project/project-library-preview-panel.tsx) — **`topicSlots`** 仅 **`language`**，领域标签仅 **`tags`**。  
- **验证**：`npm run build`；`python -c` 导入冒烟。

### 12) README：topics 与标签说明

- **修改**：[`README.md`](../README.md) — 标签库要点中补充 **GitHub topics 同步为领域标签**（新建默认未分类；已存在标签保留分类）；**不**在本迭代根据远端移除自动删 **`project_tags`**。

---

## 验证记录

- **自动化**：`cd frontend && npm run build`、`npm run lint`。  
- **手工**：标签分类下拖拽至另一栏 / 栏缝 / 栏内空白处松手，列表与 **`PATCH`** 一致；松手后浮层立即消失、无退回动画；首列选中描边完整可见。
- **手工（卡片）**：`/library` **单击**卡片在右侧 **`feature-drawer`** 显示预览；**双击**进入 `/projects/:id`；右栏内 **删除 / 编辑简介 / 管理标签**；**「查看完整详情」** 进入详情页；标题下 GitHub 链仍可新开；拖拽归类仍可用；拖动分隔条时右栏宽度**不低于约 280px**（随视口变化为比例约束）；主区/右栏比例为 **`"xx%"`** 字符串配置，**勿**对 **`maxSize`/`defaultSize`** 误传裸数字（**v4 下为 px**）。
- **文档**：README / Implementation Plan / v0.1 设计文档 / `CHANGELOG_2026-05-08` 内链接与章节标题可正常跳转，与当前前端行为一致。
- **手工（topics 同步）**：有 Token 时添加带 GitHub topics 的仓库 → **`GET /projects/:id`** 的 **`tags`** 含对应名称；**`GET /tags`** 新建项 **`category_id`** 为 null；预建同名已分类标签后再添加项目 → **分类不变** 且项目已关联。
