## Context

`industrial-hmi-foundation` 当前已经完成 Electron Main / Preload / Renderer 分层、MobX MVVM、统一错误模型、日志、独立 PLC Simulator、Modbus TCP Adapter、DeviceManager、TagService、TagCache、PollingScheduler、Dashboard 实时监控和 Device Tag Monitor。前置 `modbus-plc-simulator` 明确了设备状态枚举，但连接异常后的恢复仍以手工 reconnect 为主；前置 `tag-polling-monitoring` 已定义 `Good` / `Bad` / `Uncertain`，但还没有完整覆盖自动重连、数据超时和恢复采集后的生命周期。

本 change 在既有架构上补齐设备控制和通信可靠性。目标数据流保持：

```text
Renderer View
  ↓
Renderer ViewModel
  ↓ typed Preload API
Main IPC Handler
  ↓
CommandService / DeviceManager
  ↓
IProtocolAdapter
  ↓
PLC Simulator
```

Renderer 不直接连接 PLC、不直接创建 TCP/Modbus client、不访问 Node.js API、不绕过 CommandService 写设备。

## Goals / Non-Goals

**Goals:**

- 定义 Device State Machine，明确合法状态转换和异常状态处理。
- 在设备连接异常后自动进入 `Reconnecting`，使用最大间隔受限的 backoff 重连策略。
- 连接断开、通信失败、数据超时和重连期间把相关 Tags 标记为 `Bad`；恢复连接并成功采集后恢复 `Good`。
- 新增 `CommandService`，统一 Start、Stop、Motor Start/Stop、Inlet Valve、Outlet Valve、Target Temperature、RPM Setpoint 写入。
- 区分 Modbus write response、read-back / feedback verification 和 command timeout。
- 拦截 ReadOnly Tag、非法数值、Target Temperature 越界、RPM Setpoint 越界。
- 通过 Simulator 故障注入验证 disconnect、网络异常、响应延迟和写入失败。
- 保持异常隔离：通信和命令异常不让 Renderer 卡死或崩溃。

**Non-Goals:**

- 不实现真实工业 Safety PLC、安全继电器或硬件联锁能力。
- 不实现复杂 PLC handshake、命令序列号、PLC acknowledgement 寄存器或批量 Recipe Download。
- 不新增 Alarm、Historian、Trend、Recipe、Permission、Audit 或 OPC UA。
- 不把重连循环下沉到具体 Modbus 第三方库。
- 不允许 Renderer 或 ViewModel 直接执行协议写入。

## Decisions

### 0. 已确认默认策略

本 change 按以下默认策略实施，不再作为开放问题处理：

- 初始连接失败进入 `Fault`，不启动自动重连；用户点击 Retry/Connect 后再重新尝试。
- 只有设备已经处于 `Connected` 后发生的异常通信丢失，才自动进入 `Reconnecting`。
- Reconnect backoff 使用 `1s -> 2s -> 4s -> 8s -> 10s -> 10s...`，默认不设置最大尝试次数，但最大间隔固定为 `10s`。
- 用户手工 Disconnect、runtime dispose 或不可恢复错误必须取消 reconnect loop。
- 断线、重连中、通信失败和 stale timeout 时保留 last value，但 Tag Quality 必须变为 `Bad`。
- stale timeout 使用 `max(3 * scanRate, 3000ms)`。
- 重连成功只代表通信连接恢复；相关 Tags 必须等首次成功采集后才从 `Bad` 恢复为 `Good`。
- 同一设备默认一次只允许一个 active command；第二个命令直接返回 busy/rejected，不排队。
- Polling 和 Command 共用 device operation gate；命令执行期间同设备 polling tick 跳过或延后。
- command timeout 默认 `3000ms`；Start/Stop/Motor/Valve 这类等待反馈的命令默认 `5000ms`。
- Target Temperature read-back 容差为 `0.1°C`；RPM Setpoint read-back 按整数精确匹配。
- Simulator 故障控制优先通过 test helper + CLI/console 暴露，不通过 HMI 写特殊 Modbus 寄存器。
- `Reconnecting`、`Fault`、`Disconnected` 下 Renderer 控制入口默认禁用或进入受保护状态，UI 显示设备状态、Tag Quality 和命令结果，不展示裸 socket 错误。

### 1. Device State Machine

设备连接状态由 Main Process 的 DeviceManager 持有，状态枚举为：

```text
Disconnected
Connecting
Connected
Reconnecting
Fault
```

合法转换：

| From | To | Trigger |
| --- | --- | --- |
| `Disconnected` | `Connecting` | 用户点击 Connect 或应用恢复已配置设备连接 |
| `Connecting` | `Connected` | adapter connect 成功 |
| `Connecting` | `Fault` | 初始 connect 失败或配置错误；默认不自动重连 |
| `Connecting` | `Disconnected` | 用户取消/手工断开 |
| `Connected` | `Reconnecting` | polling、status check、read 或 write 检测到连接丢失 |
| `Connected` | `Disconnected` | 用户手工 Disconnect |
| `Reconnecting` | `Connected` | 某次 reconnect connect 成功 |
| `Reconnecting` | `Fault` | 不可恢复错误或资源初始化失败 |
| `Reconnecting` | `Disconnected` | 用户手工 Disconnect 或 runtime dispose |
| `Fault` | `Connecting` | 用户手工 Retry/Connect |
| `Fault` | `Disconnected` | 用户 Reset/Disconnect |

