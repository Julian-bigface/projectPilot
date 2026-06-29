# 更新日志（2026-06-29）

## 范围

- **桌面应用图标**：使用 Project Pilot PP 品牌图标替换 Tauri 默认占位图标；重新打包 v0.2.0 NSIS 安装包。

---

## 代码变更

### 1) 应用图标

- **新建**：[`assets/branding/project-pilot-app-icon.png`](../assets/branding/project-pilot-app-icon.png) — 500×500 源图（保留以便日后重生成）。
- **修改**：[`src-tauri/icons/`](../src-tauri/icons/) — 由 `npx tauri icon` 生成 `icon.ico`、`icon.icns` 及各平台 PNG。

---

## 验证记录

- **自动化**：`npx --prefix frontend tauri icon assets/branding/project-pilot-app-icon.png -o src-tauri/icons`；`.\scripts\build-desktop.ps1` → `Project Pilot_0.2.0_x64-setup.exe` 产出。
- **手工**：安装或运行 `src-tauri\target\release\project-pilot.exe` → 任务栏 / 窗口标题栏 / 开始菜单应显示新 PP 图标。
