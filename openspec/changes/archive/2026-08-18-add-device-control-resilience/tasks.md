## 1. Scope and Existing Context

- [x] 1.1 阅读本 change 的 `proposal.md`、`design.md`、`specs/device-control-resilience/spec.md`、`specs/modbus-plc-simulator/spec.md`、`specs/tag-polling-monitoring/spec.md`，确认本期只实现设备控制和通信可靠性。
- [x] 1.2 复查现有 `DeviceManager`、`IProtocolAdapter`、`ModbusAdapter`、`TagService`、`TagCache`、`PollingScheduler`、IPC、Preload 和 Renderer MVVM 边界。
- [x] 1.3 确认本期不实现 Alarm、Historian、Trend、Recipe、Permission、Audit、OPC UA 或真实工业 Safety PLC 能力。
- [x] 1.4 梳理现有手工 Device 写入路径，标记需要迁移到 CommandService 的入口。

## 2. Device State Machine

- [x] 2.1 定义共享或 Main 层 `DeviceConnectionState`，包含 `Disconnected`、`Connecting`、`Connected`、`Reconnecting`、`Fault`。
- [x] 2.2 实现纯状态转换函数，覆盖所有合法转换和非法转换拒绝。
- [x] 2.3 为状态转换记录 `deviceId`、state、lastTransitionAt、reason、user-facing error summary。
- [x] 2.4 调整 DeviceManager 以状态机为唯一连接状态来源，避免多个 boolean 表示复杂生命周期。
- [x] 2.5 Device connect 成功后进入 `Connected` 并启动该 device polling。
- [x] 2.6 初始 connect 失败或不可恢复配置错误进入 `Fault` 并返回统一错误，不启动自动 reconnect loop。
- [x] 2.7 手工 disconnect 从任意可停止状态进入 `Disconnected`，并清理 adapter、polling、reconnect、command pending 资源。
- [x] 2.8 为状态机添加 communication/application/error 日志。

## 3. Automatic Reconnect

- [x] 3.1 实现 DeviceManager reconnect loop，确保 reconnect 由 DeviceManager 编排而不是具体 ModbusAdapter 隐式执行。
- [x] 3.2 实现 backoff 序列 `1000ms`、`2000ms`、`4000ms`、`8000ms`、最大 `10000ms`，默认不设置最大尝试次数。
- [x] 3.3 保证同一 device 同一时间最多一个 reconnect loop。
- [x] 3.4 连接丢失时从 `Connected` 转入 `Reconnecting`，停止或暂停该 device polling。
- [x] 3.5 每次 reconnect attempt 使用 connect timeout，并正确释放失败尝试产生的 socket/adapter 资源。
- [x] 3.6 reconnect 成功后进入 `Connected`，重新启动 PollingScheduler。
- [x] 3.7 手工 disconnect、runtime dispose 或不可恢复错误时取消 reconnect loop。
- [x] 3.8 对重复 reconnect failure 日志做限频，避免 Simulator 长时间断线时刷屏。

## 4. Tag Quality Lifecycle

- [x] 4.1 增加按 device 批量标记 Tags 为 `Bad` / `Uncertain` 的 TagCache 或 TagService API。
- [x] 4.2 连接丢失、通信失败或进入 `Reconnecting` 时，将该 device 相关 Tags 标记为 `Bad`。
- [x] 4.3 手工 disconnect 时，将该 device 相关 Tags 标记为 `Uncertain`。
- [x] 4.4 保留 last value 时必须同步更新 `quality` 和 timestamp/quality-change time。
- [x] 4.5 实现 stale timeout 规则，超过 `max(3 * scanRate, 3000ms)` 未成功采集的 Tag 标记为 `Bad`。
- [x] 4.6 reconnect 成功但首次采集前保持相关 Tags 为 `Bad`。
- [x] 4.7 reconnect 后首次成功采集和 decode 时将对应 Tags 恢复为 `Good`。
- [x] 4.8 确保 Dashboard 和 Device Tag Monitor 能收到 Quality 降级和恢复更新。

## 5. CommandService Core

- [x] 5.1 在 `src/main/command/` 定义 Command 类型、CommandResult、CommandStatus、CommandErrorCode 和 verification strategy 类型。
- [x] 5.2 实现 CommandDefinition 列表，覆盖 Start、Stop、Motor Start/Stop、Inlet Valve、Outlet Valve、Target Temperature、RPM Setpoint。
- [x] 5.3 实现 CommandService，依赖 DeviceManager、IProtocolAdapter、DeviceOperationGate 和 Logger；Tag Quality 由 DeviceManager lifecycle 与 PollingScheduler/TagCache 协作维护。
- [x] 5.4 CommandService 在写入前校验 device state，`Disconnected`、`Reconnecting`、`Fault` 时拒绝命令。
- [x] 5.5 CommandService 在写入前校验 target Tag 是否 writable。
- [x] 5.6 CommandService 在写入前校验 value type 和 command definition。
- [x] 5.7 Target Temperature 执行 `20.0°C` 到 `90.0°C` 范围校验。
- [x] 5.8 RPM Setpoint 执行 `0` 到 `1800 rpm` 范围校验。
- [x] 5.9 将现有 Device 手工写入路径迁移到 CommandService，禁止 Renderer/ViewModel 直接触发协议写入。
- [x] 5.10 将底层协议错误转换为统一业务错误，不向 Renderer 暴露裸 socket 或 Modbus 异常。

