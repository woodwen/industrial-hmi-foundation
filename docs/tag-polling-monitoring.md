# Tag Polling Monitoring

本文档记录 `add-tag-polling-monitoring` change 引入的 Tag 模型、周期采集、批量读取、TagCache 和 Renderer 批量更新策略。

## Scope

本期实现实时监控链路：

```text
PLC Simulator
  ↓ Modbus TCP
ModbusAdapter
  ↓ PollingScheduler
TagService
  ↓ Decode / scale / offset
TagCache
  ↓ typed IPC batch
Renderer Tag ViewModel
  ↓ MobX computed state
Dashboard / Device Tag Monitor
```

Renderer 不直接读取 Modbus，不创建 TCP Socket，也不访问 Main Process TagService、PollingScheduler 或 TagCache。

Tag 轮询本身不直接执行设备控制；设备状态机、自动重连、CommandService 和写入验证已在 `add-device-control-resilience` change 中实现，见 `docs/device-control-resilience.md`。Alarm、Historian、Recipe、Permission、Audit 和 OPC UA 仍留到后续 change。

## Tag Domain Model

`TagDefinition` 是实时工业数据点的统一定义，至少包含：

| 字段 | 说明 |
| --- | --- |
| `id` | Tag 唯一标识 |
| `name` | 展示名称 |
| `deviceId` | 所属设备 |
| `address` | Modbus PDU zero-based address |
| `registerType` | `coil` / `discreteInput` / `holdingRegister` / `inputRegister` |
| `dataType` | `boolean` / `int16` / `uint16` / `uint32` |
| `scale` | 工程量比例 |
| `offset` | 工程量偏移 |
| `unit` | 单位 |
| `writable` | 是否可写 |
| `scanRate` | 采集周期，支持 `100ms`、`500ms`、`1000ms` |

`TagValue` 始终包含：

| 字段 | 说明 |
| --- | --- |
| `tagId` | 对应 Tag id |
| `value` | 工程值；尚无有效值时为 `null` |
| `quality` | `Good` / `Bad` / `Uncertain` |
| `timestamp` | 当前 value/quality 的更新时间 |

不得用只有 `tagId + value` 的结构表示实时工业数据。

## Default Tags

默认 Tag 从现有 `MODBUS_POINTS` 派生，避免维护两套地址映射。代码内部使用 PDU zero-based address，文档和 UI 可展示 reference address。

| Tag | Reference | PDU Address | Type | Scan Rate | Dashboard |
| --- | --- | ---: | --- | ---: | --- |
| `currentTemperature` | `30001` | `0` | Int16 | `500ms` | Temperature |
| `currentLevel` | `30002` | `1` | UInt16 | `500ms` | Level |
| `currentPressure` | `30003` | `2` | UInt16 | `500ms` | Pressure |
| `motorRpm` | `30004` | `3` | UInt16 | `500ms` | RPM |
| `productionCount` | `30005-30006` | `4` | UInt32 | `1000ms` | Production Count |
| `deviceRunningStatus` | `10001` | `0` | Boolean | `500ms` | Running State |
| `mixerMotorRunningStatus` | `10002` | `1` | Boolean | `500ms` | Device Tag Monitor |
| `autoModeStatus` | `10005` | `4` | Boolean | `500ms` | Mode |
| `targetTemperature` | `40001` | `0` | Int16 | `1000ms` | Device Tag Monitor |
| `manualMotorRpmSetpoint` | `40002` | `1` | UInt16 | `1000ms` | Device Tag Monitor |

`100ms` 是支持的 scan rate，用于后续快速点位和测试覆盖；当前核心 Dashboard Tag 不默认使用 `100ms`。

## Scan Group

`PollingScheduler` 根据 TagDefinition 构造 Scan Group。分组维度：

1. `deviceId`
2. `scanRate`
3. `registerType`
4. address continuity

本期默认 `maxGap = 0`，只合并连续或重叠地址，不跨空洞读取，避免读到未定义 Modbus 地址。

示例：

- `30001-30004` 在同一 device、scan rate、register type 下合并为一次 Input Register range read。
- `40001-40002` 合并为一次 Holding Register range read。
- 如果未来 `10001-10005` 都被配置成同一 scan rate，则合并为一次 Discrete Input range read。

