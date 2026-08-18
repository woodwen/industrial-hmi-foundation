# M-8(feat): 新增 Tag 周期采集监控

OpenSpec Change: add-tag-polling-monitoring

背景:
- 前置能力已经完成 Electron HMI 基础架构、独立 PLC Simulator、Modbus TCP Adapter、DeviceManager 和 Device 页面手工读写验证。
- 当前缺口是实时监控仍依赖手工读取，缺少统一 Tag 模型、周期采集、TagCache、批量 IPC 推送和 Dashboard 实时展示链路。

方案概述:
- 在 Main Process 建立 `TagDefinition`、`TagValue`、`TagQuality`、`TagService`、`TagCache` 和 `PollingScheduler`。
- 通过 `deviceId + scanRate + registerType + address continuity` 构造 Scan Group，连续寄存器走 Modbus range read，避免每 Tag 一个 timer 或一次请求。
- 通过 typed `window.hmi.tags` API 让 Renderer 获取 snapshot 并订阅批量 TagValue 更新，默认 `250ms` throttle 和 `2000ms` heartbeat。
- Dashboard 显示 Temperature、Level、Pressure、RPM、Running State、Mode、Production Count，Device 页面新增 Tag Monitor。

实现改动:
- 新增 `src/shared/tag.ts`，从既有 `MODBUS_POINTS` 派生默认 Tag，并固定核心监控 `500ms`、慢变化/设定类 `1000ms`。
- 新增 `src/main/tag/` 下的 `TagService`、`TagCache`、`PollingScheduler` 和 Scan Group builder。
- 新增 `src/main/runtime.ts` 和 `src/main/ipc/tag-publisher.ts`，让 DeviceManager、ModbusAdapter、PollingScheduler、TagCache 和 IPC publisher 共享应用级实例。
- 扩展 `src/shared/hmi-api.ts`、`src/shared/ipc-channels.ts`、`src/preload/index.ts` 和 Renderer API client，提供 typed Tag snapshot/subscription API。
- 新增 `TagValuesViewModel`，改造 Dashboard 和 Device 页面展示实时 Tag 数据、质量和时间戳。
- 将高频 Modbus read 成功日志降为 debug，避免 polling 期间产生大量 INFO 日志。
- 更新内置帮助、Tag/Polling 文档和 OpenSpec archive/spec。

测试计划(UT):
- `openspec validate add-tag-polling-monitoring --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

影响范围(建议手动测试范围):
- 启动 `npm run simulator:start` 和 Electron HMI，Device 页面点击 Connect 后确认 Dashboard 七项实时值更新。
- 确认 Device Tag Monitor 显示 Tag Name、Value、Unit、Quality、Timestamp。
- 停止 Simulator 后确认 Renderer 不崩溃，相关 Tag quality 降级为 `Bad`。
- 手工 Disconnect 后确认相关 Tag quality 降级为 `Uncertain`。

风险与后续:
- 本期不实现自动重连、CommandService、Alarm、Historian、Recipe、Permission、Audit 或 OPC UA。
- `100ms` scan rate 作为能力支持和测试覆盖，默认核心 Dashboard Tag 仍使用 `500ms`。
