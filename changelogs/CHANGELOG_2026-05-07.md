# 更新日志（2026-05-07）

> **注**：§1–§3 初稿曾误写「完全无 GUI」；同日 **§4** 已更正为 **主界面 = Web UI**，「不要 GUI」特指 **不做 Tkinter/原生桌面壳**。

## 范围

- 引入与前仓一致的协作文档结构：`AGENTS.md`、`WORKSPACE.md`（已按 Project Pilot 适配）。
- ~~明确「无 GUI」~~ → **§4 更正**：含 **`frontend/` Web UI**，不含 Tkinter。
- 建立 `changelogs/` 目录与按日归档约定；更新根目录 `README.md` 与索引。

---

## 代码变更

### 1) 新增协作文档

- 影响文件：
  - [`AGENTS.md`](../AGENTS.md)
  - [`WORKSPACE.md`](../WORKSPACE.md)
- 变更内容：
  - 约定 API 优先、无图形客户端、变更写当日 changelog。
  - 说明 `frontend/` 若存在仅为遗留/试验，不作为默认交付。
- 目的：让 AI 与后续开发在统一边界下协作。

### 2) 新增 changelogs 体系

- 影响文件：
  - [`changelogs/README.md`](README.md)
  - [`changelogs/CHANGELOG_2026-05-07.md`](CHANGELOG_2026-05-07.md)（本文件）
- 变更内容：命名规则、索引、模板；当日多条变更合并于本文件。
- 目的：与参考项目 `disclosureDataCollect/changelogs` 习惯对齐。

### 3) 更新根 README

- 影响文件：[`README.md`](../README.md)
- 变更内容：删除以 GUI 为主的启动说明；改为 API/OpenAPI 使用方式；对 `frontend/` 作遗留说明。
- 目的：与「无 GUI 端」定位一致。

---

## 验证记录

### 自动化

- 未运行（本次以文档与结构为主）。

### 手工确认

- 根目录存在 `AGENTS.md`、`WORKSPACE.md`、`changelogs/README.md`、`changelogs/CHANGELOG_2026-05-07.md`。
- 见当日 §4：`README.md` 与协作文档已统一为 **Web UI + API**，并区分「无 Tkinter」。

---

## 后续建议

- （已由 §5）`contracts/openapi.json` 与导出脚本已落地；后续 API 变更须随改随导出。
- （已由 §4 更正）主界面为 Web UI，**不应**再建议移除 `frontend/` 除非产品范围变更。

---

### 4) 更正产品表述：Web UI 为主，非「无 GUI」

- **背景**：此前误将「不使用 Tkinter」写成「完全无 GUI」，与实现不符。
- **更正**：
  - **有 GUI**：主界面为 **`frontend/` Web UI**（React + Vite + Refine + shadcn/ui）。
  - **无**：**Tkinter / 原生桌面客户端**（与 disclosureDataCollect 的 `client/` 形态区分）。
- **影响文件**：[`AGENTS.md`](../AGENTS.md)、[`WORKSPACE.md`](../WORKSPACE.md)、[`README.md`](../README.md)（已重写相关段落并恢复前端启动说明）。

---

### 5) 引入 `contracts/` 与 OpenAPI 导出脚本

- **范围**：建立可提交的 [`contracts/openapi.json`](../contracts/openapi.json)，在后端变更 API 时同步更新。
- **新增文件**：
  - [`contracts/README.md`](../contracts/README.md) — 契约说明与更新命令。
  - [`scripts/export_openapi.py`](../scripts/export_openapi.py) — 从 `app.main:app` 生成 OpenAPI，无需启动 uvicorn。
- **文档**：[`AGENTS.md`](../AGENTS.md)、[`WORKSPACE.md`](../WORKSPACE.md)、[`README.md`](../README.md) — 明确「改 API → 运行导出 → 提交契约」。
- **验证**：已执行 `python scripts/export_openapi.py`，生成当前仅含 `/`、`/health` 的 OpenAPI 3.1 快照。

---

### 6) Phase 1 前半：projects 表、CRUD API、Refine 列表与看板

- **后端**
  - [`backend/app/models/project.py`](../backend/app/models/project.py) — `projects` 表，状态四值：未体验 / 正在体验 / 推荐归档 / 放弃归档；`deploy_methods` 为 JSON。
  - [`backend/app/api/projects.py`](../backend/app/api/projects.py) — `GET/POST/PATCH/DELETE /projects`，列表支持 `state`、`_start`/`_end` 分页，响应头 `X-Total-Count`（与 Refine `simple-rest` 一致）。
  - [`backend/app/core/database.py`](../backend/app/core/database.py) — 启动时 `init_db()` 建表。
- **前端**
  - [`frontend/src/pages/projects/list.tsx`](../frontend/src/pages/projects/list.tsx) — 列表 + 简单创建表单 + 删除。
  - [`frontend/src/pages/projects/board.tsx`](../frontend/src/pages/projects/board.tsx) — 四列看板，下拉改状态即 `PATCH`。
  - [`frontend/src/App.tsx`](../frontend/src/App.tsx) — 路由与 `resources` 注册。
- **契约**：已重新运行 `python scripts/export_openapi.py` 更新 [`contracts/openapi.json`](../contracts/openapi.json)。
- **验证**：`npm run build` / `npm run lint`；backend `TestClient` 跑通 CRUD。

---

> **§7 及后续前端壳层与侧栏相关变更**（语雀式布局与 mock-shelf、功能区 + API 库树、`sort_order`、右键与拖拽等）已记入 **[更新日志（2026-05-08）](./CHANGELOG_2026-05-08.md)**，本文件不再重复展开。
