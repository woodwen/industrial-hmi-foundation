## Context

`industrial-hmi-foundation` 已经提供 Electron Main / Preload / Renderer 分层、Renderer MVVM、最小化 `window.hmi` API、统一错误模型和日志基础。当前系统仍处于工业通信能力空缺状态：Dashboard 和 Device 页面只有结构性页面，Main 进程已有 `device`、`protocol`、`ipc` 等目录边界，但没有真实协议适配、设备连接生命周期或可独立运行的 PLC Simulator。

本 change 的目标是在不引入完整 Tag 系统和自动轮询的前提下，先打通一条可验证的链路：

```text
PLC Simulator
  ↓ Modbus TCP
Main Process / ModbusAdapter
  ↓ DeviceManager
Main IPC handler
  ↓ typed Preload API
Renderer DeviceViewModel
  ↓
Device or Dashboard View
```

业务场景是“自动化恒温混料设备”模拟。Simulator 必须只是测试设备，不能让 HMI 业务代码对 Simulator 产生特殊依赖；HMI 侧只能看到普通 Modbus TCP 设备配置与协议读写结果。

## Goals / Non-Goals

**Goals:**

- 实现可独立启动和停止的 PLC Simulator。
- Simulator 作为 Modbus TCP server 暴露混料设备模拟数据。
- 定义合理、可测试、可文档化的 Modbus Address Mapping，覆盖 Coil、Discrete Input、Holding Register、Input Register。
- 模拟设备启动后的温度、液位、压力、电机转速和生产计数变化。
- 提供断开连接和恢复连接的简单故障模拟能力。
- 在 Main Process 定义 `IProtocolAdapter`，隔离具体 Modbus TCP 实现或未来第三方库。
- 实现 `ModbusAdapter`，负责 Modbus TCP connect、disconnect、read、write、status 和错误映射。
- 实现 `DeviceManager`，负责设备配置、连接生命周期和连接状态。
- 通过 Preload 暴露 typed IPC API，Renderer 不接触 raw IPC、Node.js API 或 Modbus client。
- 在 Dashboard 或 Device 页面提供手工连接、断开、状态显示、读取指定点位、写入目标温度和控制 Coil 的验证能力。
- 覆盖 Simulator 未启动、连接失败、请求超时、非法地址、非法写入、Simulator 停止后的错误处理和日志。

**Non-Goals:**

- 不实现 `PollingScheduler`。
- 不实现 `TagCache`、完整 Tag 模型、数据质量传播或趋势 ring buffer。
- 不实现 Alarm、Historian、Recipe、Permission、Audit。
- 不实现自动重连；Simulator 恢复后由用户手工重新连接。
- 不实现 OPC UA。
- 不把 Modbus TCP 实现、未来第三方库或 TCP 能力暴露给 Renderer。
- 不把 Simulator 作为 Electron HMI 的内嵌功能启动或强绑定。

## Decisions

### 0. 默认决策汇总

本 change 按以下默认值实施，不再作为开放问题阻塞：

- Simulator endpoint：`127.0.0.1:1502`，Unit ID `1`，允许通过环境变量或配置覆盖。
- Modbus 地址：文档和 UI 显示 reference address，代码内部统一使用 PDU zero-based address。
- 故障控制：通过 Simulator 控制台命令或独立 CLI 触发 disconnect/recover，不通过 Modbus 寄存器触发。
- 故障恢复：recover 后默认保留当前内存和过程状态；Simulator 进程完全重启时回到初始值。
- UI 位置：协议链路验证默认放在 Device 页面，Dashboard 至多显示连接摘要或关键值摘要。
- UI 输入：本期不提供任意 function code/address 输入，只提供预定义点位和受控写入。
- 目标温度范围：`20.0°C` 到 `90.0°C`，Holding Register `40001`，scale `0.1`。
- 手动电机转速范围：`0` 到 `1800 rpm`，Holding Register `40002`，scale `1`。
- Production Count 编码：Input Register `30005-30006`，UInt32，高字在前、低字在后。
- 连接状态：保留 `Disconnected`、`Connecting`、`Connected`、`Reconnecting`、`Fault`，但本期不实现自动重连。
- 超时：connect timeout 默认 `3000ms`，request timeout 默认 `2000ms`。
- Simulator 初始值：当前温度 `25.0°C`，目标温度 `60.0°C`，液位 `40.0%`，压力 `0.12MPa`，RPM `0`，生产计数 `0`。
- 日志：只记录连接、断开、手工读写和异常路径；不记录连续过程值。
- 验收：自动测试覆盖核心逻辑和 Adapter，人工验收覆盖 Electron UI 场景 1-6。
- Modbus TCP 实现：本期不新增第三方 Modbus 生产依赖，使用 Node TCP 实现受控的最小 Modbus TCP client/server 子集，并隔离在 Adapter/Simulator 层；后续如替换为第三方库，业务层和 Renderer API 不应变化。