非法转换会被拒绝并记录 application/error log。实现上建议通过纯函数 `transition(current, event)` 管理状态，而不是多个 boolean 标志。DeviceManager 负责发布状态事件，Renderer 通过 typed subscription 展示状态。

备选方案是继续由 `ModbusAdapter.getStatus()` 直接作为 UI 状态。该方案无法表达“业务正在受控重连”和“适配器已经断开但设备生命周期仍活跃”的差异，因此不采用。

### 2. Reconnect Backoff

自动重连由 DeviceManager 编排，具体协议 adapter 只提供 `connect`、`disconnect`、`read`、`write` 和错误信息，不启动隐藏 reconnect loop。

默认 backoff：

```text
1s -> 2s -> 4s -> 8s -> 10s -> 10s ...
```

规则：

- 每个 device 同一时间最多存在一个 reconnect loop。
- 每次重连尝试都使用 connect timeout。
- 用户手工 Disconnect、runtime dispose 或进入不可恢复 `Fault` 时取消 loop。
- 重连中暂停该设备 PollingScheduler，避免旧连接上的请求继续执行。
- 重连成功后重新建立 PollingScheduler，并等待首次成功采集再把相关 Tags 恢复为 `Good`。
- 重复失败日志限频，避免 Simulator 长时间断线时刷屏。

不设置无限快重试，不允许零间隔 while loop。默认不设置最大尝试次数，可以持续重试，但间隔必须受最大值限制；不可恢复配置错误进入 `Fault`，不继续重试。初始 connect 失败不进入 reconnect loop，避免用户尚未建立过有效连接时产生后台无限重试。

### 3. Tag Quality 生命周期

TagCache 保留每个 Tag 的 latest value，但 quality 和 timestamp 必须同步更新。

状态规则：

- 初始未采集：`Uncertain`，value 可为 `null`。
- 成功采集和 decode：`Good`，timestamp 更新为采集时间。
- 通信失败、连接断开、进入 `Reconnecting`：该 device 相关 Tags 批量标记为 `Bad`，允许保留 last value。
- 数据超时：超过 `max(3 * scanRate, 3000ms)` 未成功采集的 Tag 标记为 `Bad`。
- 手工 Disconnect：该 device 相关 Tags 标记为 `Uncertain`，表示用户主动停止采集。
- 重连成功但尚未重新采集：仍保持 `Bad`，避免“连接已恢复”被误读为“数据已恢复”。
- 重连后首次成功采集：成功读取的 Tags 恢复为 `Good`。

UI 必须把 `Bad` / `Uncertain` 展示为降级质量，不把 last value 作为普通实时数据。Dashboard 可以显示 last value，但必须同时显示断线/质量标记。

### 4. CommandService

所有写设备操作进入 Main Process 的 `CommandService`。CommandService 不负责设备状态机重连 loop，但会查询 DeviceManager 状态并通过 `IProtocolAdapter` 执行写入。

建议命令定义：

```text
CommandDefinition
  id
  deviceId
  targetTagId
  writeValue
  validation
  verification
  timeoutMs
```

本期命令：

| Command | Target | Validation | Verification |
| --- | --- | --- | --- |
| Start | device start coil | boolean | write response + running feedback read-back |
| Stop | device start coil | boolean | write response + running feedback read-back |
| Motor Start/Stop | motor command coil | boolean | write response + motor feedback read-back |
| Inlet Valve | inlet valve command coil | boolean | write response + inlet feedback read-back |
| Outlet Valve | outlet valve command coil | boolean | write response + outlet feedback read-back |
| Target Temperature | holding register `40001` | `20.0°C` to `90.0°C` | write response + holding register read-back，容差 `0.1°C` |
| RPM Setpoint | holding register `40002` | `0` to `1800 rpm` | write response + holding register read-back，整数精确匹配 |

CommandService 返回统一 `CommandResult`，至少区分 `succeeded`、`rejected`、`timeout`、`failed`。Modbus write request 成功只代表协议写入已被接受；只有 read-back/feedback 满足预期时才表示验证成功。没有可用反馈的未来命令可以返回 `writeAccepted` 类型的成功结果，但本期核心命令应优先配置 read-back 或 feedback。

### 5. Timeout 和异常隔离

超时分层：

- connect timeout 沿用默认 `3000ms`。
- protocol request timeout 沿用默认 `2000ms`。
- command timeout 默认 `3000ms`；需要等待过程反馈的启停类命令可配置为 `5000ms`。

