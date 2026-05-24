# 更新日志（2026-05-24）

## 范围

- 新增 **桌面产品工程化指南**（Tauri + FastAPI sidecar + SQLite），覆盖 sidecar 生命周期、AppData、生产 `/api`、迁移、安装与更新路线图，供后续桌面化实施参照。
- **添加 GitHub 项目对话框**：输入 URL 后自动拉取 GitHub Description 填入简介（网络/Token 失败有提示）；移除「归入文件夹」下拉，按打开入口自动归入（文件夹右键 → 该文件夹；库根「文件夹」行 → 未归类）。

---

## 代码变更

### 1) 桌面工程化指南文档

- **新建**：[`docs/PROJECT_PILOT_Desktop_Engineering_Guide.md`](../docs/PROJECT_PILOT_Desktop_Engineering_Guide.md) — Phase 0～2 分阶段清单、与现有 `frontend/` / `backend/` 及 `AppSetting` 配置策略对齐。
- **文档**：关联 [AGENTS.md](../AGENTS.md)、Implementation Plan、contracts/changelog 发版检查项。

### 2) 添加 GitHub 项目：简介预览与文件夹上下文

- **新建**：[`backend/app/services/github_repo_preview.py`](../backend/app/services/github_repo_preview.py)、[`frontend/src/lib/github-repo-preview.ts`](../frontend/src/lib/github-repo-preview.ts)。
- **修改**：[`backend/app/api/projects.py`](../backend/app/api/projects.py) — `GET /projects/preview-github`；[`backend/app/schemas/project_github.py`](../backend/app/schemas/project_github.py) — `GithubRepoPreviewRead`。
- **修改**：[`frontend/src/components/layout/library-sidebar.tsx`](../frontend/src/components/layout/library-sidebar.tsx) — 去文件夹下拉；库根新建 `folder_id: null`；文件夹右键沿用 `folderId`；URL 防抖拉取简介。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json) 已导出。

---

## 验证记录

- **自动化**：`npm run build`（通过）；`python scripts/export_openapi.py`（`GET /projects/preview-github`）。
- **手工**：通读指南，确认与当前仓库结构（`vite.config.ts` 代理、`database.py` 内联迁移、`settings_github`）描述一致。
- **手工（添加项目）**：粘贴 GitHub URL 后简介自动填充；断网/无 Token 时有红色提示；库根「+」创建为未归类；文件夹右键添加归入该文件夹。
