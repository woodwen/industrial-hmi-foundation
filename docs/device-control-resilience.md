# Device Control Resilience

本文档记录 `add-device-control-resilience` change 引入的设备状态机、自动重连、Tag Quality 生命周期、CommandService 和写入验证规则。

本项目仍是基于 PLC Simulator 的学习和工程实践项目。以下控制保护只用于 HMI / Simulator 架构验证，不声称提供真实工业 Safety PLC 安全能力。

## Device State Machine

设备连接状态由 `DeviceManager` 统一维护，不用多个 boolean 表示连接生命周期。

| State | 含义 |
| --- | --- |
| `Disconnected` | 未连接，手工断开或初始状态 |
| `Connecting` | 正在执行手工连接 |
| `Connected` | 协议连接可用，允许轮询和命令 |
| `Reconnecting` | 曾经 Connected 后通信丢失，正在自动重连 |
| `Fault` | 初始连接失败或不可恢复错误，需要用户重新触发连接 |

合法转换：

| From | Event | To |
| --- | --- | --- |
| `Disconnected` | `connectRequested` | `Connecting` |
| `Connecting` | `connectSucceeded` | `Connected` |
| `Connecting` | `connectFailed` | `Fault` |
| `Connecting` | `manualDisconnect` | `Disconnected` |
| `Connected` | `communicationLost` | `Reconnecting` |
| `Connected` | `manualDisconnect` | `Disconnected` |
| `Reconnecting` | `reconnectSucceeded` | `Connected` |
| `Reconnecting` | `unrecoverableFailure` | `Fault` |
| `Reconnecting` | `manualDisconnect` | `Disconnected` |
| `Fault` | `retryRequested` | `Connecting` |
| `Fault` | `manualDisconnect` | `Disconnected` |

非法转换会被拒绝并记录日志。每次成功转换会记录 `deviceId`、from/to、event、reason、`lastTransitionAt` 和简化错误摘要，并通过 typed IPC 推送给 Renderer。

## Reconnect

自动重连只由 `DeviceManager` 编排，`ModbusAdapter` 不隐式循环重连。

触发条件：

- 设备处于 `Connected`。
- polling、manual read、command write/read-back 或 adapter status 暴露的 connection-lost 状态报告通信失败。

行为：

- `Connected -> Reconnecting`。
- 停止该 device polling。
- 相关 Tags 标记为 `Bad`。
- 按 backoff 发起 reconnect attempt。

默认 backoff：

```text
1000ms -> 2000ms -> 4000ms -> 8000ms -> 10000ms -> 10000ms ...
```

默认不设置最大尝试次数，但同一 device 同一时间最多一个 reconnect loop。手工 disconnect、runtime dispose 或进入不可恢复 Fault 时取消 reconnect timer，并释放 adapter / polling / gate 资源。reconnect 成功只代表连接恢复，Tag 仍保持 `Bad`，直到下一次成功采集和 decode 后恢复 `Good`。

## Tag Quality Lifecycle

实时数据必须通过 `TagValue` 表达：

```text
tagId
value
quality
timestamp
```

质量规则：

| 场景 | Quality | Last value |
| --- | --- | --- |
| 首次成功采集前 | `Uncertain` | `null` |
| 成功采集并 decode | `Good` | 更新为最新值 |
| 通信失败、连接丢失、进入 `Reconnecting` | `Bad` | 可保留，但 timestamp 更新 |
| 手工 disconnect | `Uncertain` | 可保留，但 timestamp 更新 |
| 超过 stale timeout 未采集 | `Bad` | 可保留，但 timestamp 更新 |
| reconnect 后首次成功采集 | `Good` | 更新为最新值 |

stale timeout 规则：

```text
max(3 * scanRate, 3000ms)
```

UI 必须同时显示 value 和 quality。`Bad` / `Uncertain` 的 last value 不能被当作正常实时 `Good` 数据。

## CommandService

所有设备写操作统一经过：

```text
Renderer
↓
ViewModel
↓
Typed IPC / Preload
↓
CommandService
↓
IProtocolAdapter
↓
PLC / PLC Simulator
```

Renderer 和 ViewModel 不直接执行协议写入，不理解 Modbus function code、socket 错误或 reconnect backoff。

