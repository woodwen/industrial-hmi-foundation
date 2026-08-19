## Why

当前项目已经提供两个独立 Simulator 启动脚本：

- `yarn simulator:start` 启动 Modbus TCP PLC Simulator。
- `yarn simulator:opcua:start` 启动 OPC UA Simulator。

但从应用用户视角看，Simulator 仍然需要离开应用到终端或调试流程中手工启动。应用内 Help 也只提示运行脚本，导致面试演示和普通体验被切成“先开调试/终端，再回到 App 连接设备”。同时，`docs/project-manual.md` 已经是详细项目说明书，但目前只能在项目文件或 README 链接中查看，应用内 Help 只能提示它的路径，没有真正把项目说明书作为应用内离线资料展示。

本 change 目标是把本地模拟演示闭环放进应用：用户可以在 App 中启动/停止 Modbus TCP 和 OPC UA Simulator，并在 Help 中直接阅读项目说明书。独立脚本仍保留，用于维护者、自动化测试和独立协议验证。

## What Changes

- 新增应用内 Simulator 生命周期能力，覆盖 Modbus TCP Simulator 和 OPC UA Simulator 的启动、停止、状态展示和错误展示。
- 新增 Main Process `SimulatorManager` 或等价服务，负责托管 Simulator 子进程/运行时，Renderer 只通过 typed `window.hmi` API 请求操作。
- 新增 typed IPC / Preload / Renderer API，避免向 Renderer 暴露 Node.js、`child_process`、raw IPC、任意 shell 命令或底层 Simulator 对象。
- 在 Settings 页面提供 Simulator 控制入口，展示协议、endpoint、状态、启动/停止按钮和失败原因；Device 页面最多补充状态摘要或连接引导，不承载进程管理主入口。
- 保留 `yarn simulator:start` 与 `yarn simulator:opcua:start` 的独立启动能力；应用内启动不是删除脚本，也不让业务代码依赖 Simulator。
- 调整 dev/build/package 流程，确保应用内启动能找到与脚本一致的 Simulator runtime，打包应用也能包含必要的 Simulator entry。
- 新增 Help 菜单中的 `项目说明书` 入口，在当前应用窗口离线展示 `docs/project-manual.md` 对应内容，而不是只提示项目路径。
- 更新 README、应用内使用说明书、CHANGELOG 和相关测试，说明 Simulator 可从应用内启动，脚本作为维护者/独立验证路径保留。
- 增加必要验证，覆盖 Simulator lifecycle、IPC 边界、Preload contract、Renderer UI 状态、项目说明书渲染和打包配置。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `product-readiness`: 扩展应用内 Simulator 控制、项目说明书离线展示、帮助文档、README、打包配置和相关验证要求。

## Impact

- 影响 Main Process：新增或扩展本地 Simulator lifecycle 管理服务，并在应用退出时清理托管进程/运行时。
- 影响 Preload / Shared API：新增 typed simulator API 和 IPC channel，保持 `contextIsolation`、最小 API 和 raw IPC 隔离。
- 影响 Renderer：新增 Simulator 状态 ViewModel/UI，以及 Help 菜单的项目说明书入口和展示组件。
- 影响 build/package：确保 Simulator runtime 与 `docs/project-manual.md` 的应用内展示内容可被 dev/build/package 流程使用。
- 影响文档：更新 README、应用内使用说明书、CHANGELOG，说明应用内 Simulator 控制和项目说明书入口。
- 影响测试：新增或扩展 Main lifecycle、IPC validation、Preload contract、Renderer render、documentation content 和 package config 测试。
- 不改变真实工业通信边界：Simulator 仍然只是本地模拟设备，不暗示真实生产现场部署。
- 不新增 Modbus RTU runtime，不把 OPC UA anonymous / no-security Simulator 描述成生产安全配置。
- 不主动 commit、push 或 archive。

## Confirmed Defaults

用户已确认全部按默认建议执行：

- Simulator 控制主入口放在 Settings 页面新增 `Simulator` 区域。
- Device 页面只显示当前协议相关的 Simulator 状态摘要或连接引导，不把启动 Simulator 等同于连接设备。
- Simulator lifecycle 由 Main Process 托管，Renderer 只通过 typed `window.hmi.simulators` API 请求固定操作。
- 不从 Renderer 执行 `yarn`、shell、`child_process`、文件系统或任意命令字符串。
- `yarn simulator:start` 和 `yarn simulator:opcua:start` 继续保留，作为维护者、自动化测试和独立协议验证路径。
- 外部进程或端口占用时不 kill、不接管；Stop 只停止当前 App 托管的 Simulator。
- Help 菜单新增 `项目说明书` / `Project Manual` 入口，正文复用 `docs/project-manual.md` 作为来源。
- 项目说明书正文默认使用现有中文文档；菜单标签、标题、关闭按钮、空状态和错误提示跟随中英文 UI。
- 不默认提升 `package.json` version，只更新当前 `CHANGELOG.md` 的 `Unreleased / 0.1.1`。
