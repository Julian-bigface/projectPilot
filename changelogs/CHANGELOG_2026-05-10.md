# 更新日志（2026-05-10）

## 范围

- **标签自定义分类 + 未分类 + 拖拽**：`tag_categories` 表与 `tags.category_id`（可空）；`/tag-categories` CRUD；`/tags` 增加 `PATCH` 与 `category_id` / `uncategorized` 查询；**移除**原 `type` / `tag_type`（**破坏性变更**，旧数据迁移后标签默认进未分类）。「标签分类」视图为**横向多栏**（未分类首栏 + 自建分类），**dnd-kit** 拖拽标签到栏内归类。
- **标签管理（Billfish 式布局）**：新增 `tags` / `project_tags` 表与 `GET/POST/DELETE /tags`；资料库 **标签管理** 主区为「所有标签 / 标签分类」Tab、搜索、创建与删除（有关联项目时禁止删除）。
- **资料库文件夹拖拽语义**：区分同级 **排序** 与 **归入子文件夹**；碰撞优先 **`nest-*`**；**Alt + 松开放入** 时同级亦可嵌套。
- **资料库侧栏「文件夹」标题行**：去掉底部分割线、与树列表视觉一体；标题字重与树行一致；缩小绿色新建按钮；与上方快捷区分割线保留顶间距。
- **侧栏文件夹树**：保留子树 **左侧竖线**；收紧每层缩进；移除 **`Collapsible.Content` 上按深度累加的 `marginLeft`**，避免层级越深横向错位异常叠加（缩进仅由每行 **`paddingLeft`** 控制）。
- **`folders_all` 主区与单文件夹视图对齐**：去掉「文件夹总览」独立顶栏；统一 **子文件夹 (n) / 项目 (n)** 区块标题与 **「显示子文件夹内项目」**；根级卡片选中描边与文件夹内一致；取消勾选时项目列表为 **仅顶层文件夹直接挂载**（[`projectsDirectInRootFoldersOnly`](../frontend/src/lib/library-tree.ts)）。

---

## 代码变更

### 0) 标签自定义分类（同日迭代）

- **后端**：[`backend/app/models/tag.py`](../backend/app/models/tag.py)（`TagCategory`、`Tag.category_id`）、[`backend/app/api/tag_categories.py`](../backend/app/api/tag_categories.py)、[`backend/app/schemas/tag_category.py`](../backend/app/schemas/tag_category.py)；[`backend/app/api/tags.py`](../backend/app/api/tags.py)、[`backend/app/schemas/tag.py`](../backend/app/schemas/tag.py)；[`backend/app/core/database.py`](../backend/app/core/database.py) `_migrate_sqlite_tags_category_and_drop_tag_type`（删 `tag_type` 列前 **`DROP INDEX IF EXISTS ix_tags_tag_type`**，避免 SQLite 索引残留报错）。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json)。
- **前端**：[`frontend/src/pages/library/tag-management.tsx`](../frontend/src/pages/library/tag-management.tsx)、[`frontend/src/types/tag.ts`](../frontend/src/types/tag.ts)（`@dnd-kit` 分类栏拖拽）。
- **文档**：[`README.md`](../README.md)、[`docs/PROJECT_PILOT_v0.1_设计文档.md`](../docs/PROJECT_PILOT_v0.1_设计文档.md)、[`docs/PROJECT_PILOT_Implementation_Plan.md`](../docs/PROJECT_PILOT_Implementation_Plan.md)。

### 0b) 标签 API 与标签管理页（首轮）

- **后端**：[`backend/app/models/tag.py`](../backend/app/models/tag.py)、[`backend/app/api/tags.py`](../backend/app/api/tags.py)、[`backend/app/schemas/tag.py`](../backend/app/schemas/tag.py)；[`backend/app/main.py`](../backend/app/main.py) 挂载 `/tags`。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json)（`python scripts/export_openapi.py`）。
- **前端**：[`frontend/src/pages/library/tag-management.tsx`](../frontend/src/pages/library/tag-management.tsx)、[`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx)、[`frontend/src/components/layout/library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx)。

### 1) `Alt` 修饰键：同级归入文件夹

