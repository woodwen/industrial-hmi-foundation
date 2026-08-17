## Why

当前项目面向工业自动化上位机/HMI 学习与面试展示，需要先建立清晰、可扩展、可验证的 Electron 桌面基础架构。该基础架构必须在引入 Modbus TCP、OPC UA、SQLite、实时采集、报警、趋势、配方等能力之前，先固定进程边界、分层职责和 Renderer 安全约束，避免后续业务能力直接耦合到 UI 或 Node.js 能力泄露到 Renderer。

## What Changes

- 建立 Electron Main / Preload / Renderer 基础架构，并要求 `contextIsolation` 开启、`nodeIntegration` 关闭。
- 采用 `electron-vite` 和 `npm` scripts 作为默认工程工具链。
- Renderer 使用 React、TypeScript、MobX 和 MVVM，页面通过 ViewModel 暴露状态与行为。
- Renderer 页面切换默认由 `AppViewModel.activePage` 管理，本期不引入 React Router。
- Renderer 样式默认使用普通 CSS 或 CSS Modules，本期不引入 Tailwind 或组件库。
- 明确架构边界：View -> ViewModel -> Application Service / Domain Service -> Infrastructure。
- 约束 Renderer 不直接访问 TCP、Modbus、SQLite 或 Node.js API。
- Preload 向 Renderer 暴露最小化、类型安全、面向用例的 `window.hmi` API。
- 建立 Dashboard、Device、Alarm、Trend、Recipe、Tag Management、Settings 基础页面和导航。
- 建立 `AppViewModel`、`DashboardViewModel`、`DeviceViewModel` 基础 ViewModel。
- 预留工业领域模块目录：`main/device/`、`main/protocol/`、`main/tag/`、`main/alarm/`、`main/historian/`、`main/command/`、`main/ipc/`，以及 `renderer/pages/`、`renderer/components/`、`renderer/viewmodels/`。
- 建立统一日志基础设施，覆盖 application log、communication log、error log；本期默认先提供接口和 console sink，文件落盘后续扩展。
- 建立统一错误处理机制，默认错误 shape 包含 `code`、`message`、`detail`、`source`、`cause`。
- 建立基于 Vitest 的基础测试结构，支持后续单元测试、集成测试和架构边界测试。
- 本期仅提供基础工程框架和导航，不实现真实工业业务。

## Capabilities

### New Capabilities
- `industrial-hmi-foundation`: 定义工业 HMI Electron 桌面应用的基础架构、MVVM 分层、安全 IPC、页面导航、日志、错误处理和测试结构。

### Modified Capabilities
- 无。

## Impact

- 影响 Electron 主进程、Preload、Renderer 工程入口与目录结构。
- 影响 Renderer 状态管理、页面导航、ViewModel 基础模式和类型声明。
- 影响 IPC 暴露方式、主进程服务边界、日志和错误处理基础设施。
- 影响项目脚本、测试框架、样式组织和基础依赖选择。
- 为后续 Modbus TCP、OPC UA、SQLite、Tag Polling、Alarm、Historian、Recipe 等能力提供扩展基础，但本 change 不实现这些业务能力。
