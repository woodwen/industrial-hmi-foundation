## Context

当前仓库中 Simulator 已经和 Electron HMI 解耦：

- `src/simulator/index.ts` 是 Modbus TCP Simulator 入口，脚本 `yarn simulator:start` 会先运行 `yarn simulator:build`，再执行 `out/simulator/simulator/index.js`。
- `src/simulator/opcua-index.ts` 是 OPC UA Simulator 入口，脚本 `yarn simulator:opcua:start` 会执行 `out/simulator/simulator/opcua-index.js`。
- 应用连接设备仍通过 Main Process 的 `DeviceManager`、`IProtocolAdapter`、`TagService`、`CommandService` 等边界完成。
- Renderer 目前只通过 `window.hmi` typed API 访问 Main 能力，不能直接访问 Node.js、TCP、Modbus、OPC UA 或 SQLite。
- `docs/project-manual.md` 已存在，README 已链接该文档，应用内使用说明书只提示该路径，没有在 App 内展示完整项目说明书。

这次需求不是把 Simulator 变成业务层依赖，也不是让 Renderer 直接启动协议服务，而是把“本地模拟环境准备”和“项目说明书阅读”做成应用内产品能力。

## Goals / Non-Goals

**Goals:**

- 用户可以在 App 内启动、停止和查看 Modbus TCP Simulator 状态，无需先打开终端运行 `yarn simulator:start`。
- 用户可以在 App 内启动、停止和查看 OPC UA Simulator 状态，无需先打开终端运行 `yarn simulator:opcua:start`。
- Simulator lifecycle 由 Main Process 管理，Renderer 只通过 typed API 请求固定动作。
- 独立脚本继续可用，便于维护者、自动化测试和协议独立验证。
- 应用内 Help 提供 `项目说明书` 入口，离线展示 `docs/project-manual.md` 对应内容。
- dev/build/package 能包含应用内 Simulator 启动和项目说明书展示所需资源。
- 通过测试覆盖 API 边界、状态转换、重复启动、失败展示、资源清理和文档内容同步。

**Non-Goals:**

- 不新增 Modbus RTU runtime、真实串口通信或真实 PLC vendor profile。
- 不把 Simulator 启动与设备连接强行合并；启动 Simulator 只是准备测试端点，连接仍由 DeviceManager 执行。
- 不让 Renderer 调用 `yarn`、shell、`child_process`、文件系统或底层 Simulator 模块。
- 不杀掉或接管用户在应用外独立启动的 Simulator 进程。
- 不把本地 Simulator 描述为真实生产现场设备或 Safety System。
- 不引入重量级 Markdown/文档渲染生产依赖，除非实施时现有工具确实无法满足。

## Decisions

### 1. Main Process owns Simulator lifecycle

新增 `SimulatorManager` 或等价服务，作为 Main Process runtime 的一部分。它只接受有限的 simulator kind：

- `modbusTcp`
- `opcUa`

服务需要维护明确状态，例如：

- `Stopped`
- `Starting`
- `Running`
- `Stopping`
- `Fault`

状态至少包含 simulator kind、endpoint 摘要、pid 或 managed process id、startedAt、stoppedAt、lastError 和是否由当前应用托管。Renderer 不需要也不允许获取子进程对象、启动命令或底层 server 实例。

### 2. 应用内启动复用脚本对应 runtime，但不从 Renderer 执行 yarn

应用内启动应复用当前脚本使用的 Simulator entry：

- Modbus TCP 对应 `src/simulator/index.ts` / 编译后的 `out/simulator/simulator/index.js`。
- OPC UA 对应 `src/simulator/opcua-index.ts` / 编译后的 `out/simulator/simulator/opcua-index.js`。

实现可以使用 Electron Main 可控的托管进程机制，例如 `utilityProcess`、`child_process.fork` 或项目内封装的 process adapter，但必须满足：

- 不通过 Renderer 执行命令。
- 不接受任意命令字符串。
- 不依赖 `yarn` 作为运行时启动方式。
- dev 和 packaged app 都能解析到正确 runtime。
- 子进程 stdout/stderr 或生命周期错误写入 `communication` / `error` 日志，避免高频无意义 INFO。

如果实施时发现当前 compiled simulator entry 不适合打包应用直接托管，应先抽出可复用 bootstrap 层，再让 CLI entry 和应用内托管复用同一套启动逻辑。

### 3. 独立脚本仍然是一等能力

`yarn simulator:start` 和 `yarn simulator:opcua:start` 必须继续可用，并保持“Simulator starts without Electron HMI”的既有要求。应用内 Simulator 控制只是新增入口，不替代脚本。

当 endpoint 已被外部进程占用时，应用内启动不得粗暴 kill 外部进程。默认行为：

- 如果是当前 App 托管的同类 Simulator 已在运行，重复 Start 返回当前 Running 状态。
- 如果端口/endpoint 被外部进程占用，Start 返回可读错误，UI 展示“端口已被占用或已有外部 Simulator 正在运行”。
- Stop 只停止当前 App 托管的 Simulator，不停止外部脚本启动的进程。

### 4. Simulator 启动与设备连接保持分离

Simulator 控制 UI 可以提供 endpoint 和协议提示，也可以提供“启动后连接设备”的引导，但不应绕过 DeviceManager：

