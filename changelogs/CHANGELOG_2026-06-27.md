# 更新日志（2026-06-27）

## 范围

- **资料库筛选**：`LibraryBrowseToolbar` 启用 **按添加时间**筛选（最近 7/30/90/365 天），基于项目 `created_at` 客户端过滤，与标签/文件夹筛选组合。
- **看板移出产品**：功能区无看板入口；`/projects/board` 重定向至项目库（`BOARD_NAV_ENABLED=false`）。
- **产品方向文档**：明确 **不再做**看板模块、部署日志、部署辅助；重心为资料库 + 详情 + 内容工厂 — 见 v0.1 [§0](../docs/PROJECT_PILOT_v0.1_设计文档.md#0-方向修订2026-06-27)、Implementation Plan v1.2、待办清单重写。
- **桌面 v0.2.0 发版准备（阶段 A）**：版本号统一 **0.2.0**；`build-desktop.ps1` 产出 NSIS 安装包；修复 `src-tauri/Cargo.toml` 与 sidecar 版本不一致导致 health 超时；安装包复制至 `release-artifacts/`（未进 git）。

---

## 代码变更

### 1) 资料库按添加时间筛选

- **新建**：[`frontend/src/components/library/library-added-time-filter-panel.tsx`](../frontend/src/components/library/library-added-time-filter-panel.tsx) — Popover 快捷范围（7/30/90/365 天）。
- **修改**：[`frontend/src/lib/library-project-filters.ts`](../frontend/src/lib/library-project-filters.ts) — `AddedTimePreset`、`filterByAddedTime`、`addedTimePreset` 纳入 `applyLibraryFilters` / `hasActiveLibraryFilters`。
- **修改**：[`frontend/src/context/library-browse-filters.tsx`](../frontend/src/context/library-browse-filters.tsx) — 状态与 `setAddedTimePreset`。
- **修改**：[`frontend/src/components/library/library-browse-toolbar.tsx`](../frontend/src/components/library/library-browse-toolbar.tsx) — 替换「时间（即将支持）」占位为可用筛选钮。
- **修改**：[`frontend/src/pages/library/home.tsx`](../frontend/src/pages/library/home.tsx) — 列表应用添加时间过滤。
- **新建**：[`frontend/src/lib/library-project-filters.test.ts`](../frontend/src/lib/library-project-filters.test.ts) — `filterByAddedTime` 单测。

### 2) 看板移出产品

- **新建**：[`frontend/src/config/feature-flags.ts`](../frontend/src/config/feature-flags.ts) — `BOARD_NAV_ENABLED = false`（长期关闭）。
- **修改**：[`frontend/src/components/layout/function-rail.tsx`](../frontend/src/components/layout/function-rail.tsx) — 不渲染看板 NavLink。
- **修改**：[`frontend/src/App.tsx`](../frontend/src/App.tsx) — `/projects/board`、`/projects` 重定向至 `/libraries`。

### 3) 产品方向与文档（v1.2）

- **修改**：[`docs/PROJECT_PILOT_v0.1_设计文档.md`](../docs/PROJECT_PILOT_v0.1_设计文档.md) — 新增 **§0 方向修订**；看板/部署日志标为历史设想。
- **修改**：[`docs/PROJECT_PILOT_Implementation_Plan.md`](../docs/PROJECT_PILOT_Implementation_Plan.md) — v1.2；Phase 3/4 与优先级表对齐新方向。
- **修改**：[`docs/PROJECT_PILOT_待办清单_2026-06-27.md`](../docs/PROJECT_PILOT_待办清单_2026-06-27.md) — 移除部署日志 P0；看板/部署相关标 `[~]`。
- **修改**：[`README.md`](../README.md) — 首段产品定位与当前主线一致。

### 4) 桌面 v0.2.0 发版准备（阶段 A）

- **修改**：[`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json)、[`frontend/package.json`](../frontend/package.json)、[`backend/app/main.py`](../backend/app/main.py)、[`contracts/openapi.json`](../contracts/openapi.json) — 版本 **0.2.0**。
- **修改**：[`src-tauri/Cargo.toml`](../src-tauri/Cargo.toml) — `version = "0.2.0"`（Rust `CARGO_PKG_VERSION` 与 sidecar `/health` 校验一致；发版前遗漏会导致 shell 忽略 0.2.0 sidecar）。
- **构建**：仓库根 `.\scripts\build-desktop.ps1` → `Project Pilot_0.2.0_x64-setup.exe`（约 53.7 MB）。
- **本地资产**：`release-artifacts/Project Pilot_0.2.0_x64-setup.exe`（`.gitignore`，勿 commit）。

---

## 验证记录

- **自动化（功能）**：`cd frontend && npm run test -- library-project-filters`；`npm run build`。
- **手工（功能）**：资料库任意项目列表 → 筛选栏 **添加时间** → 选「最近 7 天」→ 列表仅保留近期收录项目 →「清除筛选」恢复；功能区无看板图标；直接打开 `/projects/board` 应跳转 `/libraries`。
- **自动化（桌面发版 A1）**：`cd backend && python -m pytest -q` → **191 passed**；`cd frontend && npm run build` → 通过；`npm run lint` → 既有 debt（27 errors，未阻塞打包）。
- **自动化（桌面发版 A3～A4）**：
  - `.\scripts\build-desktop.ps1` → NSIS `Project Pilot_0.2.0_x64-setup.exe` 产出。
  - `src-tauri\target\release\project-pilot.exe` 启动 → `http://127.0.0.1:38472/health` → `{"status":"ok","version":"0.2.0"}`；`desktop.log` 含 `sidecar healthy`、`main window created`。
  - 关窗后任务管理器 **无** 残留 `project-pilot-api.exe`。
  - NSIS `/S` 静默安装 → `%LOCALAPPDATA%\ProjectPilot\database\project_pilot.db` 已存在。
  - `release-artifacts/` 已复制安装包（未 git add）。
- **手工（桌面发版 §6.2，建议发版前再确认）**：
  - [ ] 从开始菜单启动 0.2.0 安装版 → 欢迎页 / PAT 门控（桌面库 **≠** dev `backend/project_pilot.db`）。
  - [ ] 资料库 / 发现 / 内容工厂主流程可进入。
  - [ ] 外链（GitHub 等）→ 系统浏览器（`desktop.log` 含 `open external:`）。
  - [ ] 账户菜单 footer 显示 `Project Pilot v0.2.0`。
  - [ ] 卸载后用户数据默认保留。

---

## 后续建议

- 添加时间若需 **自定义起止日期**，可扩展为双日期控件或走后端 query。
- 详情页 `projects.state` / `deploy_methods` 若长期不用，可后续 UI 弱化或迁移为纯内部字段。
- **阶段 B**：GitHub Release（tag `v0.2.0`、上传 exe、README Releases 链接）— 就绪后新对话说「带我做 Release v0.2.0」。
