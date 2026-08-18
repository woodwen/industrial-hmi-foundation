## Why

Industrial HMI 已经具备独立 PLC Simulator、Modbus TCP 通信、手工读写验证和实时 Tag 采集链路，但设备连接异常后仍缺少自动恢复、明确状态机、控制命令统一入口和写入验证。当前阶段需要补齐工业 HMI 的基础通信可靠性和控制安全边界，避免断线后旧数据继续被 UI 当作正常实时数据展示，也避免 Renderer/ViewModel 直接承担设备写入职责。

## What Changes

- 新增设备连接状态机，至少覆盖 `Disconnected`、`Connecting`、`Connected`、`Reconnecting`、`Fault`，并定义合法状态转换和非法转换处理。
- 新增受控自动重连：连接异常从 `Connected` 进入 `Reconnecting`，按带最大间隔限制的 backoff 重试，恢复后回到 `Connected` 并重新启动采集。
- 收紧 Tag Quality 生命周期：通信失败、数据超时、连接断开或重连中时相关 Tag 标记为 `Bad`；恢复连接并成功重新采集后标记为 `Good`；允许保留 last value，但 UI 必须清晰标记非 Good 质量。
- 新增 `CommandService`，统一处理所有设备写操作，数据流保持 Renderer -> ViewModel -> typed IPC -> CommandService -> Protocol Adapter -> PLC。
- 新增设备控制能力：Start、Stop、Motor Start/Stop、Inlet Valve、Outlet Valve、Target Temperature、RPM Setpoint。
- 新增写入验证模型，区分 Modbus write request 成功、read-back 成功和设备状态达到目标值；本期不实现复杂 PLC handshake，但命令结果结构需要允许以后扩展。
- 新增基本控制保护：ReadOnly Tag 禁止写入，非法数值禁止写入，Target Temperature 和 RPM Setpoint 执行范围校验。
- 扩展 PLC Simulator 故障注入能力：断线、网络异常模拟、可选响应延迟、可选写入失败，用于验证异常路径。
- Renderer UI 显示设备断线/重连状态、控制命令结果、Command timeout 和 Tag Quality 降级状态，且命令超时不得导致 UI 卡死。
- 本期仍是 Simulator 学习/工程实践项目，不声称提供真实工业 Safety PLC 安全能力。

## Capabilities

### New Capabilities
- `device-control-resilience`: 定义设备状态机、自动重连、CommandService、设备控制命令、写入验证、命令超时、控制校验、并发控制、typed IPC 和 Renderer 控制 ViewModel/UI 行为。

### Modified Capabilities
- `modbus-plc-simulator`: 扩展 Simulator 故障注入；调整前期“连接丢失后只能手工重连”的契约，使 HMI 可通过 DeviceManager 自动重连；补充响应延迟、网络异常和写入失败模拟。
- `tag-polling-monitoring`: 收紧 Tag Quality 在连接断开、重连、数据超时和恢复采集时的生命周期，并要求 Dashboard/Device Tag Monitor 清晰展示非 Good 质量。

## Impact

- 影响 `src/main/device/`：新增或调整 Device State Machine、DeviceManager lifecycle、reconnect backoff、状态事件和资源清理。
- 影响 `src/main/command/`：新增 `CommandService`、命令定义、控制校验、read-back 验证、timeout 和并发控制。
- 影响 `src/main/protocol/`：复用 `IProtocolAdapter`，补充写入 timeout、统一错误转换和异常隔离；协议库仍停留在 Infrastructure/Adapter 层。
- 影响 `src/main/tag/`：连接异常和数据超时会批量更新相关 Tag Quality；恢复采集后恢复 `Good`。
- 影响 `src/main/ipc/`、`src/preload/`、`src/shared/`：新增 typed device state subscription、command API、命令结果和错误类型，不暴露 raw IPC 或协议客户端。
- 影响 `src/renderer/viewmodels/` 与 `src/renderer/pages/`：Device/Dashboard ViewModel 展示设备状态、重连过程、命令执行状态、控制表单校验和 Quality 降级。
- 影响 Simulator 脚本和测试 helper：增加断线、恢复、响应延迟、网络异常、写入失败控制入口。
- 影响测试：新增状态机、backoff、Tag Quality 降级/恢复、CommandService 校验、read-back、timeout、并发控制、Simulator 故障注入和 Renderer 边界测试。
- 影响文档：更新设备状态机、重连策略、Tag Quality 生命周期、CommandService、控制点位、写入验证和 Simulator 异常场景说明。