禁止每个 Tag 一个 `setInterval`。默认按 `deviceId + scanRate` 建 timer，同一设备的 scan group 串行读取；上一轮未完成时跳过重入 tick 并记录限频日志。

## Decode And Quality

数据转换流程：

```text
Raw Modbus Data
  ↓
slice by Tag address and quantity
  ↓
decode by dataType
  ↓
value * scale + offset
  ↓
TagValue
  ↓
TagCache
```

质量规则：

- 读取和解码成功：`Good`
- Simulator 停止、Modbus 读取失败、通信中断：该设备 Tags 标记为 `Bad`
- 用户手工 disconnect：`Uncertain`
- 首次成功采集前：`Uncertain`
- 超过 `max(3 * scanRate, 3000ms)` 未成功采集：仍保留 last value，但 Quality 变为 `Bad`
- reconnect 成功但首次新采样前：保持 `Bad`
- reconnect 后首次成功采集并 decode：对应 Tags 恢复 `Good`

读取失败后可以保留 last value，但必须更新 quality 和 timestamp，UI 不能把旧值当作正常实时值展示。
本期轮询读取失败后会暂停该设备 polling，因此同设备内未轮到的 Tag 也会降级为 `Bad`，避免继续显示旧 `Good`。

## TagCache

`TagCache` 位于 Main Process，保存所有 Tag 的最新值。

行为：

- 初始化所有 Tag 为 `Uncertain`
- 支持 batch `setValues`
- snapshot 返回 definitions 和 current values
- semantic change detection 默认比较 `value` 和 `quality`
- timestamp-only 更新不走普通高频推送

后续 Alarm、Historian、Trend 应复用 TagCache，而不是重复读取 PLC。

## IPC Batching

Renderer 使用 typed Preload API：

```text
window.hmi.tags.getSnapshot()
window.hmi.tags.subscribeValues(listener)
```

默认策略：

- `250ms` throttle 批量推送 changed TagValue
- 单次 IPC event 包含多个 TagValue
- 默认不逐 Tag 发送 IPC event
- `2000ms` heartbeat / snapshot refresh 防止 timestamp 长期不更新
- unsubscribe 时移除 Renderer listener，并通知 Main 清理 subscriber

PLC Sampling Rate 与 UI Refresh Rate 解耦。即使采集频率提升，React 也不应被每次 PLC read 直接驱动 render。

## Renderer

Renderer 中共享 `TagValuesViewModel`：

- 初始化时读取 snapshot
- 订阅 batch event
- 用 MobX observable map 保存 TagValue
- 在一个 action 内应用整批更新
- Dashboard 从 computed 派生 7 个主监控项
- Device Tag Monitor 从同一 Tag pipeline 派生表格行

Dashboard 主监控项：

- Temperature
- Level
- Pressure
- RPM
- Running State
- Mode
- Production Count

Device Tag Monitor 至少展示：

- Tag Name
- Value
- Unit
- Quality
- Timestamp

## Manual Verification

1. 运行 `yarn simulator:start`。
2. 运行 Electron HMI。
3. 打开 Device 页面，点击 `Connect`。
4. Dashboard 应开始显示 Temperature、Level、Pressure、RPM、Running State、Mode、Production Count。
5. Device 页面 Tag Monitor 应显示所有默认监控 Tag 的 Value、Unit、Quality、Timestamp。
6. 在 Simulator 中改变过程状态或通过现有手工 Coil/寄存器写入触发变化，Dashboard 和 Tag Monitor 应随批量推送更新。
7. 停止 Simulator，Renderer 不应崩溃，相关 Tags quality 应降级为 `Bad`。
8. 手工点击 Disconnect，相关 Tags quality 应变为 `Uncertain`。
9. 恢复 Simulator 后，HMI 自动重连；只有成功重新采集的 Tags 才恢复为 `Good`。

## Logs

通信日志可观察：

- polling scan rate 启动
- scan group 配置
- range read 成功摘要
- overlapping tick skip
- polling failure

高频 polling 不应输出每个 Tag 的大量 INFO 日志。
