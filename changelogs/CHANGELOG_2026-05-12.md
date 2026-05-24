# 更新日志（2026-05-12）

## 范围

- **资料库文件夹 / 文件夹总览主区**：当当前层级 **没有子文件夹**（`folder` 下 `children` 为空，或 `folders_all` 下根级文件夹列表为空）时，**不再展示**「子文件夹 (n)」区块（含「暂无子文件夹。」）、**不再展示**「项目 (n)」标题行与 **「显示子文件夹内项目」** 复选框；主区 **仅保留** 项目卡片网格或「此处暂无 GitHub 项目条目。」。
- **无障碍**：上述简化模式下，项目区域 `section` 使用 **`aria-label="项目"`**，不再依赖可见 `h2` 的 `aria-labelledby`。
- **子文件夹网格**：有子级时 **上图标、下名称**；图标为 **`lucide-react` `Folder`**（`size-14`、`stroke-[1.25]`、`text-muted-foreground`，与改版前线框一致）；**「n 项」** 仅通过 **`title` / `aria-label`** 提示；弱化卡片边框，网格 **`grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6`**。
- **文件夹进入方式**：**侧栏树**为 **单击即进入** 该文件夹主区；**主区子文件夹磁贴**为 **单击仅选中**（待定高亮）、**双击进入**；切换预设、顶栏后退 / 前进或 **`setLibraryScope`** 时清除磁贴待定。

---

## 代码变更

### 1) `LibraryHomePage` 无子级时简化布局

- **修改**：[`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx)  
  - 新增 **`simplifyFolderDetail`**：`showFolderGrid && catalogFolders.length === 0`。  
  - 子文件夹 **`section`** 仅在 **`showFolderGrid && tree && catalogFolders.length > 0`** 时渲染。  
  - `folder` / `folders_all` 且 **`simplifyFolderDetail`** 时跳过「项目」标题行与复选框；项目 **`section`** 在简化时设 **`aria-label="项目"`**，否则 **`aria-labelledby="lib-files-heading"`**。

### 2) `SubfolderTile` 与子文件夹网格

- **新建**：[`frontend/src/components/library/subfolder-tile.tsx`](../frontend/src/components/library/subfolder-tile.tsx) — **`SubfolderTile`**：`Folder` 线框 + 名称，`title` / `aria-label` 含项数，**`hover:bg-muted/50`** 与选中 **`ring`**。  
- **修改**：[`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx) — 子文件夹列表改用 **`SubfolderTile`**，网格列数见上文；磁贴使用 **`onFolderRowClick`**，**`selected`** 含 **`pendingFolderId`**。

### 3) 侧栏单击进入；主区磁贴单击选中、双击进入

- **修改**：[`frontend/src/context/library-selection.tsx`](../frontend/src/context/library-selection.tsx) — 移除 **`onFolderRowClick`**；新增 **`setBrowsePendingFolderId`**（仅主区磁贴待定）；**`setLibraryScope`** / **`setSelectedFolderId`** / 后退、前进仍清除待定。  
- **修改**：[`frontend/src/components/layout/library-folder-tree.tsx`](../frontend/src/components/layout/library-folder-tree.tsx) — 文件夹行 **单击** 即 **`setLibraryScope({ kind: "folder", folderId })`**（与非 `/library` 时 **`navigate("/library")`**）；高亮仅 **`entered`**。  
- **修改**：[`frontend/src/components/library/subfolder-tile.tsx`](../frontend/src/components/library/subfolder-tile.tsx) — 支持 **`onOpen`**（**`dblclick`**）；`title` 含 **「双击进入」** 提示。  
- **修改**：[`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx) — 磁贴 **`onSelect` → `setBrowsePendingFolderId`**，**`onOpen` → `setLibraryScope`**。

---

## 验证记录

- **自动化**：`npm run build`、`npm run lint`（`frontend/`）。
- **手工**：有子文件夹 → 仍见子文件夹区与「项目」行及复选框，子文件夹为 **Lucide 文件夹图标 + 名称**；叶子文件夹或根下无文件夹 → 仅项目卡片或空文案；**侧栏**文件夹 **单击进入**；**主区磁贴** **单击选中、双击进入**。
