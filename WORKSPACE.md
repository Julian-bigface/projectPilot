# Workspace Overview（Project Pilot）

本仓库为 **Project Pilot**：**FastAPI + SQLite** 后端，配合 **`frontend/` Web UI**（React + Vite + TypeScript，**Refine + shadcn/ui**）。用户通过浏览器访问本地前端，前端再调用后端 REST API。

**说明**：**不做 Tkinter 等原生桌面 GUI**；与旧项目中「过渡期桌面客户端」不同，本仓库**不设** `client/` 式 Tkinter 应用，**主交互即 Web**。

## 子系统

| 目录 | 说明 |
|------|------|
| `backend/` | FastAPI：`app/main.py` 入口；`app/api/` 路由；`app/models/`、`app/schemas/`；`app/core/` 配置与异步数据库会话。 |
| `frontend/` | **Web 界面**（Vite + React + TS + Refine + shadcn/ui）；开发默认 `http://localhost:5173`，详见根目录 [`README.md`](README.md)。 |
| `docs/` | 产品设计、实现计划与思路笔记。 |
| `changelogs/` | 按日变更日志，见 [`changelogs/README.md`](changelogs/README.md)。 |
| `contracts/` | **OpenAPI 契约**：[`contracts/openapi.json`](contracts/openapi.json) 为与当前后端一致的可提交快照，见 [`contracts/README.md`](contracts/README.md)。 |
| `scripts/` | 工具脚本，如 [`scripts/export_openapi.py`](scripts/export_openapi.py) 用于重新生成契约。 |

## 本地开发

| 服务 | 地址 / 命令 |
|------|-------------|
| **后端 API** | `http://127.0.0.1:8000`；在 `backend/`：`python -m pip install -e ".[dev]"`，复制 `.env.example` 为 `.env` 后 `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`。 |
| **OpenAPI** | `http://127.0.0.1:8000/docs`；`http://127.0.0.1:8000/openapi.json`。 |
| **Web 前端** | 默认 `http://localhost:5173`；在 `frontend/`：`npm install`、`npm run dev`（见根 [`README.md`](README.md)）。Vite 将 `/api` 代理到后端并去掉前缀。 |

## CORS

后端 [`backend/app/main.py`](backend/app/main.py) 中 `CORSMiddleware` 默认包含本地 Vite 源（如 `localhost:5173`）。生产或自定义端口时请改为实际来源。

## 契约（Source of Truth）

- **仓内快照**：[`contracts/openapi.json`](contracts/openapi.json) 为 AI 与前端协作时的稳定引用；**每次后端 API 变更后**在根目录执行 `python scripts/export_openapi.py` 更新并提交。
- **运行中服务**：`http://127.0.0.1:8000/openapi.json` 应与上述快照由同一 `app` 生成，内容一致。

## Cursor 工作区

请在仓库 **根目录** `10_ProjectPilot` 打开 Cursor，使 `backend`、`frontend`、`contracts`、`docs`、`changelogs` 处于同一上下文。

## 规则摘要

- API 或模型变更：同步 **`frontend/`** 调用层与类型；**并运行** `python scripts/export_openapi.py` **更新** `contracts/openapi.json`。
- **每次迭代**：追加当日 [`changelogs/CHANGELOG_YYYY-MM-DD.md`](changelogs/README.md)。
- **GUI 口径**：**Web UI = 主 GUI**；**非 Tkinter / 非原生桌面壳**。
