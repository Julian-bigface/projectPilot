# 更新日志（2026-06-30）

## 范围

- **桌面 sidecar 打包修复**：PyInstaller 打入 `app/prompts/` 模板，修复内容工厂「生成推荐文案」500；`console=False` 下补全 stdout/stderr，修复 uvicorn 启动崩溃。
- **README 封面截图（桌面）**：修复「页面样式或外链图片无法导出」— 封面渲染走同源图片代理 + sidecar 打入 SSL 根证书。

---

## 代码变更

### 1) Sidecar 打包与启动

- **修改**：[`backend/project-pilot-api.spec`](../backend/project-pilot-api.spec) — `datas` 包含 `app/prompts`；`console=False`（无黑框）。
- **修改**：[`backend/desktop_entry.py`](../backend/desktop_entry.py) — windowed 模式下将 stdout/stderr 重定向到 `%LOCALAPPDATA%\ProjectPilot\logs\sidecar.log`（或 NullIO fallback），避免 `isatty` 崩溃。

### 2) README 封面截图（桌面 WebView）

- **新建**：[`frontend/src/lib/readme-image-proxy.ts`](../frontend/src/lib/readme-image-proxy.ts) — 外链图同源代理 URL 封装。
- **修改**：[`frontend/src/lib/readme-cover-capture.ts`](../frontend/src/lib/readme-cover-capture.ts) — 内联失败时回退为代理 URL；避免双重代理；错误信息带上异常名。
- **修改**：[`frontend/src/components/project/detail/markdown-content.tsx`](../frontend/src/components/project/detail/markdown-content.tsx) — `imageViaProxy` 供封面离屏渲染。
- **修改**：[`frontend/src/components/content-factory/readme-cover-capture-host.tsx`](../frontend/src/components/content-factory/readme-cover-capture-host.tsx) — 启用 `imageViaProxy`。
- **修改**：[`backend/project-pilot-api.spec`](../backend/project-pilot-api.spec) — 打入 `certifi` CA 证书。
- **修改**：[`backend/desktop_entry.py`](../backend/desktop_entry.py) — frozen 运行时设置 `SSL_CERT_FILE`，修复 sidecar 无法拉取 HTTPS 外链图。

### 3) 桌面图标与安装包

- **修改**：[`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json) — NSIS `installerIcon` / `uninstallerIcon` 指向 PP 品牌 `icons/icon.ico`。
- **修改**：[`src-tauri/build.rs`](../src-tauri/build.rs) — `cargo:rerun-if-changed` 监听图标，确保 exe 嵌入新图标。
- **修改**：[`scripts/build-desktop.ps1`](../scripts/build-desktop.ps1) — 打包前 `tauri icon` 重生成图标；Tauri 失败即中止；安装包复制到 `release-artifacts/`。

---

## 验证记录

- **Sidecar（前次）**：PyInstaller archive 含 7 个 `app/prompts` 文件；`.\scripts\build-desktop.ps1` 产出 `Project Pilot_0.2.0_x64-setup.exe` → `release-artifacts/`；「生成推荐文案」不再 500。
- **封面截图（本次）**：`cd frontend && npm test -- --run readme-image-proxy readme-cover`（14 passed）；`cd backend && pytest tests/test_readme_image_proxy.py`（6 passed）。
- **图标 + 打包（本次）**：`.\scripts\build-desktop.ps1` → `release-artifacts/Project Pilot_0.2.0_x64-setup.exe`（含封面修复 + PP 图标）。
- **手工**：卸载旧版 → 删除桌面旧快捷方式 → 安装新 setup → 任务栏/桌面应显示 PP 图标（若仍旧图：取消固定任务栏后重新固定）。
