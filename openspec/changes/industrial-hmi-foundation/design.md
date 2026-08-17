## Context

本项目是用于工业自动化上位机/HMI 学习与面试展示的 Electron 桌面项目。当前目标不是实现真实工业业务，而是建立后续 Modbus TCP、OPC UA、SQLite、实时采集、报警、趋势、配方等能力可以稳定落地的基础工程架构。

设计默认源码根目录为 `src/`，其中：

- `main/` 表示 `src/main/`，承载 Electron Main 进程、工业通信适配、持久化、日志和 IPC handler。
- `preload/` 表示 `src/preload/`，承载 `contextBridge` 暴露给 Renderer 的最小 API。
- `renderer/` 表示 `src/renderer/`，承载 React UI、MobX ViewModel、页面和组件。

核心约束是 Renderer 必须是受限 UI 层：不能直接拥有 Node.js、TCP、Modbus、OPC UA 或 SQLite 能力。工业通信和本地资源访问必须在 Main 进程或 Infrastructure 层执行，并通过受控 IPC 用例暴露给 Renderer。

已确认默认技术选择：

- 构建工具：`electron-vite`
- 包管理器：`npm`
- 页面切换：`AppViewModel.activePage` 内部导航，本期不引入 React Router
- 样式方案：普通 CSS 或 CSS Modules，本期不引入 Tailwind 或组件库
- ViewModel 注入：Root/App ViewModel 通过 React Context 提供给页面
- Preload API：单一 `window.hmi` 命名空间，首期包含 `app.getInfo()`、`log.write()`、`errors.report()` 等基础能力
- 日志落地：首期 logger interface + console sink，Main 侧预留 file sink 扩展点
- 错误模型：`{ code, message, detail?, source?, cause? }`
- 测试框架：Vitest

## Goals / Non-Goals

**Goals:**

- 建立 Electron Main / Preload / Renderer 三段式基础架构。
- Renderer 使用 React、TypeScript、MobX 和 MVVM 组织 UI 状态与行为。
- 固定分层方向：View -> ViewModel -> Application Service / Domain Service -> Infrastructure。
- 启用 `contextIsolation`，关闭 `nodeIntegration`。
- 通过 Preload 暴露最小化、类型安全、面向用例的 API。
- 提供 Dashboard、Device、Alarm、Trend、Recipe、Tag Management、Settings 页面骨架和导航。
- 提供 `AppViewModel`、`DashboardViewModel`、`DeviceViewModel` 基础 ViewModel。
- 预留工业领域模块目录，但仅放置边界、占位说明或空模块出口，不提前实现真实业务。
- 建立 application log、communication log、error log 的统一日志基础设施。
- 建立统一错误模型、错误转换和顶层错误处理机制。
- 建立 lint、test、build 可运行的基础验证结构。
- 固定本期默认工具链和 UI 组织方式，减少实现阶段再选型。

**Non-Goals:**

- 不实现 Modbus、OPC UA、PLC Simulator、Tag Polling、Alarm、Historian、Recipe 业务逻辑。
- 不引入真实 SQLite 数据模型或迁移。
- 不实现真实设备连接、采集调度、报警计算、趋势查询或配方下发。
- 不在 Renderer 中实现任何工业协议、TCP 通信、本地文件或数据库访问。

## Decisions

### 1. Electron 进程架构

采用 Main / Preload / Renderer 分工：

- Main 进程负责桌面生命周期、窗口创建、IPC handler 注册、日志、错误处理、后续工业通信和持久化基础设施。
- Preload 负责通过 `contextBridge.exposeInMainWorld` 暴露一个稳定的 `window.hmi` API 面，不透出 `ipcRenderer`、`process`、`fs`、`net`、`path` 等 Node.js 能力。
- Renderer 只负责 UI 呈现、用户交互、页面导航和 ViewModel 状态管理。

窗口创建必须配置：

- `contextIsolation: true`
- `nodeIntegration: false`
- 禁止依赖 Renderer 的 Node.js polyfill 完成核心能力

备选方案：允许 Renderer 直接使用 Node.js API 或 Electron remote。该方案开发更快，但会把 UI、工业通信、本地资源和安全边界混在一起，后续无法可靠控制通信生命周期、错误隔离和权限面，因此不采用。