### 1. PLC Simulator 架构

Simulator 作为独立 Node/TypeScript 进程实现，默认通过项目脚本启动，例如 `npm run simulator:dev` 或等价脚本。它不依赖 Electron Main、Preload 或 Renderer，也不读取 HMI 内部 ViewModel。

Simulator 内部分为四个职责：

- `ProcessModel`：保存混料设备状态并执行仿真 tick。
- `ModbusMemoryMap`：维护 Coil、Discrete Input、Holding Register、Input Register 的寄存器内存。
- `ModbusTcpServer`：监听 TCP 端口并处理 Modbus 请求。
- `FaultController`：触发断开连接和恢复连接。

默认监听配置：

- Host：`127.0.0.1`
- Port：`1502`
- Unit ID：`1`

使用 `1502` 而不是标准 `502`，因为 `502` 在很多系统上需要特权端口权限，开发和自动化测试更容易受阻。端口、host 和 unit id 必须可通过配置或环境变量覆盖。

默认初始过程值：

- 当前温度：`25.0°C`
- 目标温度：`60.0°C`
- 当前液位：`40.0%`
- 当前压力：`0.12MPa`
- 电机转速：`0 rpm`
- 生产计数：`0`

仿真规则采用简单确定性模型：

- Device Start Coil 为 `true` 后，设备进入运行状态。
- 当前温度逐步向目标温度靠近，变化速率有限。
- 进料阀打开时液位上升，出料阀打开时液位下降，液位限定在 0.0% 到 100.0%。
- 搅拌电机状态为 `true` 时，电机转速逐步接近设定或默认运行转速；停止时逐步降至 0。
- 设备运行时压力随液位和电机转速产生温和变化，并限制在合理范围。
- 设备运行且达到一个可配置生产周期后，Production Count 增加。

故障模拟不走 Modbus 寄存器触发，因为断开连接后 HMI 无法再通过 Modbus 自行恢复 server。默认通过 Simulator 控制台命令、CLI 子命令或测试辅助接口触发：

- Disconnect：关闭监听 server 并断开当前 socket，模拟 PLC 或网络不可达。
- Recover：重新监听同一 host/port/unit id，并保留当前仿真内存和过程状态。

备选方案是把 Simulator 嵌入 Electron Main，由 HMI 点击按钮控制。该方案演示方便，但会让测试设备与 HMI 耦合，违背“Simulator 可替换为真实 Modbus PLC”的目标，因此不采用。

### 2. Modbus Address Mapping

地址同时记录人类常用 reference address 和 Modbus PDU zero-based address。代码内部必须使用 zero-based address，UI 和文档可以显示 reference address，避免 `40001` 与 `0` 混用导致 off-by-one。

#### Coils, 0x, read/write

| Reference | PDU Address | Key | Type | Access | Description |
| --- | ---: | --- | --- | --- | --- |
| 00001 | 0 | `deviceStartCommand` | Boolean | R/W | 设备启动/停止命令 |
| 00002 | 1 | `mixerMotorCommand` | Boolean | R/W | 搅拌电机启停命令 |
| 00003 | 2 | `inletValveCommand` | Boolean | R/W | 进料阀开关命令 |
| 00004 | 3 | `outletValveCommand` | Boolean | R/W | 出料阀开关命令 |
| 00005 | 4 | `autoModeCommand` | Boolean | R/W | 自动/手动模式，`true` 表示自动 |

