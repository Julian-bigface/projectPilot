# 更新日志（2026-06-01）

## 范围

- **桌面发版 v0.1.1**：版本号对齐并重新打包 NSIS 安装包，便于与旧版 0.1.0 区分；包含 5/31～6/1 前端与后端累积变更。
- **桌面打包修复 v0.1.2**：修复 `resources/dist` 与 `frontend/dist` 不同步导致安装包仍为旧前端；增加 UI/health 版本标识；修复 WebView 缓存与 sidecar 端口抢占；**桌面外链**经导航拦截在系统浏览器打开（已验证）。

---

## 代码变更

### 1) 版本号 bump 0.1.0 → 0.1.1

- **修改**：[`frontend/package.json`](../frontend/package.json)、[`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json)、[`src-tauri/Cargo.toml`](../src-tauri/Cargo.toml)、[`backend/pyproject.toml`](../backend/pyproject.toml)、[`backend/app/main.py`](../backend/app/main.py)。
- **契约**：[`contracts/openapi.json`](../contracts/openapi.json) 已导出 `info.version: 0.1.1`。

### 2) 桌面 dist 同步与 v0.1.2

- **新建**：[`scripts/sync-frontend-to-tauri-resources.ps1`](../scripts/sync-frontend-to-tauri-resources.ps1) — `npm run build` + 注入 `VITE_APP_VERSION` / `VITE_APP_BUILD_TIME`，复制 `frontend/dist` → `src-tauri/resources/dist`。
- **修改**：[`scripts/build-sidecar.ps1`](../scripts/build-sidecar.ps1)、[`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json) `beforeBuildCommand` — 统一调用同步脚本。
- **新建**：[`frontend/src/lib/app-version.ts`](../frontend/src/lib/app-version.ts)、[`frontend/src/components/common/app-version-label.tsx`](../frontend/src/components/common/app-version-label.tsx) — 设置页与账户菜单显示版本与构建时间。
- **修改**：[`backend/app/main.py`](../backend/app/main.py) — `GET /health` 返回 `version`。
- **版本**：全仓 bump **0.1.2**；契约已导出。

---

## 验证记录

- **桌面（0.1.1）**：`.\scripts\build-desktop.ps1` 产出 `Project Pilot_0.1.1_x64-setup.exe`。
- **桌面（0.1.2）**：`.\scripts\build-desktop.ps1` 产出 `Project Pilot_0.1.2_x64-setup.exe`；`resources/dist` 含 `project-libraries`；设置/账户菜单显示 `v0.1.2`；`/health` 含 `version`。

### 3) 打包脚本加固与 sidecar 版本校验

- **修改**：[`scripts/build-desktop.ps1`](../scripts/build-desktop.ps1) — 构建前结束 `project-pilot*` 进程；校验 `resources/dist` 含 `project-libraries`、无 legacy `/api/library`。
- **修改**：[`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) — `/health` 须返回与 `CARGO_PKG_VERSION` 一致的 `version`，避免端口上残留旧 sidecar 误通过 health 导致 UI 404（Not Found）。
- **修改**：[`frontend/package.json`](../frontend/package.json) — `tauri:*` 脚本 config 路径改为 `../src-tauri/tauri.conf.json`。
- **验证**：2026-06-01 19:58 完整构建；release exe 下 `/api/project-libraries/1/library/tree` → 200。

### 4) sidecar 端口抢占修复（2026-06-01 20:21）

- **现象**：`desktop.log` 显示 `sidecar healthy` 但 UI 仍 `Not Found`；日志在 `release\dist` 与 `Local\Project Pilot\dist` 间交替。
- **根因**：38472 端口被残留 `project-pilot-api.exe` 占用；新壳 health 误通过旧 sidecar，新前端请求 scoped API 得 404。已安装目录 `project-pilot.exe` 仍为 9:35 旧版，未安装 20:00 安装包。
- **修改**：[`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) — 启动前 `taskkill` 清理 sidecar；health 后再探测 `GET /api/project-libraries`。
- **验证**：2026-06-01 20:21 重建；log 应含 `clearing stale` 与 `sidecar api ok`。

### 5) dist 残留多版本 JS + WebView 缓存（2026-06-01 20:40）

- **现象**：release exe 的 `target/release/dist/assets` 混有 5/25 旧包 `index-ti9LZwoN.js` 等；WebView 可能加载旧 UI（无版本号、无项目库切换）。
- **修改**：[`scripts/sync-frontend-to-tauri-resources.ps1`](../scripts/sync-frontend-to-tauri-resources.ps1) build 前删除 `target/release/dist`；[`scripts/build-desktop.ps1`](../scripts/build-desktop.ps1) 按 `index.html` 引用校验主 JS；[`backend/app/main.py`](../backend/app/main.py) `index.html` 返回 `Cache-Control: no-store`。
- **验证**：`resources/dist/assets` 仅 1 个主 JS（如 `index-C9q5ZnRj.js`）；浏览器打开 `http://127.0.0.1:38472/` Network 应加载同名文件。
- **用户确认（2026-06-01）**：清除 WebView 缓存（`%LOCALAPPDATA%\com.projectpilot.app\EBWebView`）后 release exe UI 与开发版一致；此前 dist 已更新但窗口仍显示旧界面。

### 6) 桌面外链无反应（remote URL + opener）

- **现象**：打包后点击 GitHub 等外链无反应；`npm run dev` 正常。
- **根因**：WebView 加载 `http://127.0.0.1:38472/` 时默认无 `__TAURI__`，`openUrl` 未调用；WebView2 也不支持 `target=_blank`。
- **修改**：[`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json) `remote.urls`；[`frontend/src/lib/open-external-url.ts`](../frontend/src/lib/open-external-url.ts)；[`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) `on_navigation` 兜底。
- **验证**：需重新 `.\scripts\build-desktop.ps1` 后测 release exe 外链。
- **重打包（2026-06-01 22:53）**：已清 EBWebView 缓存 + `build-desktop.ps1`；主 JS `index-Gd5bno35.js`；安装包 `Project Pilot_0.1.2_x64-setup.exe`。
- **仍无效**：22:53 包在 sidecar origin 上 Tauri IPC 仍不可用，`openUrl` + `on_navigation` 均未触发。

### 7) 外链修复第二轮 — 导航拦截（2026-06-01 23:22）

- **根因补充**：生产 WebView 为 remote URL，`@tauri-apps/plugin-opener` 的 IPC 在 `127.0.0.1:38472` 上静默失败；需不依赖 JS plugin 的路径。
- **修改**：
  - [`frontend/src/lib/open-external-url.ts`](../frontend/src/lib/open-external-url.ts) — sidecar origin 上改为 `window.location.href = url`，由 Rust 拦截导航。
  - [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) — `on_navigation` + `on_new_window` 用 `app.opener().open_url()` 打开系统浏览器，并写 `desktop.log`（`open external: …`）。
  - [`frontend/src/lib/open-external-url.test.ts`](../frontend/src/lib/open-external-url.test.ts) — 覆盖 sidecar origin 分支。
- **验证**：`.\scripts\build-desktop.ps1` 产出主 JS `index-VEwby7kZ.js`；点击外链后 `%LOCALAPPDATA%\ProjectPilot\logs\desktop.log` 应出现 `open external: https://…`。
- **用户确认（2026-06-01）**：release exe 外链可正常打开系统浏览器。

---
