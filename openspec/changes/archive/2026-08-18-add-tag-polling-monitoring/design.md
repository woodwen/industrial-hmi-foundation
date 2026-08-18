## Context

`industrial-hmi-foundation` 当前已经具备 Electron Main / Preload / Renderer 分层、MobX MVVM、统一错误模型、日志、独立 PLC Simulator、Modbus TCP Adapter、DeviceManager 和 Device 页面手工读写验证能力。前置 change `add-modbus-plc-simulator` 已定义混料设备的 Modbus Address Mapping，并实现了 `IProtocolAdapter.read()` 的 range read 能力。

当前缺口是实时监控链路仍未建立：Device 页面可以人工读取点位，但系统没有统一 Tag Domain Model、周期采集调度、实时值缓存、质量状态传播或批量 IPC 推送。Dashboard 也仍是结构性占位，不能持续显示 Simulator 的实时变化。

本 change 在既有边界上增加 Tag/Polling/Monitoring 能力，目标数据流保持：

```text
PLC Simulator
  ↓ Modbus TCP
ModbusAdapter
  ↓ ProtocolReadResult
PollingScheduler
  ↓ Raw Modbus Data
TagService
  ↓ Decode / scale / offset
TagCache
  ↓ batched IPC
ViewModel
  ↓ MobX computed state
React View
```

Renderer 不创建 TCP、Modbus client、SQLite 连接，也不主动轮询 Modbus。Renderer 只通过 typed `window.hmi.tags` API 获取 snapshot 和订阅批量 Tag 更新。

## Goals / Non-Goals

**Goals:**

- 定义 `TagDefinition`、`TagValue`、`TagQuality`。
- 实现 `TagService` 统一管理默认 Tag 定义、Tag 查询、decode、scale/offset 和 TagCache 更新。
- 实现 `TagCache`，保存全部实时 TagValue，并保留质量和时间戳。
- 实现 `PollingScheduler`，按 device、scanRate、Modbus register type 和 address continuity 创建 Scan Group。
- 支持标准 scan rate：`100ms`、`500ms`、`1000ms`。
- 连续寄存器或连续 bit 点位尽可能批量读取，避免逐 Tag 读取。
- 禁止每个 Tag 一个 `setInterval`；默认最多按 device + scanRate 建立 scheduler timer。
- 在采集失败、Simulator 停止或解码失败时更新 Tag quality，保证 Renderer 不崩溃。
- 使用 IPC batch、throttle 和 change detection，避免 PLC 采集频率与 React render 频率强绑定。
- Dashboard 实时显示 Temperature、Level、Pressure、RPM、Running State、Mode、Production Count。
- Device 页面提供 Tag Monitor，显示 Tag Name、Value、Unit、Quality、Timestamp。
- 通过日志观察 scan group、批量读取范围、成功/失败摘要。

**Non-Goals:**

- 不实现自动重连。连接失败后可以标记 Tag quality，但恢复连接仍由用户手工 Connect。
- 不实现 CommandService。已有 Device 手工写入能力可以保留，但 TagService 不承担控制命令。
- 不实现 Alarm、Historian、Recipe、Permission、Audit。
- 不实现 OPC UA polling/subscription。
- 不实现趋势 ring buffer 或历史查询。
- 不新增第三方状态管理、IPC 或协议依赖，除非实施时发现现有能力无法满足且另行说明。

## Decisions

### 0. 已确认默认决策

本 change 按以下默认值实施，不再作为开放问题处理：

- `100ms` scan rate 作为能力支持和测试覆盖，本期不默认分配核心 Dashboard Tag。
- Temperature、Level、Pressure、RPM、Running State、Mode 默认使用 `500ms` scan rate。
- Production Count、Target Temperature、Manual RPM Setpoint 默认使用 `1000ms` scan rate。
- Dashboard 默认只显示验收要求的七项：Temperature、Level、Pressure、RPM、Running State、Mode、Production Count。
- `targetTemperature` 和 `manualMotorRpmSetpoint` 默认只在 Device Tag Monitor 显示，不进入 Dashboard 主监控项。
- Scan Group 只合并连续或重叠地址，默认 `maxGap=0`。
- Polling timer 按 `deviceId + scanRate` 建立；同一设备 Scan Group 默认串行读取。
- Tag IPC 默认 `250ms` throttle 批量 flush。
- Tag timestamp heartbeat 默认 `2000ms`。
- Simulator 停止、Modbus 读取失败或通信中断默认把相关 Tags 标记为 `Bad` 并暂停 polling，不自动重连。
- 用户手工 disconnect 默认把相关 Tags 标记为 `Uncertain`。
- Main Process 使用应用级单例 runtime 统一持有 DeviceManager、TagService、TagCache、PollingScheduler 和 IPC publisher。

