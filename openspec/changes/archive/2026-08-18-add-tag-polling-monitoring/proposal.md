## Why

Industrial HMI 已经完成基础 Electron 架构、独立 PLC Simulator、Modbus TCP Adapter、DeviceManager 和手工读写验证，但实时监控仍依赖人工读取点位，尚未形成工业上位机所需的统一 Tag 模型、周期采集、实时缓存和 UI 推送链路。

本 change 需要在 Main Process 建立 Tag/Polling/Cache 核心链路，让 Simulator 的过程值能够通过 Modbus 批量采集并稳定显示到 Dashboard 和 Device Tag Monitor，同时保持 Renderer 不直接读取 Modbus。

## What Changes

- 新增统一 `TagDefinition`、`TagValue` 和 `TagQuality` 领域模型。
- 新增 `TagService`，集中管理恒温混料设备的默认 Tag 定义、Tag 查询、Modbus 原始数据 decode、scale/offset 转换和实时值更新入口。
- 新增 `TagCache`，缓存所有实时 `TagValue`，保证每个值始终包含 `quality` 和 `timestamp`。
- 新增 `PollingScheduler`，按 device、scanRate、Modbus register type 和 address continuity 生成 Scan Group，不允许每个 Tag 创建独立 `setInterval`。
- 支持默认 Scan Group 周期：`100ms`、`500ms`、`1000ms`；本期核心监控默认使用 `500ms`，慢变化和设定类 Tag 默认使用 `1000ms`，`100ms` 作为能力支持和测试覆盖，不默认分配核心 Dashboard Tag。
- 对连续 Modbus 寄存器执行批量读取，例如 `30001-30004` 或 `40001-40002` 应尽可能合并为一次协议读取。
- 打通数据链路：PLC Simulator -> ModbusAdapter -> PollingScheduler -> TagService -> TagCache -> IPC -> ViewModel -> React。
- 新增 Main 到 Renderer 的 Tag 订阅 typed IPC API，支持 batch、throttle 和 change detection，避免采集频率与 React render 频率强绑定。
- Dashboard 实时显示 Temperature、Level、Pressure、RPM、Running State、Mode 和 Production Count；`targetTemperature` 和 `manualMotorRpmSetpoint` 默认只进入 Device Tag Monitor。
- Device 页面新增 Tag Monitor，至少显示 Tag Name、Value、Unit、Quality、Timestamp。
- Simulator 停止或 Modbus 读取失败时，相关 TagValue 质量默认更新为 `Bad`；用户手工断开设备时，相关 TagValue 质量默认更新为 `Uncertain`；Renderer 不崩溃。
- IPC 推送默认按 `250ms` throttle 批量发送，timestamp heartbeat 默认 `2000ms`，通信采集频率与 UI render 频率保持解耦。
- 新增通信日志或调试日志，让开发者可以观察 Scan Group、批量读取范围、轮询成功和失败行为。
- 本期不实现自动重连、CommandService、Alarm、Historian、Recipe、Permission、Audit 或 OPC UA。

## Capabilities

### New Capabilities
- `tag-polling-monitoring`: 定义工业 Tag 领域模型、实时 TagCache、周期采集调度、Modbus 批量读取、Tag IPC 批量推送、Dashboard 实时监控和 Device Tag Monitor。

### Modified Capabilities
- 无。

## Impact

- 影响 `src/main/tag/`：新增 Tag 领域模型、默认 Tag 定义、TagService、TagCache 和采集结果处理。
- 影响 `src/main/protocol/`：复用现有 `IProtocolAdapter` / `ModbusAdapter` 批量读取能力，不把 Modbus 细节泄漏到业务层或 Renderer。
- 影响 `src/main/device/`：设备连接成功/断开后需要协调 PollingScheduler 启停，但本期不增加自动重连。
- 影响 `src/main/ipc/` 与 `src/preload/`：新增 typed Tag 订阅 API 和批量变更推送通道，不暴露 raw IPC。
- 影响 `src/shared/`：新增或扩展 Tag、Polling、订阅 payload 相关共享类型。
- 影响 `src/renderer/viewmodels/` 与 `src/renderer/pages/`：DashboardViewModel、DeviceViewModel、DashboardPage 和 DevicePage 显示实时 Tag 数据。
- 影响测试：新增 Tag decode、scale/offset、TagCache、Scan Group、批量读取、IPC batching、Renderer 边界和 Simulator 停止异常路径测试。
- 影响文档：更新 Tag Model、Polling/Scan Group、Dashboard 实时监控、Device Tag Monitor 和开发验证说明。
