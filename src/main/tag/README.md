# Tag Module

Main Process Tag 模块负责实时工业数据的统一模型、周期采集转换和缓存。

核心对象：

- `TagService`：管理 TagDefinition，执行 raw Modbus data decode、scale/offset 转换，产出 TagValue。
- `TagCache`：缓存所有实时 TagValue，保证每个值都有 `quality` 和 `timestamp`。
- `PollingScheduler`：按 device、scanRate、registerType、address continuity 构造 Scan Group，并通过 `IProtocolAdapter.read()` 批量读取。
- `TagAcquisitionCoordinator`：根据 adapter capability 为 Modbus 选择 polling，为 OPC UA 选择 subscription。
- `ScanGroup`：描述一次可安全 range read 的 Modbus 地址范围。

边界：

- 本模块只运行在 Main Process。
- Renderer 只能通过 typed `window.hmi.tags` API 获取 snapshot 和订阅批量更新。
- 本模块不直接实现 CommandService、Alarm、Historian 或 Recipe；设备状态机和自动重连由 `DeviceManager` 编排。

默认策略：

- 支持 `100ms`、`500ms`、`1000ms` scan rate。
- 核心 Dashboard Tag 默认 `500ms`。
- Production Count 和设定类 Tag 默认 `1000ms`。
- IPC batch throttle 默认 `250ms`。
- timestamp heartbeat 默认 `2000ms`。
- 手工 disconnect 标记 `Uncertain`，通信失败标记 `Bad`。
- 超过 `max(3 * scanRate, 3000ms)` 未成功采集的 `Good` Tag 标记为 `Bad`。

更多说明见 `docs/tag-polling-monitoring.md` 和 `docs/device-control-resilience.md`。