工程工具链采用 `electron-vite`，通过 npm scripts 暴露 `dev`、`typecheck`、`lint`、`test`、`build` 等命令。备选方案是手工组合 Vite、Electron、tsc 和打包脚本；该方案可控性更高，但本项目首期更需要清晰三入口和低配置成本，因此不采用。

### 2. MVVM 分层

Renderer 内部采用 MVVM：

- View：React 组件，只订阅 ViewModel 状态并转发用户意图。
- ViewModel：MobX observable/action/computed 的承载者，组织页面状态、加载状态、错误状态和命令。
- Application Service / Domain Service：承载用例编排和领域规则，位于 Renderer 可调用的抽象边界或 Main 进程服务边界之后。
- Infrastructure：承载协议、数据库、文件、日志 sink、系统资源访问等外部世界细节。

View 不直接调用 Infrastructure，也不直接发起 TCP、Modbus、SQLite 或 Node.js 操作。ViewModel 可以调用 Renderer 侧 API client，该 API client 只调用 Preload 暴露的类型安全 API。

备选方案：React 组件直接持有业务状态和 IPC 调用。该方案短期代码少，但页面逻辑、业务编排、错误处理和通信边界会快速混杂，不利于面试展示架构能力，也不利于后续测试。

ViewModel 注入采用 Root/App ViewModel + React Context。应用启动时创建 ViewModel 根对象，页面通过 Context 获取对应 ViewModel。备选方案是在组件中直接 import 单例；该方案更短，但隐藏依赖来源，不利于测试和后续多窗口或多工作区扩展。

页面切换采用 `AppViewModel.activePage` 内部状态，不在本期引入 React Router。备选方案是 React Router；它适合 URL 深链、刷新恢复和复杂路由栈，但本期是 Electron 桌面壳和基础导航，使用 ViewModel 状态更直接。

### 3. IPC 设计原则

IPC 使用面向用例的接口，而不是暴露底层通道：

- Preload 暴露 `window.hmi` 这类单一命名空间，内部按领域拆分子 API。
- Renderer 只能调用明确命名的方法，例如获取应用信息、写入日志、读取健康状态等基础用例。
- IPC request 和 response 必须有 TypeScript 类型，错误返回必须走统一错误模型。
- Main 进程集中注册 IPC handler，handler 负责输入校验、调用 application service、捕获错误并写日志。
- 不向 Renderer 暴露 `ipcRenderer.send`、`ipcRenderer.invoke` 或任意 channel 调用能力。
- IPC channel 名称集中定义在 `main/ipc/` 或共享类型模块中，避免字符串散落。

本期 IPC 只需要支撑基础应用能力和验证边界，不承诺任何工业协议 API。后续新增设备、Tag、报警、历史数据、配方等用例时，应先定义用例级 API，再由 Main 进程连接对应服务。

首期 `window.hmi` API 默认包含：

- `app.getInfo()`：读取应用名称、版本、运行环境等基础信息。
- `log.write(entry)`：Renderer 通过受控路径写入应用级日志摘要。
- `errors.report(error)`：Renderer 上报 Error Boundary 或 ViewModel 捕获的错误摘要。

这些 API 只表达用例，不暴露 raw IPC channel。后续每个工业能力必须新增明确的 typed API，不允许把 `ipcRenderer.invoke(channel, payload)` 透传给 Renderer。

### 4. 后续工业协议扩展方式

后续工业协议能力应以插件式适配器模式扩展：

- `main/protocol/` 定义协议适配器接口、连接状态、读写命令、错误映射和生命周期约定。
- `main/device/` 管理设备配置、连接实例、设备状态和协议适配器绑定。
- `main/tag/` 管理 Tag 定义、地址映射和数据质量模型。
- `main/command/` 管理读写命令、队列、超时、取消和重试策略。
- `main/alarm/`、`main/historian/`、`main/recipe/` 在对应 change 中按需求补充，不在本期提前实现。
- `main/ipc/` 只暴露应用用例，不直接暴露协议库对象。

新增 Modbus TCP 或 OPC UA 时，协议实现应在 Infrastructure 侧完成，并通过统一协议适配器接口接入 Application Service。Renderer 只看到设备状态、Tag 数据、报警摘要、趋势查询结果等用例结果，不关心底层协议连接和包格式。

### 5. 为什么工业通信不能直接放 Renderer

工业通信不应放在 Renderer，原因包括：

