# Project Pilot — 桌面产品工程化指南

> 文档版本：v1.0  
> 更新日期：2026-05-24  
> 适用架构：**Tauri 2 + React（现有 `frontend/`）+ FastAPI sidecar（现有 `backend/`）+ SQLite**  
> 关联文档：[PROJECT_PILOT_v0.1_设计文档.md](./PROJECT_PILOT_v0.1_设计文档.md)、[PROJECT_PILOT_Implementation_Plan.md](./PROJECT_PILOT_Implementation_Plan.md)、[AGENTS.md](../AGENTS.md)

---

## 一、文档目的与产品边界

本指南用于指导 Project Pilot 从 **「浏览器 + 本地双进程开发」** 演进到 **「可安装、可更新、数据安全的桌面产品」**。

### 1.1 不变的产品边界

与 [AGENTS.md](../AGENTS.md) 一致：

| 保留 | 不做 |
|------|------|
| **Web UI**（`frontend/`：React + Refine + shadcn/ui）作为唯一正式界面 | 用 Tkinter / Qt / WinForms **重写** UI |
| 业务能力以 **FastAPI REST + OpenAPI** 暴露 | 为桌面单独再写一套业务 API |
| 契约优先：API 变更同步 [`contracts/openapi.json`](../contracts/openapi.json) | 桌面与 Web 各维护一套接口假设 |

### 1.2 桌面化意味着什么

桌面化 **不是** 重写产品，而是补齐 **部署与运行时**：

- **Tauri**：窗口、托盘、单实例、安装包、自动更新、sidecar 生命周期。
- **Sidecar**：将现有 FastAPI 打成独立可执行文件，由 Tauri 在本地启动/停止。
- **AppData**：SQLite、日志、非敏感配置与安装目录分离。
- **生产态 API 路由**：开发时的 Vite `/api` 代理在生产环境要有等价方案。

---

## 二、目标架构

### 2.1 运行时结构

```text
用户双击「Project Pilot」
        │
        ▼
┌───────────────────────────────────────┐
│  ProjectPilot.exe（Tauri / Rust）      │
│  · 创建 WebView 窗口                   │
│  · 启动 / 监控 / 停止 sidecar          │
│  · 单实例、更新、系统托盘（可选）       │
└───────────────┬───────────────────────┘
                │ 启动
                ▼
┌───────────────────────────────────────┐
│  project-pilot-api.exe（FastAPI sidecar）│
│  · 仅监听 127.0.0.1:<port>             │
│  · 读写 AppData 下 SQLite              │
│  · GET /health 就绪后 UI 才显示        │
└───────────────┬───────────────────────┘
                │ HTTP（/api/...）
                ▼
┌───────────────────────────────────────┐
│  WebView 加载 React 静态资源（dist/）   │
│  · Refine dataProvider("/api")        │
│  · 各处 fetch("/api/...")             │
└───────────────────────────────────────┘
```

### 2.2 与当前开发态的差异

| 维度 | 开发态（现在） | 桌面生产态（目标） |
|------|----------------|-------------------|
| 前端 | Vite dev `localhost:5173` | Tauri 加载 `frontend/dist` |
| API 转发 | Vite `proxy /api → :8000`（见 [`frontend/vite.config.ts`](../frontend/vite.config.ts)） | 同源 `/api` 或固定 `127.0.0.1:<port>/api` |
| 后端启动 | 手动 `uvicorn` | Tauri 自动拉起 sidecar |
| 数据库 | `backend/` 下 `./project_pilot.db` | `%LOCALAPPDATA%\ProjectPilot\database\` |
| CORS | `localhost:5173`（见 [`backend/app/core/config.py`](../backend/app/core/config.py)） | 生产 origin 或同源 |

### 2.3 关于「两个 exe」

安装目录内通常 **至少两个可执行文件**：

```text
C:\Program Files\ProjectPilot\
  ProjectPilot.exe              ← 用户唯一入口（快捷方式指向此文件）
  project-pilot-api.exe         ← sidecar，不单独暴露给用户
  resources/                    ← 前端 dist、图标等