### 1. Tag Domain Model

新增 `TagDefinition` 作为工业数据点的统一模型。建议放在 `src/shared/tag.ts` 或等价共享类型文件，Main 和 Renderer 使用同一只读类型，具体协议读取仍只在 Main 执行。

基础字段：

```text
TagDefinition
  id: string
  name: string
  deviceId: string
  address: number
  registerType: ModbusRegisterArea
  dataType: 'boolean' | 'int16' | 'uint16' | 'uint32'
  scale: number
  offset: number
  unit: string
  writable: boolean
  scanRate: 100 | 500 | 1000
```

允许在基础字段外增加 `referenceAddress`、`quantity`、`description`、`displayOrder`、`dashboardRole`、`sourcePointId` 等实现字段。`address` 在代码内部表示 Modbus PDU zero-based address；`referenceAddress` 只用于文档或调试展示。

`TagValue` 至少包含：

```text
TagValue
  tagId: string
  value: boolean | number | string | null
  quality: 'Good' | 'Bad' | 'Uncertain'
  timestamp: string
```

`value` 允许为 `null`，用于尚未采集到首个有效值的 `Uncertain` 初始状态。读取失败后可以保留 last value，但必须更新 `quality` 和 `timestamp`，UI 必须能看出该值不是正常实时数据。

Tag 与现有 `MODBUS_POINTS` 的关系：

- 本期默认 TagDefinition 可以由现有 `MODBUS_POINTS` 派生，避免维护两套地址映射。
- TagService 负责把 `ModbusPointDefinition` 转成 `TagDefinition`，并补充 `scanRate`、`offset`、展示名称和 Dashboard 角色。
- `scale/offset` 转换采用 `engineeringValue = rawValue * scale + offset`。现有点位 offset 默认为 `0`。
- `uint32` Production Count 使用现有高字在前、低字在后的解码规则。

默认监控 Tag：

| Tag | Source | Default scanRate | Dashboard |
| --- | --- | ---: | --- |
| `currentTemperature` | `30001` | `500ms` | Temperature |
| `currentLevel` | `30002` | `500ms` | Level |
| `currentPressure` | `30003` | `500ms` | Pressure |
| `motorRpm` | `30004` | `500ms` | RPM |
| `productionCount` | `30005-30006` | `1000ms` | Production Count |
| `deviceRunningStatus` | `10001` | `500ms` | Running State |
| `autoModeStatus` | `10005` | `500ms` | Mode |
| `targetTemperature` | `40001` | `1000ms` | Device Tag Monitor only |
| `manualMotorRpmSetpoint` | `40002` | `1000ms` | Device Tag Monitor only |

标准 `100ms` scan rate 作为能力支持，适合后续快速点位或测试覆盖；当前默认设备过程模型 tick 为 `250ms`，核心 Dashboard 点位默认 `500ms` 更符合模拟设备变化速度，也降低通信和 UI 压力。

备选方案是继续沿用 `DevicePointValue` 作为实时模型。该方案能少写类型，但缺少 `quality`、`scanRate`、统一 Tag id 和 TagCache 语义，后续 Alarm、Historian、Trend 都会被迫重新定义实时数据模型，因此不采用。

### 2. TagService

`TagService` 位于 Main Process `src/main/tag/`，职责是 Tag 管理和数据转换，不负责 TCP 连接或 IPC 发送。

职责：

- 提供 `listTagDefinitions()`、`getTagDefinition(tagId)`、`getTagsByDevice(deviceId)`。
- 提供默认混料设备 Tag 列表。
- 为 PollingScheduler 提供可采集 TagDefinitions。
- 接收一个 Scan Group 的 raw read result，按 TagDefinition 切片、decode、scale/offset 转换为 TagValue。
- 将转换后的 TagValue 批量写入 TagCache。
- 在读取失败、解码失败、通信中断时生成 `Bad` TagValue；在用户手工断开设备时生成 `Uncertain` TagValue。

TagService 不直接创建 `setInterval`，不直接访问 `ipcMain` / `BrowserWindow`，不执行写设备命令。