#### Discrete Inputs, 1x, read-only

| Reference | PDU Address | Key | Type | Access | Description |
| --- | ---: | --- | --- | --- | --- |
| 10001 | 0 | `deviceRunningStatus` | Boolean | R | 设备运行反馈 |
| 10002 | 1 | `mixerMotorRunningStatus` | Boolean | R | 搅拌电机运行反馈 |
| 10003 | 2 | `inletValveOpenStatus` | Boolean | R | 进料阀打开反馈 |
| 10004 | 3 | `outletValveOpenStatus` | Boolean | R | 出料阀打开反馈 |
| 10005 | 4 | `autoModeStatus` | Boolean | R | 自动模式反馈 |

Discrete Input 用于表达来自设备侧的只读反馈。当前 Simulator 可以让反馈与 Coil 命令短延迟同步，后续真实 PLC 可替换为真实反馈点。

#### Input Registers, 3x, read-only

| Reference | PDU Address | Key | Type | Scale | Unit | Access | Description |
| --- | ---: | --- | --- | ---: | --- | --- | --- |
| 30001 | 0 | `currentTemperature` | Int16 | 0.1 | °C | R | 当前温度 |
| 30002 | 1 | `currentLevel` | UInt16 | 0.1 | % | R | 当前液位 |
| 30003 | 2 | `currentPressure` | UInt16 | 0.01 | MPa | R | 当前压力 |
| 30004 | 3 | `motorRpm` | UInt16 | 1 | rpm | R | 当前电机转速 |
| 30005-30006 | 4-5 | `productionCount` | UInt32 | 1 | count | R | 生产计数，高字在前、低字在后 |

#### Holding Registers, 4x, read/write

| Reference | PDU Address | Key | Type | Scale | Unit | Access | Valid Range | Description |
| --- | ---: | --- | --- | ---: | --- | --- | --- | --- |
| 40001 | 0 | `targetTemperature` | Int16 | 0.1 | °C | R/W | 20.0-90.0 | 目标温度 |
| 40002 | 1 | `manualMotorRpmSetpoint` | UInt16 | 1 | rpm | R/W | 0-1800 | 手动模式电机转速设定 |

非法地址必须返回 Modbus exception 或被 Adapter 映射为统一应用错误。非法写入包括：

- 写 Discrete Input 或 Input Register。
- 写未定义 Coil 或 Holding Register。
- 写入数量与点位类型不匹配，例如只写 `productionCount` 的一个 word。
- 写入目标温度或转速超出有效范围。

### 3. `IProtocolAdapter`

`IProtocolAdapter` 位于 Main Process 协议边界，表达业务需要的协议能力，而不是 Modbus TCP 实现或第三方库的对象模型。建议接口语义如下：

```text
connect(config) -> Promise<void>
disconnect() -> Promise<void>
read(request) -> Promise<ProtocolReadResult>
write(request) -> Promise<ProtocolWriteResult>
getStatus() -> ProtocolAdapterStatus
```

核心类型：

- `ProtocolConnectionStatus`：`Disconnected`、`Connecting`、`Connected`、`Reconnecting`、`Fault`。本期不实现自动重连，但保留 `Reconnecting` 以满足设备状态模型并为后续 change 留出语义。
- `ProtocolRegisterArea`：`coil`、`discreteInput`、`holdingRegister`、`inputRegister`。
- `ProtocolReadRequest`：`area`、`address`、`quantity`、可选 `unitId` 和 `timeoutMs`。
- `ProtocolWriteRequest`：`area`、`address`、`values`、可选 `unitId` 和 `timeoutMs`。
- `ProtocolAdapterStatus`：连接状态、endpoint、unit id、最后成功时间、最后错误摘要。

`IProtocolAdapter` 不包含 Tag、Alarm、Historian 或自动轮询概念。它只提供手工读写所需的最低协议能力。

