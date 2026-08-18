## 1. Scope and Architecture Setup

- [x] 1.1 阅读本 change 的 `proposal.md`、`design.md`、`specs/tag-polling-monitoring/spec.md`，确认本期只实现 Tag/Polling/Monitoring。
- [x] 1.2 复查前置 `industrial-hmi-foundation` 与 `modbus-plc-simulator` specs，确认不修改前置 capability 契约。
- [x] 1.3 复查现有 `DeviceManager`、`IProtocolAdapter`、`ModbusAdapter`、IPC、Preload、Renderer MVVM 边界。
- [x] 1.4 确认本期不实现自动重连、CommandService、Alarm、Historian、Recipe、Permission、Audit、OPC UA。
- [x] 1.5 设计 Main runtime 组装方式，保证 DeviceManager、TagService、TagCache、PollingScheduler、IPC publisher 共享同一应用级实例。

## 2. Shared Tag Types and Defaults

- [x] 2.1 新增共享 `TagDefinition`、`TagValue`、`TagQuality`、`TagSnapshot`、`TagValuesChangedEvent` 类型。
- [x] 2.2 定义 `TagQuality` 的 `Good`、`Bad`、`Uncertain` 显式状态。
- [x] 2.3 定义支持的 scan rate 类型，至少包含 `100`、`500`、`1000` ms。
- [x] 2.4 从现有 `MODBUS_POINTS` 派生默认混料设备 TagDefinition，避免重复维护地址映射。
- [x] 2.5 为默认 Tags 补充 `offset`、`scanRate`、`writable`、`quantity`、`displayOrder` 和 Dashboard 角色元数据，固定核心监控 `500ms`、慢变化/设定类 `1000ms`。
- [x] 2.6 确保默认 Tags 覆盖 Temperature、Level、Pressure、RPM、Running State、Mode、Production Count，并将 Target Temperature、Manual RPM Setpoint 默认归入 Device Tag Monitor。
- [x] 2.7 保留 Modbus PDU zero-based `address` 作为内部地址，必要时提供只读 `referenceAddress` 供调试展示。

## 3. TagService

- [x] 3.1 在 `src/main/tag/` 实现 `TagService`，集中提供 TagDefinition 查询能力。
- [x] 3.2 实现按 device 查询可轮询 Tags 的方法。
- [x] 3.3 实现 raw Modbus values 到 TagValue 的 decode 流程。
- [x] 3.4 实现 `int16`、`uint16`、`uint32`、`boolean` 数据类型 decode。
- [x] 3.5 实现 `engineeringValue = rawValue * scale + offset` 转换，boolean 不应用数值 scale/offset。
- [x] 3.6 实现 Production Count UInt32 高字在前、低字在后的 Tag decode。
- [x] 3.7 解码成功时生成 `Good` quality 和当前 timestamp。
- [x] 3.8 解码失败时生成或保留 `Bad` quality TagValue，并记录错误日志。
- [x] 3.9 确保 TagService 不创建 timer、不访问 Renderer、不直接发送 IPC。

## 4. TagCache

- [x] 4.1 实现 `TagCache`，以 Tag id 为 key 保存所有最新 TagValue。
- [x] 4.2 初始化所有 configured Tags 为 `Uncertain`，并包含 timestamp。
- [x] 4.3 实现 `setValues` 批量写入接口。
- [x] 4.4 实现 `getSnapshot`，返回 Tag definitions 和当前 TagValues。
- [x] 4.5 实现 semantic change detection，至少比较 `value` 和 `quality`。
- [x] 4.6 实现 Main 内订阅机制，支持批量变更通知。
- [x] 4.7 实现 cleanup/dispose，释放订阅 listener。
- [x] 4.8 读取失败后保留 last value 时，必须更新 `quality` 和 `timestamp`。

## 5. Scan Group and Register Batching

- [x] 5.1 定义 `ScanGroup` 类型，包含 deviceId、scanRate、registerType、startAddress、quantity、tags。
- [x] 5.2 实现 Scan Group builder，按 deviceId、scanRate、registerType 分桶。
- [x] 5.3 在每个桶内按 address 排序，并按连续或重叠地址合并。
- [x] 5.4 对存在地址空洞的 Tags 拆分 Scan Group，默认不跨空洞读取。
- [x] 5.5 验证 `30001-30006` 输入寄存器可合并为一次 range read。
- [x] 5.6 验证 `40001-40002` 保持寄存器可合并为一次 range read。
- [x] 5.7 验证 `10001-10005` 离散输入可合并为一次 range read。
- [x] 5.8 确保不同 device、scanRate、registerType 的 Tags 不会被合并。