### 3. TagCache

`TagCache` 是 Main Process 内的实时值缓存，保存全部 Tag 的最新 `TagValue`。

核心行为：

- 初始化时为每个 Tag 建立 `Uncertain` 值，`value` 为 `null`，`timestamp` 为初始化时间。
- `setValues(values)` 批量更新 cache。
- 每个 TagValue 必须始终包含 `tagId`、`value`、`quality`、`timestamp`。
- 更新值时记录 semantic change：`value` 或 `quality` 变化视为需要推送；仅 timestamp 变化不必每次推送到 Renderer。
- 提供 `getSnapshot()` 返回 Tag definitions 和 current values，用于 Renderer 初次进入页面或重新订阅。
- 提供订阅机制供 Main 内的 IPC publisher 监听变更，并在应用退出时释放 listener。

TagCache 是 TagService、Dashboard、Device Tag Monitor 共享实时数据源。Alarm、Historian、Trend 仍为后续 Non-Goals，不在本期订阅 TagCache。

备选方案是 PollingScheduler 每次读取后直接推 IPC。该方案链路短，但会让采集、缓存、订阅和 UI 刷新耦合，无法为后续 Alarm/Historian 复用，也容易造成高频 IPC，因此不采用。

### 4. Scan Group

`PollingScheduler` 根据 TagDefinition 构造 Scan Group。一个 Scan Group 表示同一设备、同一 scanRate、同一 registerType 下可由一次协议读取覆盖的一段连续地址范围。

分组步骤：

1. 过滤启用轮询的 Tag。
2. 按 `deviceId + scanRate + registerType` 分桶。
3. 每个桶内按 `address` 升序排序。
4. 根据 `address` 和 `quantity` 合并连续或重叠范围。
5. 生成 `ScanGroup`：

```text
ScanGroup
  id
  deviceId
  scanRate
  registerType
  startAddress
  quantity
  tags
```

合并规则：

- 当前范围的 `endExclusive = startAddress + quantity`。
- 下一个 Tag 的 `address <= endExclusive` 时合并。
- 对于当前默认输入寄存器，`30001-30006` 可合并为一次 `inputRegister address=0 quantity=6` 读取，覆盖温度、液位、压力、RPM、Production Count。
- 对于 holding registers，`40001-40002` 可合并为一次 `holdingRegister address=0 quantity=2` 读取。
- 对于 discrete inputs，`10001-10005` 可合并为一次 `discreteInput address=0 quantity=5` 读取。

如果未来一个桶内存在大间隔地址，Scheduler 应拆成多个 Scan Group，避免一次读过大范围未定义地址导致协议错误。可设置保守 `maxGap=0` 作为本期默认，只合并严格连续/重叠范围。

### 5. PollingScheduler

`PollingScheduler` 在 Main Process 中运行，依赖 `IProtocolAdapter`、`TagService`、`TagCache` 和 Logger。它不依赖 Renderer。

核心规则：

- 不允许每个 Tag 一个 `setInterval`。
- 默认最多按 `deviceId + scanRate` 建立 timer；timer tick 内执行该周期下的所有 Scan Group。
- 每个 timer 保持 non-reentrant：上一轮未完成时跳过下一次 tick，并记录 throttled debug/warn 日志。
- 同一设备上的 Scan Group 默认串行执行，避免对单个 Modbus TCP 连接产生不受控并发。
- `start(deviceId)` 在设备连接成功后启动或恢复该设备轮询。
- `stop(deviceId)` 在设备断开、应用退出或测试 cleanup 时清理 interval、timeout 和 listener。
- 请求失败时，记录包含失败 Scan Group 的 communication log；由于本期策略会暂停该设备轮询，为避免同设备其他 Tag 保留旧 `Good`，将该设备 Tags 统一标记为 `Bad`。
- 如果 adapter 状态不再是 `Connected`，Scheduler 暂停该设备轮询并把相关 Tag 标记为 `Bad` 或 `Uncertain`，等待用户手工 connect 后重新 start；不执行自动重连。

日志建议：

- startup：scanRate、group count、每个 group 的 area/address/quantity/tagIds。
- success：debug 级摘要，避免每个 Tag 大量 info。
- failure：warn/error 级，包含 deviceId、scanGroupId、area、address、quantity、error code。
- skip：上一轮未完成时以限频方式记录。