## 6. Write Verification and Command Timeout

- [x] 6.1 实现 write response 记录，明确它只表示 Modbus write request 被接受。
- [x] 6.2 为 Target Temperature 实现 holding-register read-back verification，默认容差 `0.1°C`。
- [x] 6.3 为 RPM Setpoint 实现 holding-register read-back verification，默认按整数精确匹配。
- [x] 6.4 为 Start/Stop 实现 device running feedback read-back verification。
- [x] 6.5 为 Motor Start/Stop 实现 motor running feedback read-back verification。
- [x] 6.6 为 Inlet Valve 和 Outlet Valve 实现对应 valve feedback read-back verification。
- [x] 6.7 实现 command timeout，默认 `3000ms`，需要等待反馈的 Start/Stop/Motor/Valve 命令默认 `5000ms`。
- [x] 6.8 timeout 后返回结构化 timeout result，并清理 pending timer/listener/verification state。
- [x] 6.9 迟到 read-back 或反馈不得污染下一条命令结果。
- [x] 6.10 CommandResult 包含 command id、target Tag id、write accepted、verification status、duration 和 user-facing error summary。
- [x] 6.11 保留未来 PLC acknowledgement / handshake 作为 verification strategy 扩展点，不在本期实现复杂 handshake。

## 7. Protocol Operation Concurrency

- [x] 7.1 实现每 device 的 operation gate 或等效串行化机制。
- [x] 7.2 PollingScheduler read、CommandService write 和 CommandService read-back 通过同一 device gate 执行。
- [x] 7.3 命令执行期间，同一 device 的 polling tick 跳过或延后，避免单连接不受控并发。
- [x] 7.4 同一 device 默认只允许一个 active command；第二个命令直接返回 busy/rejected，不排队。
- [x] 7.5 进入 `Reconnecting` 或手工 disconnect 时，已有 active command 以失败、取消或 timeout 结束。
- [x] 7.6 dispose 时释放 gate、pending command 和 timer 资源。

## 8. Simulator Fault Injection

- [x] 8.1 扩展 Simulator fault control，支持 disconnect fault 和 recovery action 保留现有过程状态。
- [x] 8.2 增加可配置 response delay fault，用于 read/write request timeout 和 command timeout 测试。
- [x] 8.3 增加 write failure fault，支持一次性或持续写入失败模式。
- [x] 8.4 增加 network error fault，能够中断 active connection 或 request。
- [x] 8.5 故障控制通过 console command、CLI command 或 test helper 触发，不要求 HMI 写特殊 Modbus 寄存器。
- [x] 8.6 确保 fault injection 只存在于 Simulator/test helper，不被 HMI 业务代码特殊依赖。

## 9. Typed IPC and Preload API

- [x] 9.1 在 shared IPC channels 中新增 device state snapshot、device state subscribe/unsubscribe、command execute 和 command result 相关通道。
- [x] 9.2 在 shared HMI API 类型中新增 `devices.subscribeState` 或等效 typed subscription。
- [x] 9.3 在 shared HMI API 类型中新增 `commands.execute` 或等效 typed command API。
- [x] 9.4 Main IPC handler 调用 DeviceManager 获取状态 snapshot 和订阅状态事件。
- [x] 9.5 Main IPC handler 调用 CommandService 执行命令，并返回统一 HMI result。
- [x] 9.6 Preload 暴露最小 typed API，不暴露 raw `ipcRenderer` 或任意 IPC invoke/send。
- [x] 9.7 Renderer unsubscribe 或窗口销毁时清理 Main/Preload listeners。
- [x] 9.8 更新 IPC 错误转换，保证 command timeout、rejected、busy、communication failed 都以统一形状返回。

## 10. Renderer ViewModels and UI