## 6. PollingScheduler

- [x] 6.1 实现 `PollingScheduler`，依赖 `IProtocolAdapter`、TagService、TagCache、Logger。
- [x] 6.2 按 deviceId + scanRate 建立 bounded timer，禁止每 Tag 一个 `setInterval`。
- [x] 6.3 实现 `start(deviceId)`，设备连接成功后启动该设备轮询。
- [x] 6.4 实现 `stop(deviceId)`，设备断开或 runtime dispose 时停止该设备轮询并释放 timer。
- [x] 6.5 实现 timer non-reentrant 保护，上一轮未完成时跳过或延后下一轮。
- [x] 6.6 同一设备 Scan Group 默认串行执行，避免单连接不受控并发。
- [x] 6.7 使用 `IProtocolAdapter.read()` 对每个 Scan Group 执行 range read。
- [x] 6.8 将读取结果交给 TagService 转换，再批量写入 TagCache。
- [x] 6.9 Simulator 停止、Modbus 读取失败或通信中断时将 affected Tags 标记为 `Bad`。
- [x] 6.10 Adapter 状态不为 `Connected` 时暂停该设备轮询，不执行自动重连。
- [x] 6.11 添加 communication/debug 日志，输出 scan group 构建、range read、skip、failure 摘要。
- [x] 6.12 对重复 polling failure 日志做限频，避免 Simulator 停止后刷屏。

## 7. Main Runtime and Device Lifecycle

- [x] 7.1 新增 Main runtime factory，集中创建 Logger、DeviceManager、TagService、TagCache、PollingScheduler、Tag IPC publisher。
- [x] 7.2 调整 IPC handler 注册方式，避免每类 handler 隐式创建独立 DeviceManager。
- [x] 7.3 Device connect 成功后启动对应 device 的 PollingScheduler。
- [x] 7.4 Device disconnect 成功后停止对应 device 的 PollingScheduler。
- [x] 7.5 用户手工 disconnect 后将相关 Tags 标记为 `Uncertain`，communication loss 后将相关 Tags 标记为 `Bad`。
- [x] 7.6 应用退出或测试 teardown 时 dispose runtime，释放 timers、listeners 和 IPC subscriptions。
- [x] 7.7 保留前置手工 Device read/write 验证能力，不把它改成 Renderer 轮询。

## 8. Typed Tag IPC and Preload API

- [x] 8.1 在 `IPC_CHANNELS` 中新增 Tag snapshot、subscribe、unsubscribe、values event 通道。
- [x] 8.2 在 shared HMI API 类型中新增 `tags.getSnapshot()` 和 `tags.subscribeValues(listener)`。
- [x] 8.3 在 Main IPC handlers 中实现 Tag snapshot 请求。
- [x] 8.4 实现 Main Tag IPC publisher，订阅 TagCache semantic changes。
- [x] 8.5 实现 pending TagValue queue，并按默认 `250ms` throttle 批量 flush。
- [x] 8.6 单次 IPC event 发送多个 TagValue，不默认逐 Tag 发送。
- [x] 8.7 实现首次订阅后的 snapshot 获取流程。
- [x] 8.8 实现默认 `2000ms` heartbeat 或 snapshot refresh，避免 timestamp 长期误导。
- [x] 8.9 在 Preload 暴露 typed tag API，不暴露 raw `ipcRenderer`。
- [x] 8.10 实现 Renderer unsubscribe 时移除 `ipcRenderer` listener，并通知 Main 清理订阅。
- [x] 8.11 窗口销毁时 Main 自动清理对应 Tag subscriber。

## 9. Renderer ViewModels

- [x] 9.1 新增共享实时 Tag ViewModel，由 RootViewModel 持有并可被 Dashboard/Device 消费。
- [x] 9.2 实现初始化 snapshot 加载。
- [x] 9.3 实现 batch event 订阅和 dispose。
- [x] 9.4 使用 MobX observable map 保存 TagValues。
- [x] 9.5 使用 MobX action 一次性应用一批 TagValue 更新。
- [x] 9.6 提供 Dashboard 所需 computed：Temperature、Level、Pressure、RPM、Running State、Mode、Production Count。
- [x] 9.7 提供 Device Tag Monitor rows：Tag Name、Value、Unit、Quality、Timestamp。
- [x] 9.8 非 `Good` quality 时提供可区分的展示状态。
- [x] 9.9 确保 ViewModels 不导入 Main Process、ModbusAdapter、PollingScheduler、TagService、TagCache 或 Node.js API。

## 10. Dashboard and Device UI