备选方案是每个 Scan Group 一个 timer。该方案仍不是每 Tag timer，但当 group 数量增加时 timer 数会膨胀，不利于统一 pause、skip 和日志控制。本期采用每 `deviceId + scanRate` 一个 timer，更容易证明不存在逐 Tag timer。

### 6. Register batching and decode

PollingScheduler 只读取 raw range，不解释业务值。TagService 根据 Scan Group 的 TagDefinition 做 decode：

```text
rawSliceStart = tag.address - scanGroup.startAddress
rawSliceEnd = rawSliceStart + tag.quantity
rawValues = groupResult.values.slice(rawSliceStart, rawSliceEnd)
decoded = decodeByDataType(rawValues, tag.dataType)
engineeringValue = decoded * tag.scale + tag.offset
```

Boolean Tag 不应用 numeric scale/offset。`int16` 需要按 signed 16-bit 转换；`uint32` 使用高字在前。任何 raw 长度不匹配、类型不匹配或 decode 异常都不能向 Renderer 抛出底层异常，而是转换为该 Tag 的 `Bad` quality，并记录 error log。

部分失败策略：

- 一次 range read 失败：记录失败 Scan Group，并将该设备所有 Tag 标记 `Bad`，因为该设备轮询会暂停，未轮到的 Tag 也不能继续显示旧 `Good`。
- range read 成功但某个 Tag decode 失败：该 Tag 标记 `Bad`，其他 Tag 正常更新为 `Good`。
- Simulator 停止、Modbus 读取失败或通信中断：该设备 Tags 标记 `Bad`，并暂停该设备轮询 timer。
- 用户手工断开设备：相关 Tag 标记 `Uncertain`，并停止该设备轮询 timer。

### 7. IPC batching

新增 typed API，建议形态：

```text
window.hmi.tags.getSnapshot(): Promise<HmiResult<TagSnapshot>>
window.hmi.tags.subscribeValues(listener): Unsubscribe
```

`TagSnapshot` 包含 Tag definitions 和 current values。`TagValuesChangedEvent` 包含：

```text
TagValuesChangedEvent
  deviceId
  values: TagValue[]
  emittedAt
```

Main Process 增加 Tag IPC publisher：

- 订阅 TagCache semantic changes。
- 在 Main 内积累 pending changed values。
- 以 throttle interval 批量 flush，默认 `250ms`。
- 单次 IPC event 包含多个 TagValue。
- 首次订阅后 Renderer 应主动调用 `getSnapshot()`，避免等下一次变化。
- 仅当 `value` 或 `quality` 变化时进入普通 pending queue；为了让 UI timestamp 不长期停滞，默认每 `2000ms` 对已订阅 Renderer 推送一次 snapshot 或包含当前 values 的 heartbeat event。
- Renderer unsubscribe 时移除 `ipcRenderer` listener，并通知 Main 取消该 webContents 订阅；窗口销毁时 Main 清理 subscriber。

这样即使未来存在 `1000` 个 Tag 和 `100ms` 采集，也不会形成 `1000 × 10/s` 的 IPC 和 React render。默认最多约 `4/s` 批量事件，采集频率与 UI 刷新频率解耦。

备选方案是每次 TagCache 更新立即 `webContents.send()`。该方案实现简单，但会把 PLC sampling rate 直接传给 Renderer，违反本期核心约束，因此不采用。

### 8. React/MobX 更新机制

Renderer 新增共享实时 Tag ViewModel，建议由 `RootViewModel` 持有，例如 `TagValuesViewModel` 或 `RealtimeTagViewModel`。

职责：

- 通过 `HmiApiBrowserClient` 调用 `getTagSnapshot()`。
- 通过 `subscribeTagValues()` 接收批量事件。
- 使用 `observable.map` 存储 `TagValue`。
- 使用 MobX action 一次性应用整批 values，避免每个 Tag 单独触发 render。
- 提供 `getValue(tagId)`、`getQuality(tagId)`、`dashboardMetrics`、`tagMonitorRows` 等 computed。
- 在 dispose 时调用 unsubscribe，防止 `ipcRenderer` listener 泄漏。

DashboardViewModel 不直接调用 Modbus，也不启动轮询；它只从共享 Tag ViewModel 派生 Temperature、Level、Pressure、RPM、Running State、Mode 和 Production Count。DeviceViewModel 的 Tag Monitor 同样只消费共享 Tag ViewModel。React Views 只读取 ViewModel 的展示字段，不理解 Modbus function code、PDU address 或 scan group。