备选方案是让 `DeviceManager` 直接调用 Modbus TCP client 或第三方库。该方案代码少，但会把设备生命周期、协议细节和第三方 API 绑定在一起，后续增加 OPC UA 或替换 Modbus 实现时会污染业务层，因此不采用。

### 4. `ModbusAdapter`

`ModbusAdapter` 是 `IProtocolAdapter` 的 Modbus TCP 实现。具体 TCP/Modbus 细节或未来第三方库只能被 `ModbusAdapter` 或其同层 helper 引用，不允许出现在 `DeviceManager`、IPC handler、Preload 或 Renderer 中。

职责：

- 建立 TCP 连接并设置 connect timeout。
- 对每次 read/write 设置 request timeout。
- 支持读 Coil、Discrete Input、Holding Register、Input Register。
- 支持写 Coil 和 Holding Register。
- 将 Modbus exception、TCP 错误、timeout、连接关闭、非法响应转换为统一应用错误。
- 在 connect、disconnect、read、write、timeout 和异常路径记录 communication log。
- 释放 socket、timer、listener 等资源。

错误映射建议：

| Condition | Application Error Code | UI Message Intent |
| --- | --- | --- |
| Simulator 未启动或 TCP 连接失败 | `DEVICE_CONNECTION_FAILED` | 无法连接设备 |
| 未连接时读写 | `DEVICE_NOT_CONNECTED` | 设备未连接 |
| 请求超时 | `DEVICE_REQUEST_TIMEOUT` | 设备请求超时 |
| 非法地址或 Modbus illegal data address | `DEVICE_ILLEGAL_ADDRESS` | 寄存器地址无效 |
| 非法写入或 Modbus illegal data value | `DEVICE_WRITE_REJECTED` | 写入被设备拒绝 |
| TCP 中断或 socket close | `DEVICE_CONNECTION_LOST` | 设备连接已断开 |
| 其他协议异常 | `PROTOCOL_ERROR` | 协议通信异常 |

本期不实现自动重连。发生连接丢失时，Adapter 状态进入 `Fault` 或 `Disconnected`，由用户手工点击 Connect 重新连接。

### 5. `DeviceManager`

`DeviceManager` 位于 Main Process application/domain service 边界，负责设备配置和连接生命周期。它不理解具体 Modbus TCP 实现或第三方库，只依赖 `IProtocolAdapter`。

本期只需要支持一个默认模拟设备配置：

- `deviceId`: `simulated-mixer-plc`
- `name`: `恒温混料 PLC Simulator`
- `protocol`: `modbusTcp`
- `host`: `127.0.0.1`
- `port`: `1502`
- `unitId`: `1`
- `connectTimeoutMs`: 默认 3000
- `requestTimeoutMs`: 默认 2000

职责：

- 保存当前设备配置。
- 创建和持有协议适配器实例。
- 提供 `connectDevice`、`disconnectDevice`、`getDeviceStatus`。
- 提供本期手工验证用 `readDeviceRegisters` 和 `writeDeviceRegisters`。
- 对写入区域做基础防护，拒绝 Renderer 绕过业务规则写只读区域。
- 捕获 Adapter 错误，更新设备连接状态，返回统一错误模型。

`DeviceManager` 不做自动轮询，不保存 TagCache，不负责业务报警或历史写入。

### 6. Main Process 与 Renderer 通信路径

Renderer 调用路径必须保持：

```text
DevicePage / DashboardPage
  ↓
DeviceViewModel
  ↓
HmiApiBrowserClient
  ↓
window.hmi.devices.connect()
window.hmi.devices.disconnect()
window.hmi.devices.getStatus()
window.hmi.devices.readRegisters()
window.hmi.devices.writeRegisters()
  ↓
Preload typed bridge
  ↓
Main IPC handler
  ↓
DeviceManager
  ↓
IProtocolAdapter / ModbusAdapter
  ↓
Modbus TCP
  ↓
PLC Simulator
```

Preload 只暴露面向用例的 API，不暴露 `ipcRenderer`、任意 channel、Modbus client、TCP socket 或 Node.js API。IPC request/response 类型定义在 shared 类型模块中，Renderer ViewModel 通过 `HmiApiBrowserClient` 使用这些 API。