- [x] 10.1 扩展 Root/App/Device/Dashboard ViewModel，保存 device state snapshot 和状态订阅。
- [x] 10.2 DeviceViewModel 新增命令方法，调用 typed command API 而不是协议写入 API。
- [x] 10.3 DeviceViewModel 维护 command pending、success、rejected、timeout、failed 状态。
- [x] 10.4 Renderer 对 Target Temperature 和 RPM Setpoint 做即时输入校验，但保留 Main Process 权威校验。
- [x] 10.5 Device 页面增加 Start、Stop、Motor Start/Stop、Inlet Valve、Outlet Valve、Target Temperature、RPM Setpoint 控制入口。
- [x] 10.6 Dashboard 或 Device 页面清晰展示 `Disconnected`、`Connecting`、`Connected`、`Reconnecting`、`Fault`。
- [x] 10.7 `Reconnecting`、`Disconnected`、`Fault` 下 UI 清晰显示断线/不可控制状态，并默认禁用或保护控制入口。
- [x] 10.8 Dashboard 和 Device Tag Monitor 在 `Bad` / `Uncertain` quality 时显示可区分的降级状态和 last value 语义。
- [x] 10.9 确保 React View 不理解 Modbus function code、holding register、coil address、backoff 或 socket 错误。

## 11. Tests

- [x] 11.1 添加 Device State Machine 单元测试，覆盖合法转换和非法转换拒绝。
- [x] 11.2 添加 manual disconnect cleanup 测试，覆盖 reconnect timer、polling timer、adapter 和 pending command 资源释放。
- [x] 11.3 添加 reconnect backoff 测试，覆盖延迟序列、最大间隔、单 loop 和取消。
- [x] 11.4 添加 connection loss -> `Reconnecting` -> reconnect success -> `Connected` 测试。
- [x] 11.5 添加 Tag Quality 测试，覆盖 connection loss 标记 `Bad`、manual disconnect 标记 `Uncertain`、stale timeout 标记 `Bad`、post-reconnect sample 恢复 `Good`。
- [x] 11.6 添加 CommandService 校验测试，覆盖 ReadOnly Tag、非法 value type、Target Temperature 越界、RPM Setpoint 越界。
- [x] 11.7 添加 CommandService write verification 测试，覆盖 Target Temperature `0.1°C` 容差、RPM 整数精确匹配、holding-register read-back 和 boolean feedback read-back。
- [x] 11.8 添加 CommandService timeout、write failure、busy/rejected、不排队和 reconnecting rejection 测试。
- [x] 11.9 添加 operation gate 或并发控制测试，验证 command 与 polling 不产生不受控并发。
- [x] 11.10 添加 Simulator fault injection 测试，覆盖 disconnect/recover、response delay、network error、write failure。
- [x] 11.11 添加 IPC/preload contract 测试，验证 typed state subscription、command execute 和 unsubscribe cleanup。
- [x] 11.12 更新 Renderer ViewModel 测试，验证 command state、device state、输入校验和 Quality 降级展示状态。
- [x] 11.13 更新 architecture boundary 测试，禁止 Renderer 导入 Main/Protocol/Command/Device/Polling/TagCache 模块或 Node.js API。
- [x] 11.14 添加集成或手工验收测试，覆盖 PLC 正常运行、HMI 采集、Simulator 断线、`Reconnecting`、Tag `Bad`、Simulator 恢复、自动连接、数据恢复、Tag `Good`。
- [x] 11.15 验证非法写入被拦截、ReadOnly Tag 无法写、Command timeout 不会导致 UI 卡死。

## 12. Documentation

- [x] 12.1 更新 Device State Machine 文档，列出状态、事件、合法转换和非法转换处理。
- [x] 12.2 更新通信可靠性文档，说明 reconnect backoff、最大间隔、取消条件和日志限频。
- [x] 12.3 更新 Tag Model / Tag Quality 文档，说明 `Bad`、`Uncertain`、last value、stale timeout 和恢复采集规则。
- [x] 12.4 新增或更新 CommandService 文档，说明控制数据流、命令定义、校验、timeout 和 read-back verification。
- [x] 12.5 更新 Modbus Mapping 或控制点位文档，说明 Start、Stop、Motor、Valve、Target Temperature、RPM Setpoint 对应点位和反馈点。
- [x] 12.6 更新 Simulator 使用文档，说明 disconnect、recover、response delay、network error、write failure 的触发方式。
- [x] 12.7 文档中明确本项目是 Simulator 学习/工程实践项目，不声称真实生产部署或 Safety PLC 安全能力。
- [x] 12.8 更新手工验收说明，覆盖本 change 的断线自动恢复和非法命令场景。

## 13. Verification

- [x] 13.1 运行 `openspec validate add-device-control-resilience --strict`。
- [x] 13.2 运行 `openspec validate --all --strict`。
- [x] 13.3 运行 `git diff --check`。
- [x] 13.4 运行 `npm run typecheck`。
- [x] 13.5 运行 `npm run lint`。
- [x] 13.6 运行 `npm run test`。
- [x] 13.7 运行 `npm run build`。
- [x] 13.8 手工或自动验证验收 Scenario：正常采集、Simulator 断线、`Reconnecting`、Tag `Bad`、Simulator 恢复、自动重连、Tag `Good`。
- [x] 13.9 汇报仍然存在的风险、失败项或未完成验证，不自动 commit、push 或 archive。