```

用户感知上是 **一个软件**；磁盘上多一个 sidecar 是 **Tauri + Python 栈的正常形态**，与 VS Code、多数 Electron 应用「一个入口 + 多个内部组件」同类。

---

## 三、Sidecar（核心机制）

### 3.1 定义

**Sidecar** 指与主程序 **一起安装、由主程序启动** 的辅助进程。在本项目中即 **打包后的 FastAPI（uvicorn）**。

Tauri **不会** 在 `tauri build` 时自动包含 Python；需单独 pipeline：

1. 用 **PyInstaller**（或同类工具）将 `uvicorn app.main:app` 及依赖打成 `project-pilot-api-<target-triple>.exe`。
2. 在 `src-tauri/tauri.conf.json` 的 `bundle.externalBin`（Tauri 2 sidecar）中声明。
3. 在 Rust 启动逻辑中：`Command::new_sidecar("project-pilot-api")` → 传入环境变量 → 等待 `/health` → 再显示窗口。
4. 应用退出时 **必须终止** sidecar，避免端口占用与僵尸进程。

### 3.2 Sidecar 启动时必须注入的环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | SQLite 绝对路径 | `sqlite+aiosqlite:///%LOCALAPPDATA%/ProjectPilot/database/project_pilot.db` |
| `HOST` | 仅本机 | `127.0.0.1` |
| `PORT` | 动态或固定本地端口 | `38472`（需处理占用） |
| `CORS_ORIGINS` | WebView 来源（若前后端不同源） | 按 Tauri 实际 origin 配置 |

可选：`LOG_DIR`、`APP_DATA_DIR` 等，供日志与缓存统一路径。

### 3.3 健康检查与启动顺序

1. Tauri 进程启动 → 检查 **单实例**（已有实例则聚焦窗口并退出）。
2. 启动 sidecar，传入上述环境变量。
3. 轮询 `GET http://127.0.0.1:<port>/health`（现有路由见 [`backend/app/main.py`](../backend/app/main.py)）。
4. 成功后加载 WebView；超时则提示用户查看日志并退出。
5. 用户关闭窗口 → Tauri 发送终止信号给 sidecar → 确认进程结束。

### 3.4 生产态 `/api` 路由（二选一，优先 A）

**方案 A — FastAPI 同时提供静态前端 + `/api` 前缀（推荐，同源简单）**

- `npm run build` 产出 `frontend/dist`。
- FastAPI 挂载 `StaticFiles`，API 路由统一加 `/api` 前缀（与前端 `dataProvider("/api")` 一致）。
- WebView 加载 `http://127.0.0.1:<port>/`。
- CORS 压力小；需改后端路由前缀或子应用挂载。

**方案 B — Tauri 托管静态资源，API 仍走 sidecar**

- 前端 build 后由 Tauri 内置 asset 服务。
- 请求需指向 `http://127.0.0.1:<port>/...`（**无** `/api` 前缀，与现后端路径一致），或通过 Tauri 插件做本地代理。
- 需在前端统一 `VITE_API_URL`（[`frontend/.env.example`](../frontend/.env.example) 已预留，代码层需收口）。

**开发态保持不变**：仍用 Vite proxy；桌面改造不应破坏 `npm run dev` + `uvicorn` 工作流。

---

## 四、用户数据目录（AppData）

### 4.1 原则

| 位置 | 放什么 | 原因 |
|------|--------|------|
| `Program Files\ProjectPilot\` | 程序、sidecar、只读资源 | 安装目录；卸载可删；可能无写权限 |
| `%LOCALAPPDATA%\ProjectPilot\` | SQLite、日志、缓存、非敏感配置 | 用户数据；升级/卸载不丢库 |

Windows 推荐根路径：`C:\Users\<用户>\AppData\Local\ProjectPilot\`

### 4.2 推荐目录结构

```text
%LOCALAPPDATA%\ProjectPilot\
├── database\
│   └── project_pilot.db
├── logs\
│   ├── tauri.log
│   └── backend.log
├── cache\              # 可选：GitHub 响应、缩略图等
└── config\
    └── desktop.toml    # 非敏感项：语言、代理、上次窗口尺寸等
