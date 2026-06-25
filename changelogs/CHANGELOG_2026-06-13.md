# 更新日志（2026-06-13）

## 范围

- 内容工厂 README 封面预览区右下角新增 **比例/像素** 悬浮按钮，可选输出尺寸并自动重新生成封面。

---

## 代码变更

### 1) 封面比例预设与截图参数

- **新建**：[`frontend/src/lib/readme-cover-presets.ts`](../frontend/src/lib/readme-cover-presets.ts) — 预设 3:4 / 1:1 / 9:16 / 2:3 / 16:9 及像素；选择结果写入 `localStorage`。
- **修改**：[`readme-cover-capture.ts`](../frontend/src/lib/readme-cover-capture.ts)、[`readme-cover-capture-host.tsx`](../frontend/src/components/content-factory/readme-cover-capture-host.tsx) — `outputSize` 驱动裁切高度与放大输出。
- **新建**：[`cover-size-picker.tsx`](../frontend/src/components/content-factory/cover-size-picker.tsx) — 预览区右下角 Popover 选择器。
- **修改**：[`promotion-image-panel.tsx`](../frontend/src/components/content-factory/promotion-image-panel.tsx)、[`project-promotion.tsx`](../frontend/src/pages/content-factory/project-promotion.tsx) — 接入选择与切换后 `force` 重生成。

---

## 验证记录

- **自动化**：`cd frontend && npm test -- --run readme-cover`；`npx tsc --noEmit`。
- **手工**：内容工厂 → README 首屏封面 → 点预览区右下角比例钮 → 切换预设 → 封面按新像素重新生成。
