# M-15(feat): 新增应用内模拟器控制和项目说明书

OpenSpec Change: add-app-simulator-and-project-manual

## 背景:

- 现有 Modbus TCP 与 OPC UA Simulator 只能通过 `yarn simulator:start`、`yarn simulator:opcua:start` 在终端或调试流程中启动，普通演示体验需要离开 App。
- `docs/project-manual.md` 已经覆盖项目定位、协议映射和关键工程问答，但应用内 Help 只能展示使用说明书和版本说明，不能直接离线阅读项目说明书。

## 方案概述:

- 在 Electron Main Process 增加固定 kind 的 Simulator lifecycle 托管能力，并通过 typed IPC / Preload 暴露给 Renderer。
- 在 Settings 页面提供 Modbus TCP 与 OPC UA Simulator 的启动、停止、状态和 endpoint 展示，Device 页面只显示状态摘要，不绕过 DeviceManager 连接流程。
- 将 `docs/project-manual.md` 通过 raw import 嵌入 Renderer，并用受控 Markdown 渲染器在 Help 入口离线展示。
- 归档 OpenSpec change，将新增 requirements 合并到 `product-readiness` 主 spec。

## 实现改动:

- 新增 `SimulatorManager`、`SimulatorIpcPublisher` 和 shared simulator 类型，支持 `Stopped`、`Starting`、`Running`、`Stopping`、`Fault` 状态、重复 start、异常 exit、runtime 缺失和 dispose 清理。
- 扩展 IPC validation、IPC registration、Preload contract、`window.hmi.simulators`、Renderer application service 和 browser client，保持 Renderer 不接触 Node.js、`child_process` 或 raw IPC。
- 新增 `SimulatorViewModel`，在 Settings 增加 Simulator 控制区，在 Device 页面增加当前协议相关的 Simulator 摘要。
- 新增 `ProjectManualDialog`、`MarkdownDocument` 和项目说明书内容模块，Help 菜单支持 `项目说明书` / `Project Manual`。
- 调整 `predev`、`build` 与 Electron Builder `asarUnpack`，确保 simulator runtime 在 dev/build/package 路径中可解析。
- 更新 README、应用内使用说明书、CHANGELOG、OpenSpec archive 和主 `product-readiness` spec。

## 测试计划(UT):

- `openspec validate add-app-simulator-and-project-manual --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `yarn typecheck`
- `yarn lint`
- `yarn test`
- `yarn build`

## 影响范围(建议手动测试范围):

- Settings 页面启动/停止 Modbus TCP Simulator，并从 Device 页面连接默认 `127.0.0.1:1502/unit-1`。
- Settings 页面启动/停止 OPC UA Simulator，并从 Device 页面连接默认 `opc.tcp://127.0.0.1:4840/industrial-hmi-simulator`。
- Help 菜单分别打开使用说明书、项目说明书和版本更新说明，切换中英文后检查标题、按钮、空状态和错误文案。
- 外部端口占用或 simulator runtime 缺失时，确认 UI 显示可读错误且 Stop 不接管外部进程。

## 验收标准:

- 应用内 Simulator 控制不要求用户先运行终端脚本。
- `yarn simulator:start` 和 `yarn simulator:opcua:start` 仍可作为维护者、自动化测试和独立协议验证路径保留。
- 项目说明书在应用内离线展示，正文来源保持为 `docs/project-manual.md`。
- OpenSpec change 已归档到 `openspec/changes/archive/2026-08-19-add-app-simulator-and-project-manual`。

## 风险与后续:

- 打包后的 simulator 子进程路径依赖 `out/simulator/**` 和 `app.asar.unpacked` 配置，已通过 package config 测试和 `yarn build` 验证；后续正式安装包仍建议做一次真实 packaged smoke。
- OPC UA Simulator 仍使用本地 anonymous / no-security 模拟配置，不代表生产安全配置。