```

**不要** 在 `%LOCALAPPDATA%` 下再嵌套一层 `AppData\`。

### 4.3 与现有代码的衔接

当前默认（需桌面化时改掉）：

```python
# backend/app/core/config.py
database_url: str = "sqlite+aiosqlite:///./project_pilot.db"
```

桌面 sidecar 启动时 **必须** 覆盖为 AppData 下的绝对路径。开发环境可继续用相对路径或 `.env`。

---

## 五、配置与敏感信息

### 5.1 沿用现有后端能力，不重复造轮子

Project Pilot **已有**：

- **GitHub PAT**：存于 SQLite `AppSetting`（[`backend/app/services/settings_github.py`](../backend/app/services/settings_github.py)），Web 设置页 [`/settings/github`](../frontend/src/pages/settings/github.tsx) 可编辑。
- **OpenAI Key 等**：[`backend/app/core/config.py`](../backend/app/core/config.py) 环境变量 + 未来可扩展 DB 存储。

桌面化时 **不要** 新建明文 `settings.json` 存放 `github_token`。

### 5.2 推荐策略

| 配置类型 | 存储位置 | 说明 |
|----------|----------|------|
| GitHub Token、业务设置 | SQLite（现有 `AppSetting` + 设置 API） | 与 Web 版一致；备份即备份 `.db` |
| 仅桌面运行时参数 | sidecar 环境变量（Tauri 注入） | `DATABASE_URL`、`PORT` |
| 非敏感用户偏好 | `%LOCALAPPDATA%\...\config\desktop.toml` 或继续 `localStorage` | 主题等前端已在 `localStorage` |
| CI / 开发 | `backend/.env` | 不打包进安装包 |

### 5.3 安全要点

- sidecar **只绑定 `127.0.0.1`**，不暴露局域网。
- 发布前评估 Windows **代码签名**，减少 SmartScreen 拦截。
- 日志中 **禁止** 打印完整 Token。

---

## 六、数据库迁移（Migration）

### 6.1 现状

项目在 [`backend/app/core/database.py`](../backend/app/core/database.py) 的 `init_db()` 中已有 **内联 SQLite 迁移**（`_migrate_sqlite_*` 系列）：启动时 `create_all` + 按列/表增量 `ALTER`。

这对早期迭代有效；**桌面发版后** 必须保证：

- 旧用户升级到新版本时 **自动升级 schema**；
- 迁移 **幂等**（重复启动不报错）；
- 发版说明与 **app 版本** 对应。

### 6.2 演进路线

| 阶段 | 做法 |
|------|------|
| **Phase 0～1** | 延续内联迁移；新增 `app_meta` 或 `schema_version` 表记录版本号 |
| **Phase 2+** | 引入 **Alembic**（与 SQLAlchemy 2.0 async 配套），revision 与 Git tag 对齐 |

原则：**用户数据永远不能因升级而丢失**。重大 migration 前建议自动备份 `%LOCALAPPDATA%\...\database\project_pilot.db`。

### 6.3 与自动更新的关系

Tauri updater 替换二进制后，用户首次启动新版本 → sidecar `init_db()` 跑迁移 → 再服务 API。  
若 migration 失败：阻止进入主界面，日志写明原因，保留原 db 文件。

---

## 七、日志（Logs）

### 7.1 目标

用户反馈「打不开」时，可通过 `%LOCALAPPDATA%\ProjectPilot\logs\` 定位问题。

### 7.2 建议内容

| 文件 | 记录方 | 内容 |
|------|--------|------|
| `backend.log` | FastAPI / uvicorn | API 异常、GitHub 请求失败、DB 错误 |
| `tauri.log` | Rust | sidecar 启停、端口、更新器错误 |

### 7.3 实现要点

- Python：`logging` 输出到文件（RotatingFileHandler），路径由 `LOG_DIR` 环境变量决定。
- Rust：`log` + 文件或 tracing。
- 可选：设置页增加「打开日志目录」按钮（调用 Tauri shell API）。

---

## 八、安装器（Installer）

### 8.1 Tauri 自带打包

```powershell
cd frontend   # 或配置好 monorepo 根目录后
npm run tauri build
```

典型产物（Windows）：

- `ProjectPilot_x64_en-US.msi`
- 或 NSIS `setup.exe`

安装器负责：复制 `ProjectPilot.exe`、sidecar、`resources/`、注册卸载项、创建开始菜单/桌面快捷方式。

### 8.2 构建前置条件

- Node.js 20+、Rust toolchain、WebView2（Win10/11 通常已带）。
- **先** 构建 sidecar exe，**再** `tauri build`（CI 中串行步骤）。
- 前端：`npm run build` 产出 `dist/`。

### 8.3 仓库内建议增加的脚本目录

保持现有 **`frontend/`、`backend/` 根目录布局**，不强制改为 `apps/`  monorepo。新增：

```text
ProjectPilot/
├── frontend/           # 现有；增加 Tauri 配置引用
├── backend/            # 现有
├── src-tauri/          # 新增：Rust 壳 + tauri.conf.json
├── scripts/
│   ├── build-sidecar.ps1
│   ├── build-desktop.ps1
│   └── export_openapi.py   # 已有
└── docs/
    └── PROJECT_PILOT_Desktop_Engineering_Guide.md
```

---

## 九、自动更新（Updater）

### 9.1 推荐源：GitHub Releases

- 每个正式版 tag（如 `v0.2.0`）上传：`.msi` / `setup.exe`、sidecar（若独立分发）、`latest.json`（Tauri updater 元数据）。
- **无需** 自建更新服务器即可起步。

### 9.2 版本耦合

一次更新应同时替换：

- Tauri 主程序；
- **sidecar**（API 行为变更时）；
- 内嵌前端静态资源（随 Tauri bundle）。

`latest.json` 中的版本号应与 [`backend/app/main.py`](../backend/app/main.py) FastAPI `version`、前端 `package.json` **语义一致**（至少 major/minor 对齐发版说明）。

### 9.3 更新流程（用户侧）

```text
应用启动 / 定时检查
  → 请求 update manifest（GitHub Releases）
  → 提示新版本
  → 下载安装包
  → 退出 → 安装 → 重启
  → sidecar init_db 迁移