UI 层默认放在 Device 页面，因为这更符合“设备连接与协议链路验证”的职责。Dashboard 可以只显示连接摘要或关键过程值，不承担原始协议诊断职责。若实施阶段选择 Dashboard，也必须保持 ViewModel 分层。

Device 页面展示的读写点位使用预定义 mapping，不提供任意 Modbus function code 或任意地址输入。这样可以满足手工读写验证，同时避免 View 直接理解底层协议细节。

### 7. 异常处理策略

连接与请求异常不能让 Electron Renderer 崩溃。策略如下：

- Simulator 未启动：Connect 返回 `DEVICE_CONNECTION_FAILED`，DeviceManager 状态保持 `Disconnected` 或进入 `Fault` 后可恢复为 `Disconnected`。
- TCP 连接失败：Adapter 捕获 socket error，记录 communication log，返回统一应用错误。
- 请求超时：Adapter 取消或忽略过期请求，释放 timer，返回 `DEVICE_REQUEST_TIMEOUT`。
- 非法寄存器地址：Simulator 返回 Modbus exception；Adapter 映射为 `DEVICE_ILLEGAL_ADDRESS`。
- 非法写入：DeviceManager 先拒绝明显只读区域写入；Simulator 对越界或无效值返回 exception；Adapter 映射为 `DEVICE_WRITE_REJECTED`。
- Simulator 停止：下一次 read/write 或 socket close 事件更新状态为 `Fault` 或 `Disconnected`，Renderer 显示连接异常，不崩溃。
- Simulator 恢复：用户手工点击 Connect，DeviceManager 新建或重置 Adapter 连接。

日志至少记录：

- 连接尝试、成功、失败、断开。
- 每次手工 read/write 的区域、起始地址、数量、耗时和结果摘要。
- timeout、非法地址、非法写入、socket close 和异常映射。

日志不记录密码、token 或高频无意义轮询，因为本期没有自动轮询。

## Risks / Trade-offs

- [Risk] 自实现最小 Modbus TCP 子集可能覆盖面有限 -> Mitigation：仅支持本期手工验证需要的 function code，并通过 Adapter/Simulator 测试覆盖读写、异常、timeout 和 fault；未来接入真实设备前可在 Adapter 层替换为成熟第三方库。
- [Risk] Reference address 与 zero-based PDU address 混淆导致 off-by-one -> Mitigation：mapping 文档和 shared 常量同时记录两种地址，代码内部统一使用 PDU address。
- [Risk] 将手工寄存器读写暴露到 UI 可能让 View 过度理解协议 -> Mitigation：DeviceViewModel 暴露预定义点位和操作，View 只渲染标签、值和按钮。
- [Risk] Simulator 断开连接后恢复触发方式不清晰 -> Mitigation：默认通过独立 Simulator 控制台/CLI 触发，不通过 Modbus 寄存器触发。
- [Risk] 没有自动重连时用户可能认为恢复后应自动连接 -> Mitigation：UI 文案和验收场景明确要求手工重新连接，自动重连留给后续 change。
- [Risk] 本期不实现 Tag Quality，读到的数据还不是完整工业实时数据模型 -> Mitigation：仅用于协议链路验证；不得把本期读数当作后续 Dashboard 实时生产数据架构。

## Migration Plan

这是新增能力，不涉及用户数据迁移。实施顺序应为：

1. 增加 Simulator 和 mapping 文档/共享常量。
2. 增加 Main Process 协议抽象与 ModbusAdapter。
3. 增加 DeviceManager 与 IPC handler。
4. 扩展 Preload typed API 与 Renderer DeviceViewModel。
5. 增加 Device 页面手工验证 UI。
6. 增加测试、开发说明和验收脚本。

如果实施失败，可回滚本 change 的新增 Simulator、Adapter、DeviceManager 和 UI 验证入口，不影响 foundation 的 Electron 壳、导航和基础页面。

## Open Questions

无。默认决策已写入本设计；实施阶段如发现 Modbus TCP 实现或端口配置与本地环境冲突，应先更新本 change 的方案，再继续实现。