- [x] 10.1 改造 Dashboard 页面，只显示验收要求的 Temperature、Level、Pressure、RPM、Running State、Mode、Production Count 七项主监控。
- [x] 10.2 Dashboard 值来源必须是 Tag ViewModel，不直接调用 device manual read 或协议 API。
- [x] 10.3 Dashboard 在 `Bad` / `Uncertain` quality 时显示降级状态，不把旧值当作正常实时值。
- [x] 10.4 在 Device 页面新增 Tag Monitor 区域，并包含 Target Temperature、Manual RPM Setpoint 等非 Dashboard 主监控 Tag。
- [x] 10.5 Tag Monitor 至少显示 Tag Name、Value、Unit、Quality、Timestamp。
- [x] 10.6 Tag Monitor 使用共享 Tag pipeline，不依赖手动点击 read 按钮刷新。
- [x] 10.7 保持现有 Device 连接、断开、手工读写验证 UI 可用。
- [x] 10.8 调整样式，保证 Dashboard 和 Tag Monitor 在桌面窗口内可读、无重叠。

## 11. Tests

- [x] 11.1 添加 TagDefinition 默认字段测试，覆盖 required fields、scanRate、offset、writable，并锁定 `500ms`/`1000ms` 默认分配。
- [x] 11.2 添加 TagQuality 和初始 `Uncertain` TagCache 测试。
- [x] 11.3 添加 TagService decode 测试，覆盖 `boolean`、`int16`、`uint16`、`uint32`。
- [x] 11.4 添加 scale/offset 转换测试。
- [x] 11.5 添加 decode failure 转 `Bad` quality 的测试。
- [x] 11.6 添加 TagCache batch update、snapshot、semantic change detection 测试。
- [x] 11.7 添加 Scan Group builder 测试，覆盖 device、scanRate、registerType、address continuity。
- [x] 11.8 添加连续寄存器批量读取测试，验证不会逐 Tag 生成 read。
- [x] 11.9 添加 PollingScheduler non-reentrant、stop cleanup、failure quality update 测试。
- [x] 11.10 添加 IPC contract/preload API 测试，验证 typed tag API 和 unsubscribe。
- [x] 11.11 添加 Renderer ViewModel batch apply 测试，验证一次批量更新派生 Dashboard/Tag Monitor 状态。
- [x] 11.12 更新 architecture boundary 测试，禁止 Renderer 导入 Main/Protocol/Polling/TagCache 模块。
- [x] 11.13 添加集成或 smoke 测试，覆盖 Simulator -> ModbusAdapter -> PollingScheduler -> TagCache 链路。
- [x] 11.14 验证 Simulator 停止后 Renderer/ViewModel 不崩溃，Tag quality 降级为 `Bad`；手工 disconnect 后 quality 降级为 `Uncertain`。

## 12. Documentation

- [x] 12.1 更新 Tag Model 文档，说明 TagDefinition、TagValue、TagQuality。
- [x] 12.2 更新 Polling/Scan Group 文档，说明 device、scanRate、registerType、address continuity 分组规则。
- [x] 12.3 更新 Modbus Mapping 或开发文档，说明 Tag address 使用 PDU zero-based address。
- [x] 12.4 记录默认 Tag 列表、`500ms`/`1000ms` scanRate 分配、单位、scale/offset。
- [x] 12.5 记录 IPC batching、默认 `250ms` throttle、默认 `2000ms` heartbeat、change detection 和 UI refresh 解耦策略。
- [x] 12.6 更新手工验收说明，覆盖 Dashboard 实时监控和 Device Tag Monitor。

## 13. Verification

- [x] 13.1 运行 `openspec validate add-tag-polling-monitoring --strict`。
- [x] 13.2 运行 `openspec validate --all --strict`。
- [x] 13.3 运行 `git diff --check`。
- [x] 13.4 运行 `npm run typecheck`。
- [x] 13.5 运行 `npm run lint`。
- [x] 13.6 运行 `npm run test`。
- [x] 13.7 运行 `npm run build`。
- [x] 13.8 手工或自动验证 Simulator -> Modbus -> Tag -> Dashboard 数据链路跑通。
- [x] 13.9 验证不存在每 Tag 一个 Timer。
- [x] 13.10 验证连续寄存器可以批量读取。
- [x] 13.11 验证所有 TagValue 始终包含 Quality 和 Timestamp。
- [x] 13.12 验证 UI 不直接读取 Modbus。
- [x] 13.13 验证停止 Simulator 后 Renderer 不崩溃。
- [x] 13.14 验证可以通过日志观察 polling 行为。
- [x] 13.15 汇报仍然存在的风险、失败项或未完成验证，不自动 commit、push 或 archive。
