---
description: Project Pilot 仓库内 AI 与开发者协作约定
alwaysApply: true
---

# AI Collaboration Guide（Project Pilot）

面向在本仓库内协作的 AI 与开发者：本项目**通过浏览器 Web UI 使用**（`frontend/`），后端为 **FastAPI + 本地 SQLite**。**不包含 Tkinter、Qt 等原生桌面 GUI**，也**不以 disclosureDataCollect 式的 `client/` 桌面壳**作为交互面。

## 产品边界（必读）

- **主界面（GUI）**：**Web UI** — `frontend/`（React + Vite + TypeScript，路线 **Refine + shadcn/ui**），本地开发通常为 `http://localhost:5173`，经代理调用后端 API。
- **不做**：**Tkinter / WinForms / Qt** 等嵌入式桌面 GUI；若文档或讨论中出现「不要 GUI」，在本仓库语境中指 **不要这类原生桌面 GUI**，**不是**「不要 Web」。
- **后端契约**：能力以 **FastAPI 路由 + OpenAPI（`/docs`、`/openapi.json`）** 暴露；新增业务优先落实为 **REST 资源与 Pydantic 模型**，并在 Web 侧对接。

## 项目组成

- **`backend/`**：FastAPI 应用；入口 [`backend/app/main.py`](backend/app/main.py)；路由置于 [`backend/app/api/`](backend/app/api/)；配置与数据库会话见 [`backend/app/core/`](backend/app/core/)。
- **`frontend/`**：**正式 Web 界面**（Vite + React + TS + Refine + shadcn/ui）；本地启动见根目录 [`README.md`](README.md)。
- **`docs/`**：产品设计、实现计划（[`docs/PROJECT_PILOT_v0.1_设计文档.md`](docs/PROJECT_PILOT_v0.1_设计文档.md)、[`docs/PROJECT_PILOT_Implementation_Plan.md`](docs/PROJECT_PILOT_Implementation_Plan.md) 等）。
- **`changelogs/`**：按日归档的变更记录，规则见 [`changelogs/README.md`](changelogs/README.md)。**每次开发迭代应追加当日文件**，同一天多次提交写在同一日文件中。
- **`contracts/`**：**API 契约快照** — [`contracts/openapi.json`](contracts/openapi.json) 与当前 FastAPI 的 `app.openapi()` 一致；说明与更新方式见 [`contracts/README.md`](contracts/README.md)。

## 修改 API 时的检查清单

1. 修改 `backend/app/api/`、`backend/app/schemas/`、`backend/app/models/`（及相关 core 配置）。
2. **在仓库根目录执行** `python scripts/export_openapi.py`，**并提交** 更新后的 [`contracts/openapi.json`](contracts/openapi.json)（与本次 API 变更同一次提交或紧随其后的提交）。
3. 检索 **HTTP 调用方**：**`frontend/`**（统一 API client / Refine `dataProvider`）、脚本、测试。
4. 若涉及鉴权：同步 Web 侧 token 与请求头（未来如有）。

## 设计原则

- **契约优先**：改动字段前对齐 OpenAPI，避免 Web 与脚本假设不一致。
- **Web 与 API 同步**：新列表/表单/看板能力对应后端资源与筛选参数；避免只做其一。
- **变更可追溯**：合并或交付前更新 [`changelogs/CHANGELOG_YYYY-MM-DD.md`](changelogs/README.md)；索引更新 [`changelogs/README.md`](changelogs/README.md)。

## Web 前端路线（Refine + shadcn）

与实现计划及 [`docs/PROJECT_PILOT_Implementation_Plan.md`](docs/PROJECT_PILOT_Implementation_Plan.md) 一致：Refine 负责资源与数据层常见模式；UI 使用 shadcn/ui（源码在仓内，便于定制）；请求经 **统一出口**（如 `src/lib/api` 或 Refine `dataProvider`），避免散落 `fetch`。

## 与 disclosureDataCollect 的差异（摘要）

| 项目 | disclosureDataCollect | Project Pilot |
|------|------------------------|---------------|
| 桌面 GUI | 过渡期 **Tkinter** `client/` | **无** Tkinter / 无该形态 `client/` |
| 主界面 | 目标 **Web** `frontend/` | **Web** `frontend/` |

## 更新日志（强制约定）

- **每天一个文件**：`changelogs/CHANGELOG_YYYY-MM-DD.md`。
- **同一天多次变更**：写入**当日同一文件**，用新增小节或列表追加。
- **建议结构**：范围 → 代码变更 → 验证记录 → 后续建议。模板见 [`changelogs/README.md`](changelogs/README.md)。