命令定义：

| Command | Target Tag | Write value | Verification |
| --- | --- | --- | --- |
| `start` | `deviceStartCommand` | `true` | `deviceRunningStatus == true` |
| `stop` | `deviceStartCommand` | `false` | `deviceRunningStatus == false` |
| `motorStart` | `mixerMotorCommand` | `true` | `mixerMotorRunningStatus == true` |
| `motorStop` | `mixerMotorCommand` | `false` | `mixerMotorRunningStatus == false` |
| `setInletValve` | `inletValveCommand` | boolean | `inletValveOpenStatus == value` |
| `setOutletValve` | `outletValveCommand` | boolean | `outletValveOpenStatus == value` |
| `setTargetTemperature` | `targetTemperature` | number | holding-register read-back, tolerance `0.1°C` |
| `setRpmSetpoint` | `manualMotorRpmSetpoint` | integer number | holding-register read-back, exact match |

安全保护：

- 非 `Connected` 状态拒绝命令。
- ReadOnly Tag 禁止写入。
- 非法 value type 禁止写入。
- Target Temperature 范围：`20.0°C` 到 `90.0°C`。
- RPM Setpoint 范围：`0` 到 `1800 rpm`。

## Write Verification And Timeout

`CommandResult.writeAccepted = true` 只表示 Modbus write request 已被接受，不代表设备实际状态已达到目标。

verification status：

| Status | 含义 |
| --- | --- |
| `verified` | read-back 或 feedback 已达到目标 |
| `failed` | read-back 失败、协议错误或值不满足要求 |
| `timeout` | timeout 前没有达到目标 |
| `notRequired` | 保留给未来无需验证的命令 |

默认 timeout：

| 命令类型 | Timeout |
| --- | ---: |
| Target Temperature / RPM Setpoint | `3000ms` |
| Start / Stop / Motor / Valve feedback | `5000ms` |

本期不实现复杂 PLC acknowledgement / handshake，但 CommandService 通过 command definition 和 verification strategy 保留扩展点。

## Concurrency

同一 device 使用 `DeviceOperationGate` 控制协议操作并发。

- Polling read、Command write、Command read-back 使用同一个 gate。
- 命令执行期间 polling tick 跳过，不排队。
- 同一 device 默认只允许一个 active command。
- 第二个命令返回 `busy`，不会形成无限队列。
- disconnect / dispose 会释放 gate、timer 和 subscription 资源。

## Simulator Fault Injection

Simulator 故障注入只通过控制台命令或测试 helper 触发，不占用业务 Modbus 寄存器。

| 命令 | 行为 |
| --- | --- |
| `disconnect` | 停止 TCP Server，保留内存和过程状态 |
| `recover` | 重新启动 TCP Server，保持过程状态 |
| `delay <ms>` | 为 read/write response 增加固定延迟 |
| `delay off` | 清除响应延迟 |
| `write-fail once` | 下一次写请求返回 Modbus exception |
| `write-fail on` | 持续写失败 |
| `write-fail off` | 清除写失败 |
| `network-error` | 中断 active socket；无连接时中断下一次请求 |
| `clear-faults` | 清除 delay / write failure / pending network error |

## Acceptance Scenario

1. 启动 Simulator：`npm run simulator:start`。
2. 启动 HMI 并连接设备。
3. Dashboard / Device Tag Monitor 显示实时采集，Quality 为 `Good`。
4. 在 Simulator 输入 `disconnect`。
5. Device 进入 `Reconnecting`。
6. 相关 Tag Quality 变为 `Bad`，UI 清晰显示断线/重连状态。
7. 在 Simulator 输入 `recover`。
8. HMI 自动重连，Device 回到 `Connected`。
9. Polling 重新启动并采集新数据。
10. 成功采集后的 Tags Quality 回到 `Good`。

额外验证：

- Target Temperature / RPM 越界被 Renderer 即时拦截，并由 Main Process 权威校验。
- ReadOnly Tag 经旧 `writeRegisters` 兼容入口写入时仍被 CommandService 拒绝。
- command timeout 返回结构化 `timeout` result，不阻塞 UI。