- **修改**：[`frontend/src/components/layout/library-dnd-context.tsx`](../frontend/src/components/layout/library-dnd-context.tsx)  
  - 全局监听 **Alt** 键状态（`folderNestAltRef`）。  
  - 当 **`overId` 为 `folder-*`** 且 **`pDrag === pOver`**（同级）时：若 **按住 Alt**，调用 **`PATCH /api/folders/:id`**（`parent_id` = 目标文件夹），并执行与子树相关的非法移动校验（与既有嵌套分支一致）；**未按 Alt** 时仍为 **`POST /api/folders/reorder`** 同级排序。

### 2) 碰撞检测：文件夹拖拽优先 `nest-*`

- **修改**：[`frontend/src/components/layout/library-dnd-modifiers.ts`](../frontend/src/components/layout/library-dnd-modifiers.ts)  
  - 当 **`active.id` 为 `folder-*`** 时，先对 **`nest-*`** droppables 做 **`pointerWithin`**；有命中则返回，否则再 **`closestCorners`**，便于拖到文件夹行时优先判定「归入」投放区。

### 3) 文档（本次迭代补充）

- **修改**：[`README.md`](../README.md) — 资料库侧栏 **拖拽** 一句说明（排序 / `nest` 优先 / **Alt** 同级归入）。
- **修改**：[`README.md`](../README.md) — **后端** 增加 `/tags` 契约一句；**资料库主区表格** 将 **标签管理** 从占位改为 Billfish 式说明，占位仅保留「无标签 / 回收站」；文末「下一步 Phase 1」改为 **实现进度提示**（标注标签库已部分落地）。
- **修改**：[`docs/PROJECT_PILOT_Implementation_Plan.md`](../docs/PROJECT_PILOT_Implementation_Plan.md) — Phase 3 **标签系统** 勾选已完成的「数据与 API」「资料库标签管理页」，并列出仍待办项（项目绑定标签、自动生成、详情编辑）。
- **修改**：[`docs/PROJECT_PILOT_v0.1_设计文档.md`](../docs/PROJECT_PILOT_v0.1_设计文档.md) — **§4.1 主数据库** 补充 `tags` / `project_tags` 字段说明与资料库标签管理入口。
- **修改**：[`changelogs/README.md`](README.md) — 当日索引条目补充 **标签管理** 与文档同步关键词。

### 4) 侧栏 `FolderNestDropBar` 与快捷区分隔

- **修改**：[`frontend/src/components/layout/library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx)  
  - **`FolderNestDropBar`**：去掉 **`border-b`**，与下方文件夹树连成一块；标题按钮样式对齐树节点（未选中 **`hover:bg-accent/80`**，选中 **`bg-accent`**，无 **`font-medium`**）；新建 **`Button`** 由 **`size-7` → `size-6`**，**`Plus`** 图标 **`size-3.5` → `size-3`**。  
  - 容器增加 **`pt-2`**，与上方五项快捷入口底部分割线拉开间距。

### 5) 文件夹树：竖线、缩进、深层错位修复

- **修改**：[`frontend/src/components/layout/library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx)  
  - 子列表 **`Collapsible.Content`** 保留 **`border-l`** 指南线；**`TREE_INDENT_PX`** 维持紧凑（当前 **8**），子树 **`pl-1.5`**。  
  - **删除** **`style={{ marginLeft: depth * TREE_INDENT_PX + … }}`**，避免与行内 **`depth * TREE_INDENT_PX`** 的 **`paddingLeft`** 同时生效导致深层横向错位过大。

### 6) `folders_all` 主区版式与「仅顶层直接项目」

- **修改**：[`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx)  
  - **`folders_all`** 与 **`kind === "folder"`** 共用：**无顶栏**、**子文件夹** 区块同一套标题与网格、**项目** 行含计数与复选框。  
  - **`includeSubfolderProjects`** 在 **`libraryScope.kind`** 变化时重置为勾选。  
- **修改**：[`frontend/src/lib/library-tree.ts`](../frontend/src/lib/library-tree.ts) — 新增 **`projectsDirectInRootFoldersOnly`**；**`folders_all`** 下取消勾选时使用该列表。

---

## 验证记录

- `npm run build`、`npm run lint`（`frontend/`）
- 后端：`python scripts/export_openapi.py`；本地 `init_db` 后 `/tags` 冒烟（`GET`/`POST`/`DELETE`）

---

## 后续建议

- 若浏览器对 **Alt** 键有系统菜单抢占，可考虑在 UI 上加简短提示或备选修饰键。
- **标签**：实现 `PATCH /projects/{id}` 或 `PUT /projects/{id}/tags` 与侧栏 **无标签** 筛选，使 `usage_count` 与业务闭环。