### 9. Communication frequency and UI refresh decoupling

本期明确区分两个频率：

- PLC Sampling Rate：由 TagDefinition.scanRate 和 PollingScheduler 决定，例如 `500ms` 读取过程值。
- UI Refresh Rate：由 Tag IPC publisher throttle 和 MobX batch 决定，默认 `250ms` 最快一批，并通过 `2000ms` heartbeat 刷新时间信息。

如果 PLC sampling 比 UI flush 更快，TagCache 仍保存最新值，IPC 只发送最新 pending 值。如果多个采集周期内值没有语义变化，只更新时间戳而不立即推送，可通过 heartbeat 保持 UI 时间信息更新。

### 10. Lifecycle integration

Main Process 需要创建一个应用级 runtime，持有共享 `DeviceManager`、`TagService`、`TagCache`、`PollingScheduler` 和 Tag IPC publisher，而不是在每个 IPC handler 调用时创建新实例。

建议：

- `createMainRuntime(logger)` 创建所有 Main 服务。
- `registerIpcHandlers(logger, runtime)` 使用同一 DeviceManager 和 Tag 服务。
- `DeviceManager.connectDevice()` 成功后调用 `PollingScheduler.start(deviceId)`。
- `DeviceManager.disconnectDevice()` 成功后调用 `PollingScheduler.stop(deviceId)` 并将该设备 Tags 标记为 `Uncertain`。
- Polling 或 Modbus 通信失败时将 affected Tags 标记为 `Bad`，暂停该设备 scheduler，等待用户手工 connect 后恢复。
- `app.before-quit` 或测试 teardown 调用 runtime dispose。

这会改变当前 `registerIpcHandlers()` 默认直接创建 DeviceManager 的模式，但属于最小必要架构调整：只有应用级单例 runtime 才能让连接状态、轮询状态、TagCache 和 IPC publisher 共享同一数据源。

## Risks / Trade-offs

- [Risk] `100ms` scan rate 与 Modbus request timeout 叠加可能导致重入或积压。→ Mitigation：timer non-reentrant，同设备串行读取，上一轮未完成则跳过并限频记录日志。
- [Risk] 仅靠 semantic change 可能让 UI timestamp 更新不够频繁。→ Mitigation：TagCache 保存真实最新 timestamp，IPC publisher 增加低频 heartbeat 或 snapshot 刷新。
- [Risk] 批量读取连续范围时包含未定义地址会引发 Modbus illegal address。→ Mitigation：本期 `maxGap=0`，只合并连续/重叠 Tag 范围，不跨空洞读取。
- [Risk] Simulator 停止后持续轮询可能刷屏。→ Mitigation：首次连接丢失后标记 Tags 为 Bad，暂停该设备 scheduler，等待手工 connect。
- [Risk] Renderer ViewModel 如果逐条应用 batch 仍可能产生多次响应。→ Mitigation：用 MobX action 包裹整批更新，并在 computed 层生成展示数据。
- [Risk] 默认 TagDefinition 派生自现有 Modbus mapping，后续修改 mapping 可能影响 Tag。→ Mitigation：为默认 Tag 列表和关键 dashboard tag id 增加测试，锁定 address、dataType、scanRate 和 decode。

## Migration Plan

1. 新增共享 Tag 类型和默认 Tag 定义，不影响现有手工 Device API。
2. 新增 TagService、TagCache、PollingScheduler，并用单元测试验证 scan group 和 decode。
3. 引入 Main runtime，复用现有 DeviceManager 与 ModbusAdapter，并在 connect/disconnect 时启停 scheduler。
4. 新增 typed Tag IPC snapshot/subscribe API。
5. 新增 Renderer Tag ViewModel，并改造 Dashboard 和 Device Tag Monitor 展示实时数据。
6. 保留前置 change 的手工读写验证入口，作为调试补充。
7. 运行 OpenSpec、typecheck、lint、test、build 和 `git diff --check`。

Rollback 策略：如果实时轮询链路出现问题，可停止启动 PollingScheduler 并保留现有 Device 手工读写路径；OpenSpec 本期不要求删除前置手工验证能力。

## Open Questions

无。默认 scan rate、Dashboard 范围、IPC throttle、timestamp heartbeat、quality 降级策略和 Main runtime 方式均已确认。