- 安全：Renderer 处理 HTML、CSS、用户交互和第三方前端依赖，攻击面更大，不应直接拥有 TCP、文件系统、数据库或协议栈能力。
- 稳定性：工业通信通常涉及长连接、重试、超时、心跳、断线重连和背压控制，放在 UI 线程会放大卡顿和崩溃影响。
- 生命周期：设备连接应跟随应用和主进程生命周期管理，而不是跟随某个页面组件挂载/卸载。
- 可测试性：通信、协议解析、采集调度和错误映射应能在无 UI 环境中测试。
- 可维护性：Renderer 只表达用户意图和展示状态，通信细节集中在 Main/Infrastructure 后，后续替换协议库或持久化方案不会牵动 UI。
- 权限最小化：Preload 可以暴露有限用例 API，让 Renderer 无法绕过校验直接访问底层资源。

### 6. 日志与错误处理

日志基础设施按用途分流：

- application log：应用生命周期、页面级操作、配置加载、服务启动停止。
- communication log：后续设备连接、请求响应、协议错误、超时和重连摘要。本期只建立类别和接口，不记录真实协议报文。
- error log：未处理异常、IPC handler 错误、Renderer error boundary 捕获的错误。

本期默认提供 logger interface 和 console sink；Main 侧预留 file sink 扩展点，但不强制首期文件落盘。后续确认 Electron 打包形态和数据目录策略后，再把日志写入 `app.getPath("userData")/logs` 或等价路径。

错误处理采用统一错误模型：

- 定义应用错误码、用户可读消息、技术详情、来源上下文和原始原因引用，即 `{ code, message, detail?, source?, cause? }`。
- Main 进程捕获 IPC handler 错误并转为统一错误响应。
- Renderer ViewModel 保存页面级错误状态，View 只负责展示。
- Renderer 顶层建立 Error Boundary，并可通过 Preload API 上报错误摘要到 Main。

### 7. 测试结构

测试按风险分层：

- TypeScript 编译验证进程边界和 API 类型。
- lint 验证基础代码规范和导入边界。
- Vitest 单元测试覆盖 ViewModel 初始状态、导航状态和 action 行为。
- IPC 类型/契约测试覆盖 Preload 暴露 API 的 shape。
- 架构边界测试检查 Renderer 不导入 Node.js、Electron Main API、TCP/数据库/协议实现模块。
- 构建测试验证 Electron 应用可以启动或至少完成可执行构建。

样式方案采用普通 CSS 或 CSS Modules。本期不引入 Tailwind 或组件库，避免基础架构 change 同时承担设计系统选型。

## Risks / Trade-offs

- [Risk] 初期只建立边界和占位目录，业务功能不可演示真实工业流程 -> Mitigation：页面明确保留骨架状态，tasks 中把非目标列为验收检查，后续以独立 change 增量实现协议和业务能力。
- [Risk] IPC 过度抽象会让早期开发显得繁琐 -> Mitigation：本期只暴露最小 API，后续每个工业能力按用例扩展，不提前设计完整平台 API。
- [Risk] MobX ViewModel 与 React 组件边界不清会退化为组件内业务逻辑 -> Mitigation：测试和代码结构要求 View 只消费 ViewModel，页面状态集中在 ViewModel。
- [Risk] 日志基础设施过早绑定具体日志库会限制桌面打包和文件路径策略 -> Mitigation：先定义 logger 接口、日志类别和默认 console sink，Main 侧只预留 file sink 扩展点，真实持久化策略后续再收敛。
- [Risk] 不引入 React Router 会让页面深链和刷新恢复暂时不可用 -> Mitigation：本期页面切换只服务桌面壳验证，后续页面需要深链时再单独引入路由。
- [Risk] 不引入 Tailwind 或组件库会增加少量基础样式工作 -> Mitigation：本期 UI 范围很小，普通 CSS/CSS Modules 足够支撑工业控制台骨架。

## Migration Plan

这是基础架构 change，不涉及生产数据迁移。实施时应先创建构建工具和进程入口，再补 Renderer MVVM 和页面导航，最后补日志、错误处理、测试和验证脚本。若实施中发现工具链不适合，可回退到已生成的 OpenSpec 方案，调整 design/tasks 后再继续。

## Open Questions

无。默认技术选择已按本次确认写入方案；如实施阶段发现工具链或打包策略不适配，再通过更新 change 调整。
