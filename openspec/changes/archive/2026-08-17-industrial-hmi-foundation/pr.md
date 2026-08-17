# M-2(feat): 完成工业 HMI 基础架构

OpenSpec Change: industrial-hmi-foundation

背景:
- 项目需要建立用于工业自动化上位机/HMI 学习与面试展示的 Electron 桌面基础架构。
- 在引入 Modbus TCP、OPC UA、SQLite、实时采集、报警、趋势和配方之前，需要先固定 Main/Preload/Renderer 边界、MVVM 分层、IPC 安全面和验证结构。

方案概述:
- 使用 Electron + React + TypeScript + MobX + MVVM 建立桌面应用基础骨架。
- Renderer 只负责 UI、导航和 ViewModel 状态，不直接访问 Node.js、TCP、工业协议或 SQLite。
- Preload 通过最小 `window.hmi` API 暴露基础用例，Main 统一处理 IPC、日志、错误转换和后续工业能力扩展点。
- 完成 OpenSpec archive，将 `industrial-hmi-foundation` 能力同步为主规格。

实现改动:
- 建立 `src/main`、`src/preload`、`src/renderer` 和 `src/shared` 目录，以及 Electron Vite 构建配置。
- 实现 `AppViewModel`、`DashboardViewModel`、`DeviceViewModel`、React Context 注入和基础页面导航。
- 提供 Dashboard、Device、Alarm、Trend、Recipe、Tag Management、Settings 页面骨架。
- 增加 `window.hmi.app.getInfo()`、`window.hmi.log.write()`、`window.hmi.errors.report()` 类型安全 API。
- 增加 IPC payload 校验、统一错误 shape、ErrorBoundary 上报、application/communication/error 日志基础设施。
- 预留 `main/device`、`main/protocol`、`main/tag`、`main/alarm`、`main/historian`、`main/command`、`main/ipc` 工业模块目录。
- 增加 ViewModel、Preload contract、Renderer 边界、BrowserWindow 安全配置和 IPC 输入校验测试。
- 归档 OpenSpec change，并同步 `openspec/specs/industrial-hmi-foundation/spec.md`。

测试计划(UT):
- `openspec validate industrial-hmi-foundation --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run smoke:start`

影响范围(建议手动测试范围):
- 建议使用 `npm run dev` 打开桌面应用，手动检查 Dashboard、Device、Alarm、Trend、Recipe、Tag Management、Settings 导航切换。
- 确认 Renderer DevTools 中没有 Node.js 能力暴露，后续工业通信仍只能通过 Main/Preload 边界扩展。

风险与后续:
- 本期不实现真实 Modbus、OPC UA、PLC Simulator、Tag Polling、Alarm、Historian 或 Recipe。
- 后续建议以独立 OpenSpec change 增量实现 `add-modbus-tcp`、`add-opc-ua`、`add-sqlite-storage`、`add-tag-polling` 等能力。
