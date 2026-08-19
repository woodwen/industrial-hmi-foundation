## 1. Scope and Existing Context

- [x] 1.1 阅读本 change 的 `proposal.md`、`design.md`、全部 `specs/**/spec.md`，确认范围只包含应用内 Simulator 控制、项目说明书入口、文档和验证。
- [x] 1.2 复查 `package.json` 的 simulator/build/dist scripts、`tsconfig.simulator.json`、Electron Builder `files` 配置和 simulator 输出路径。
- [x] 1.3 复查 `src/simulator/index.ts`、`src/simulator/opcua-index.ts` 及其可复用 bootstrap 能力，确认 CLI entry 和 App-managed runtime 如何共享逻辑。
- [x] 1.4 复查现有 Main runtime、IPC registration、Preload API、Renderer ViewModel/UI、Help 菜单和相关测试。
- [x] 1.5 确认本期不新增真实 PLC、Modbus RTU runtime、生产 OPC UA security profile 或业务层对 Simulator 的特殊依赖。
- [x] 1.6 按用户已确认的默认方案实施：Settings 作为 Simulator 主入口、Device 只做状态摘要或连接引导、脚本保留、外部进程不接管、Help 展示 `docs/project-manual.md`、不默认升版本。

## 2. Main Simulator Lifecycle

- [x] 2.1 新增 `SimulatorManager` 或等价 Main Process 服务，支持 `modbusTcp` 和 `opcUa` 两种 simulator kind。
- [x] 2.2 定义 shared simulator 类型：kind、状态、endpoint、managed 标记、pid/进程标识、时间戳和统一错误 shape。
- [x] 2.3 实现 Modbus TCP Simulator 启动、停止、状态查询、重复 start 处理、异常 exit 处理和 dispose 清理。
- [x] 2.4 实现 OPC UA Simulator 启动、停止、状态查询、重复 start 处理、异常 exit 处理和 dispose 清理。
- [x] 2.5 确保 Stop 只清理当前应用托管的 Simulator，不 kill 外部脚本启动的进程。
- [x] 2.6 将 Simulator lifecycle 日志写入 application/communication/error 合适分类，并避免向 Renderer 暴露 raw Node errors 或 stack trace。
- [x] 2.7 在 Main runtime 创建和 dispose 流程中接入 SimulatorManager。

## 3. Typed IPC and Preload API

- [x] 3.1 在 `src/shared/ipc-channels.ts` 增加 simulator IPC channel。
- [x] 3.2 在 `src/shared/hmi-api.ts` 增加 `window.hmi.simulators` typed API 类型。
- [x] 3.3 增加 IPC input validation，只接受固定 simulator kind 和明确操作，不接受任意命令字符串。
- [x] 3.4 在 Main IPC registration 中接入 start、stop、get status 和 subscribe/status changed 能力。
- [x] 3.5 在 Preload 中暴露最小 simulator API，并确保返回 unsubscribe 函数。
- [x] 3.6 更新 Preload contract 和 IPC validation 测试，确认 Renderer 仍不能访问 raw IPC、Node.js 或底层 Simulator 对象。

## 4. Renderer Simulator UI

- [x] 4.1 新增或扩展 Simulator ViewModel，管理 status loading、start/stop busy、错误展示和订阅释放。
- [x] 4.2 在 Settings 页面新增 Simulator 控制区域，展示 Modbus TCP 和 OPC UA 的状态、endpoint、Start/Stop 按钮和错误摘要。
- [x] 4.3 在 Device 页面最多补充当前协议 Simulator 状态摘要或启动提示，不把 Device 页面作为进程管理主入口，也不绕过 DeviceManager 的 connect 流程。
- [x] 4.4 更新中英文 localization 文案，覆盖 `Simulator`、`Start`、`Stop`、状态、端口占用/启动失败/停止失败等用户可见文本。
- [x] 4.5 增加 Renderer/ViewModel 测试，覆盖 Stopped、Starting、Running、Stopping、Fault、重复点击和错误状态。

## 5. In-App Project Manual

- [x] 5.1 新增 Help 菜单项 `项目说明书` / `Project Manual`。
- [x] 5.2 将 `docs/project-manual.md` 作为应用内项目说明书内容来源，选择 raw import、build-time generated module 或 Main typed API 读取方案。
- [x] 5.3 实现项目说明书 Dialog 或页面，在当前应用窗口离线展示 Markdown 内容。
- [x] 5.4 实现受控 Markdown 渲染或结构化转换，支持标题、段落、列表、表格和代码块，不直接注入不可信 HTML。
- [x] 5.5 增加空内容或解析失败时的可读空状态/错误状态，确保应用不崩溃。
- [x] 5.6 增加 Help 渲染测试和文档内容测试，验证项目说明书入口、关键章节和 Safety System 非目标声明。

## 6. Build, Packaging, and Documentation

- [x] 6.1 调整 dev/build/package 流程，确保应用内 Simulator 启动可以找到 simulator runtime。
- [x] 6.2 更新 package/build 配置测试，验证 packaged app 包含 simulator entry 和项目说明书内容来源。
- [x] 6.3 更新 README，将应用内启动 Simulator 作为普通演示路径，`yarn simulator:*` 作为维护者/独立验证路径保留。
- [x] 6.4 更新应用内使用说明书，说明 Simulator 可以从应用内启动/停止，脚本不再是唯一普通路径。
- [x] 6.5 更新 `CHANGELOG.md` 当前 `Unreleased / 0.1.1`，记录应用内 Simulator 控制和项目说明书入口。
- [x] 6.6 确认文档继续说明当前项目是本地 Simulator/学习/工程实践项目，不暗示真实生产现场部署。

## 7. Verification

- [x] 7.1 运行 `openspec validate add-app-simulator-and-project-manual --strict`。
- [x] 7.2 运行 `openspec validate --all --strict`。
- [x] 7.3 运行 `git diff --check`。
- [x] 7.4 运行 `yarn typecheck`。
- [x] 7.5 运行 `yarn lint`。
- [x] 7.6 运行 `yarn test`。
- [x] 7.7 运行 `yarn build`。
- [x] 7.8 如实施涉及 packaged 行为，运行可行的 smoke 验证，确认应用内 Simulator 控制和项目说明书在打包资源中可用。
- [x] 7.9 汇报所有 validation/test/build 结果，不自动 commit、push 或 archive。
