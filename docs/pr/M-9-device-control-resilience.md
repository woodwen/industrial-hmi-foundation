# M-9(feat): 增强设备控制可靠性

OpenSpec Change: add-device-control-resilience

背景:
- 当前 HMI 已具备 Modbus PLC Simulator、Tag 周期采集和实时监控，但设备断线后缺少显式状态机、自动重连、受控写入路径和异常场景验证。
- 旧写入链路容易把 Modbus write response 与设备实际达到目标混淆，也缺少统一 command timeout、read-back/feedback 验证和并发控制。

方案概述:
- 引入 Device State Machine，统一管理 `Disconnected`、`Connecting`、`Connected`、`Reconnecting`、`Fault`。
- 由 `DeviceManager` 编排 bounded backoff 自动重连，并和 `PollingScheduler` / `TagCache` 协作维护 Tag Quality。
- 新增 Main Process `CommandService`，所有设备写入统一走 Renderer -> ViewModel -> Preload IPC -> CommandService -> Protocol Adapter -> PLC。
- 扩展 Simulator fault injection，用于验证 disconnect、response delay、network error 和 write failure。

实现改动:
- Main Process 新增 `DeviceOperationGate`、状态转换纯函数、设备状态 IPC publisher 和 `CommandService`。
- CommandService 支持 Start、Stop、Motor Start/Stop、Inlet Valve、Outlet Valve、Target Temperature、RPM Setpoint，并校验 read-only、类型和范围。
- 写入验证区分 `writeAccepted`、`verificationStatus` 和 command timeout，setpoint 走 holding-register read-back，布尔命令走反馈点 read-back。
- TagCache 增加 stale timeout 与 device-level quality 更新，PollingScheduler 在通信失败或 stale 时降级 Quality。
- Preload、Renderer application service 和 DeviceViewModel 接入 typed command/state API，Device 页面展示断线、重连、命令结果和 Quality 状态。
- Simulator 增加 console/test helper 故障控制；文档、帮助手册、OpenSpec specs 和测试同步更新。

测试计划(UT):
- `openspec validate add-device-control-resilience --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

影响范围(建议手动测试范围):
- Device 页面：Connect、Disconnect、Start、Stop、Motor Start/Stop、Inlet Valve、Outlet Valve、Target Temperature、RPM Setpoint。
- Dashboard 和 Device Tag Monitor：Simulator 断线后 Quality 降级为 `Bad`，恢复后自动重连并在成功采集后回到 `Good`。
- Simulator 控制台：`disconnect`、`recover`、`delay <ms>`、`write-fail once|on|off`、`network-error`、`clear-faults`。

风险与后续:
- 本提交只提供 HMI / Simulator 级控制保护，不提供真实工业 Safety PLC 能力。
- Permission、Audit、Alarm、Historian、Recipe 和 OPC UA 仍留给后续独立 OpenSpec change。

验收标准:
- 设备正常运行时 HMI 可实时采集并显示 `Good` Quality。
- Simulator 断线后 Device 进入 `Reconnecting`，相关 Tags 变为 `Bad`，UI 不把 last value 当作普通实时数据。
- Simulator 恢复后 HMI 自动连接，重新采集后 Quality 回到 `Good`。
- 非法写入、ReadOnly Tag 写入和 command timeout 均返回结构化结果，Renderer 不阻塞。