命令 timeout 不阻塞 Renderer。Preload API 返回 Promise，超时后解析为统一错误或失败结果；Renderer ViewModel 进入失败状态并允许用户再次操作。Main Process 必须清理 timeout、listener 和 pending verification，避免超时后迟到反馈污染下一条命令。

底层错误如 socket close、timeout、Modbus exception、write failure 统一转换为业务错误码，例如 `DEVICE_NOT_CONNECTED`、`DEVICE_RECONNECTING`、`COMMAND_REJECTED`、`COMMAND_TIMEOUT`、`COMMUNICATION_FAILED`。Renderer 不接收裸 `ECONNRESET`。

### 6. 并发控制

同一设备上的协议操作通过设备级 operation gate 串行化：

- PollingScheduler tick 进入 gate 执行 read。
- CommandService 写入和 read-back 进入同一 gate，避免 Modbus TCP 单连接上的不受控并发。
- 命令执行期间，同一 device 的 polling tick 可以跳过或延后。
- 同一 device 默认一次只允许一个 active command；后续命令直接返回 busy/rejected，不排队。
- 进入 `Reconnecting` 或 `Fault` 后拒绝新命令，已有命令以失败或 timeout 完成。

备选方案是允许 command write 与 polling read 并发，让协议库自行处理。该方案难以证明请求顺序和 timeout 归属，尤其在网络异常注入时容易出现迟到响应污染，因此不采用。

### 7. Simulator 故障注入

Simulator 故障控制仍应在 Modbus 协议外，通过 console command、CLI command 或 test helper 触发，不要求 HMI 写特殊故障寄存器。

本期增加：

- disconnect：关闭 active connections 并停止接受请求。
- recover：恢复监听，保留模拟寄存器和过程状态。
- response delay：为 read/write 增加可配置延迟，用于触发 request/command timeout。
- write failure：可配置一次性或持续写入失败，用于验证 CommandService 错误路径。
- network error：模拟连接 reset/请求中断，用于验证 reconnect 和异常隔离。

这些能力只用于 Simulator 和测试，不表示真实设备具备相同故障控制。

### 8. Typed IPC 和 Renderer ViewModel

新增 typed API 建议形态：

```text
window.hmi.devices.subscribeState(listener): Unsubscribe
window.hmi.commands.execute(command): Promise<HmiResult<CommandResult>>
```

Renderer ViewModel 只维护 UI 状态和调用 typed API：

- 展示 `Disconnected` / `Connecting` / `Connected` / `Reconnecting` / `Fault`。
- 在 `Reconnecting` / `Fault` 禁用或保护控制按钮。
- 对 Target Temperature 和 RPM Setpoint 做即时 UI 校验，但 Main 的 CommandService 仍做最终校验。
- 展示 command pending、success、rejected、timeout、failed。
- 展示 Tag Quality 降级和断线提示。

React View 不理解 Modbus function code、holding register、coil address、backoff 或 socket 错误。

## Risks / Trade-offs

- [Risk] 自动重连期间旧值仍显示在 UI，用户误以为数据实时。 → Mitigation: 断线/重连立即把相关 Tags 标记为 `Bad`，UI 必须显示质量标记和设备状态。
- [Risk] Command read-back 与 polling 同时访问同一 Modbus 连接导致响应归属混乱。 → Mitigation: 使用设备级 operation gate，命令期间跳过或延后 polling tick。
- [Risk] 长时间断线产生大量重连和 polling failure 日志。 → Mitigation: 断线后暂停 polling，重连日志限频，backoff 最大间隔限制为 `10s`。
- [Risk] Modbus write success 被误判为设备动作完成。 → Mitigation: CommandResult 明确区分 write response 和 verified result；本期核心命令配置 read-back/feedback。
- [Risk] Simulator 故障注入逻辑泄漏到业务代码。 → Mitigation: 故障控制只存在于 Simulator/test helper，HMI 业务层仍只面向普通 Modbus endpoint。
- [Risk] 过度设计命令框架影响本期交付。 → Mitigation: 本期只实现单设备、单 active command、基础 read-back；handshake、audit、permission、recipe 后续扩展。

## Migration Plan

1. 先实现 Main 层状态机、DeviceManager 状态事件和 reconnect loop，不改变 Renderer 协议边界。
2. 接入 Tag Quality 降级/恢复逻辑，保证断线场景不会继续显示普通 `Good` 数据。
3. 增加 CommandService 和 typed command IPC，再迁移现有 Device 写操作到 CommandService。
4. 增加 Renderer 控制 ViewModel/UI 状态展示。
5. 扩展 Simulator 故障注入和异常场景测试。
6. 最后补齐文档和验收脚本。

Rollback 时可以关闭自动重连开关并保留手工 Connect/Disconnect 路径；CommandService 的 API 边界不应回退为 Renderer 直接协议写入。

## Open Questions

无。范围、默认 backoff、命令验证方式和 Simulator 故障注入入口均按本设计执行。