```

### 9.4 渐进策略

| 版本 | 策略 |
|------|------|
| v0.1.x | 应用内提示 + 打开 Releases 页面（手动下载） |
| v0.2+ | 启用 Tauri Updater + 签名校验 |

---

## 十、分阶段实施路线图

按 **可交付** 顺序排列；**Phase 0 完成前不要优先做 Updater**。

### Phase 0 — 桌面 MVP（能双击跑起来）

- [ ] 初始化 `src-tauri/`，`tauri dev` 能加载 `frontend`。
- [ ] PyInstaller 打出 `project-pilot-api` sidecar；Tauri `externalBin` 声明。
- [ ] Rust：单实例、启停 sidecar、`/health` 等待、退出清理。
- [ ] `DATABASE_URL` 指向 AppData；开发环境仍可用仓库内 `.db`。
- [ ] 生产 `/api` 方案 A 或 B 落地；`npm run dev` 不受影响。
- [ ] CORS / 端口占用处理。
- [ ] 手工验证：安装目录运行、关窗无残留进程、数据写入 AppData。

### Phase 1 — 产品化基础

- [ ] `npm run tauri build` 产出可安装包。
- [ ] 日志写入 AppData（backend + tauri）。
- [ ] `schema_version` 或 Alembic 规划；发版 migration 检查清单。
- [ ] 设置页/关于页显示版本号；敏感配置继续走 DB + 设置 API。
- [ ] 文档：README 增加「桌面构建」小节；changelog 记录发版。

### Phase 2 — 分发与更新

- [ ] GitHub Releases 流水线（tag → build → 上传 artifacts）。
- [ ] Tauri Updater + 代码签名（Windows）。
- [ ] 升级 E2E：旧 db + 新版本 → migration 成功。
- [ ] 可选：崩溃上报、诊断包导出（logs + db 路径说明，不含 token）。

### Phase 3 — 扩展（与 Implementation Plan 对齐）

本地 AI、Playwright、MCP、Git Worker 等仍走 **FastAPI sidecar** 扩展路由即可，无需推翻桌面架构。

---

## 十一、发版与协作检查清单

每次桌面相关发布或 API 变更：

1. 后端/OpenAPI 变更 → 根目录 `python scripts/export_openapi.py`，提交 [`contracts/openapi.json`](../contracts/openapi.json)。
2. 检索 `frontend/` 中 `/api` 调用与 Refine `dataProvider`。
3. 确认 sidecar 与主程序 **同 tag 构建**。
4. 在 [`changelogs/`](../changelogs/README.md) 追加当日 `CHANGELOG_YYYY-MM-DD.md`。
5. 验证：全新安装、覆盖升级、卸载后 AppData 是否保留（默认 **保留用户数据**）。

---

## 十二、常见问题

**Q：能否只做一个 exe？**  
在 Tauri + Python 双运行时前提下，很难 literally 单文件。用户只应看到一个快捷方式；若强需求单文件，需评估「PyInstaller onefile + pywebview、放弃 Tauri」等 **另一条路线**，不在本指南主路径内。

**Q：有服务器后还要本地 sidecar 吗？**  
本地优先时 **要**。服务器可用于备份、协作、更新分发，不应成为日常必需。

**Q：和 Obsidian / 语雀的差异？**  
Obsidian 偏本地文件 + Electron；语雀偏云端 SaaS。本项目是 **本地 SQLite + 本地 HTTP API + Tauri WebView**，更接近 ComfyUI、LM Studio 等「localhost 服务 + 壳」模式。

**Q：开发时还要开两个终端吗？**  
`tauri dev` 阶段可配置：开发 backend 仍手动 `uvicorn`，或由 Tauri 在 debug 模式拉起 sidecar；Team 内统一一种即可。

---

## 十三、参考链接

- [Tauri 2 — Sidecar](https://v2.tauri.app/develop/sidecar/)
- [Tauri 2 — Updater](https://v2.tauri.app/plugin/updater/)
- [PyInstaller Manual](https://pyinstaller.org/en/stable/)
- 仓库：[contracts/README.md](../contracts/README.md)、[README.md](../README.md)

---

*本文档随桌面化实施迭代更新；Phase 0 完成后建议回填「已选 /api 方案、端口策略、sidecar 命名」等实际决策。*