```text
View
↓
Simulator ViewModel
↓
window.hmi.simulators typed API
↓
Main SimulatorManager
↓
Managed Simulator runtime
```

设备连接仍然走：

```text
View
↓
DeviceViewModel
↓
window.hmi.devices / commands typed API
↓
DeviceManager / CommandService
↓
ProtocolAdapter
```

这样可以保持业务层未来连接真实 Modbus TCP PLC 或 OPC UA Server 时不需要理解 Simulator lifecycle。

### 5. UI 入口默认放在 Settings，并可在 Device 页面显示摘要

用户已确认采用以下默认方案：

- Settings 页面已有协议配置，新增 `Simulator` 区域，按 Modbus TCP / OPC UA 两行展示状态、endpoint、Start、Stop。
- Device 页面可以显示当前协议推荐的 Simulator 状态摘要或提示，但不要把 Device 页面变成进程管理主界面。
- 启动按钮根据状态禁用，停止按钮只对 managed Running/Starting/Stopping 状态开放。
- 失败状态显示统一业务错误，不显示 Node stack trace 或低层 `EADDRINUSE` 等原始异常作为唯一文案。

### 6. Project manual 以 `docs/project-manual.md` 为来源进入 App

新增 Help 菜单项：

- 中文：`项目说明书`
- 英文：`Project Manual`

点击后在当前应用窗口打开离线 Dialog 或页面，展示 `docs/project-manual.md` 对应内容。用户已确认采用以下默认实现方向：

- `docs/project-manual.md` 作为文档源。
- 构建时或 bundler raw import 将 Markdown 内容嵌入 Renderer bundle，或由 Main 读取随包附带的文档并通过 typed API 返回。
- Renderer 使用受控 Markdown 渲染器，只支持标题、段落、列表、表格和代码块等必要结构；禁止直接注入不可信 HTML。
- 如果 Markdown 不可读取或内容为空，展示可读错误/空状态，应用不得崩溃。

为避免文档漂移，测试应验证应用内项目说明书内容包含 `docs/project-manual.md` 的关键章节，例如项目定位、协议映射、关键工程问答和真实生产 Safety System 非目标声明。

### 7. Build/package 需要包含 Simulator runtime 和项目说明书内容

实施时需要检查并调整：

- `predev` 或 dev 启动前准备逻辑，确保应用内启动可以找到 simulator runtime。
- `build` / `dist` 流程，确保 Electron build 产物包含 Simulator entry。
- Electron Builder `files` 配置或 bundling 方式，确保 packaged app 不缺少 Simulator runtime 和项目说明书内容。

优先保持 Yarn 工具链，不混用 npm/pnpm lockfile。

### 8. Verification focuses on boundaries and lifecycle

本 change 的关键风险是进程边界、资源清理和打包资源缺失。验证重点：

- `SimulatorManager` 状态转换、重复 start、stop、child exit、端口占用/启动失败、dispose 清理。
- IPC input validation 只接受固定 simulator kind，不接受任意命令。
- Preload contract 新增 `window.hmi.simulators`，仍不暴露 raw IPC。
- Renderer UI 在 `Stopped`、`Starting`、`Running`、`Stopping`、`Fault` 下显示正确状态和按钮可用性。
- Help 菜单能打开项目说明书，离线渲染内容。
- Package config/build script 包含 Simulator runtime。
- 文档将 `yarn simulator:*` 描述为维护者/独立验证路径，而不是唯一普通使用路径。

## Risks / Trade-offs

- [Risk] 打包应用中托管 Node simulator entry 的路径和执行方式与 dev 环境不一致。 -> Mitigation: 抽象 runtime resolver，增加 package config 测试和 smoke 场景；实现时优先验证 dev 与 packaged path。
- [Risk] 端口被外部脚本占用时，应用误判为自己托管并尝试停止。 -> Mitigation: 记录 managed process id，只停止自身创建的进程；端口占用返回可读错误。
- [Risk] Simulator 与 Main 同进程运行导致 UI 或 IPC 被阻塞。 -> Mitigation: 默认采用托管子进程/utility process，不把 simulator loop 直接放入 Renderer。
- [Risk] Project manual Markdown 渲染引入 XSS 或不必要依赖。 -> Mitigation: 使用受控渲染，不注入原始 HTML；优先自有轻量解析或安全白名单。
- [Risk] 文档内容双份维护后漂移。 -> Mitigation: `docs/project-manual.md` 作为来源，测试验证应用内内容与关键章节同步。

## Confirmed Defaults

用户已确认全部按默认建议执行：

- change-id 使用 `add-app-simulator-and-project-manual`。
- 应用内 Simulator 控制保留两个 yarn 脚本，不删除独立启动能力。
- UI 默认放在 Settings 的 Simulator 区域；Device 页面只做状态摘要或连接引导。
- 启动 Simulator 不自动等价于连接设备，连接仍由 DeviceManager 处理。
- Main Process 托管 Simulator lifecycle，Renderer 只通过 typed `window.hmi.simulators` API 请求固定操作。
- 外部进程或端口占用时不 kill、不接管；Stop 只停止当前 App 托管的 Simulator。
- 项目说明书入口放在 Help 菜单，展示 `docs/project-manual.md` 对应内容。
- 项目说明书正文默认使用现有中文文档源；菜单标签、标题和错误/空状态需要跟随中英文 UI。
- 不默认提升 `package.json` version。
