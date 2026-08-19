## 1. Scope and Existing Context

- [x] 1.1 阅读本 change 的 `proposal.md`、`design.md`、全部 `specs/**/spec.md`，确认本期范围只包含 OPC UA 接入、协议抽象验证、性能/长期运行/测试/文档加固。
- [x] 1.2 复查现有 `IProtocolAdapter`、`ModbusAdapter`、`DeviceManager`、`PollingScheduler`、`TagService`、`TagCache`、`CommandService`、IPC、Preload 和 Renderer ViewModel 边界。
- [x] 1.3 识别当前协议 request/write 类型中偏 Modbus 的字段，并列出需要最小演进的类型和调用点。
- [x] 1.4 确认本期不重写 Alarm、Historian、Trend、Recipe、Permission、Audit 和 Renderer 页面架构。
- [x] 1.5 确认本期所有真实生产 Safety System、证书安全策略、真实 PLC vendor profile、硬件联锁和生产认证能力保持非目标。

## 2. Protocol Abstraction and Device Configuration

- [x] 2.1 定义 `ProtocolKind`，至少包含 `modbusTcp` 和 `opcUa`。
- [x] 2.2 将 `ProtocolConnectionConfig` 演进为支持 Modbus TCP 与 OPC UA 的 discriminated union，同时保持默认 Modbus 配置兼容。
- [x] 2.3 定义 `ProtocolAdapterCapabilities`，覆盖 protocol kind、preferred acquisition、polling、subscription、batch read、write、read-back、timeout 和 subscription item limit。
- [x] 2.4 在 `IProtocolAdapter` 上暴露 capability 查询，不要求业务服务使用 concrete adapter class 判断协议。
- [x] 2.5 定义协议绑定模型，使 Modbus Tag 使用 register area/address/quantity，OPC UA Tag 使用 nodeId/value type/sampling interval。
- [x] 2.6 更新默认 simulated mixer Tag/point/command 配置，使 Modbus 现有 mapping 继续可用。
- [x] 2.7 新增 OPC UA simulated mixer Tag/point/command binding，覆盖 Temperature、Level、RPM、Running、Setpoint。
- [x] 2.8 实现 adapter factory / registry，根据 device config 创建 `ModbusAdapter` 或 `OpcUaAdapter`。
- [x] 2.9 调整 `DeviceManager` 注入方式，使其通过 adapter factory 或 per-device adapter provider 获取 adapter，而不是固定构造 `ModbusAdapter`。
- [x] 2.10 确保 unsupported protocol config 被 Main Process 拒绝或进入 `Fault`，并返回统一用户可见错误。
- [x] 2.11 更新共享 DTO 和 typed IPC，使设备配置可以提交 protocol kind 和 endpoint summary，但 Renderer 不获得协议客户端对象。

## 3. OPC UA Dependency and Simulator

- [x] 3.1 执行 OPC UA 依赖评审，默认优先评审 `node-opcua`，记录候选库的 Electron 主进程适配、打包影响、维护状态、许可证、TypeScript 类型和 native dependency 风险；若风险不可接受，再选择更轻量方案。
- [x] 3.2 在依赖评审通过后按项目 Yarn 约定新增 OPC UA 客户端/服务端依赖，不混用包管理器。
- [x] 3.3 新增 `src/main/protocol/opcua/` 模块结构，隔离 OPC UA client/session/subscription 细节。
- [x] 3.4 新增独立 OPC UA Server Simulator 脚本，能够不启动 Electron HMI 独立运行。
- [x] 3.5 OPC UA Simulator 默认监听 `opc.tcp://127.0.0.1:4840/industrial-hmi-simulator`，并支持 endpoint override。
- [x] 3.6 OPC UA Simulator 暴露 Temperature、Level、RPM、Running、Setpoint 变量。
- [x] 3.7 实现 OPC UA Simulator 的基础过程动态，使 Temperature 随 Running 和 Setpoint 变化。
- [x] 3.8 保证 OPC UA Simulator 停止后 Electron HMI 可继续运行，DeviceManager 能处理通信丢失。
- [x] 3.9 保证 Simulator 故障控制和大规模 Tag 模式只存在于 simulator/test helper，不泄漏到 HMI 业务代码。
- [x] 3.10 OPC UA Simulator 默认使用本地 anonymous / no-security 配置，并在 README / Known Limitations 中明确不代表生产 OPC UA 安全配置。

## 4. OpcUaAdapter

- [x] 4.1 实现 `OpcUaAdapter.connect`，建立 session 并转换连接错误。
- [x] 4.2 实现 `OpcUaAdapter.disconnect`，关闭 session、subscription、monitored item、timer 和 listener。
- [x] 4.3 实现 `OpcUaAdapter.getStatus`，返回统一 connection status、endpoint summary、lastSuccessfulAt 和 lastError。
- [x] 4.4 实现 OPC UA read，将配置的 NodeId value 读取为 protocol-neutral read result。
- [x] 4.5 实现 OPC UA write，将 writable binding 写入 OPC UA variable，并返回 structured write result。
- [x] 4.6 实现 OPC UA subscription / monitored item 管理，支持按 Tag binding 创建和取消订阅。
- [x] 4.7 将 OPC UA status code、session close、subscription failure、timeout 和 malformed value 转换为统一 communication error。
- [x] 4.8 在 disconnect、reconnect、Fault 和 runtime dispose 场景验证 OPC UA adapter 资源释放。
- [x] 4.9 更新 `src/main/protocol/index.ts` 和协议 README，导出新 adapter 和 capability 类型。

## 5. Tag Acquisition Pipeline

- [x] 5.1 新增 `TagAcquisitionCoordinator` 或等价协调层，根据 adapter capability 选择 polling 或 subscription。
- [x] 5.2 保持 Modbus TCP 默认使用现有 `PollingScheduler`，继续支持 scanRate 分组和连续地址 batching。
- [x] 5.3 新增 OPC UA subscription acquisition，将 monitored item notification 转为 TagService 可解码的输入。
- [x] 5.4 扩展 TagService decode，使其支持 Modbus raw result 和 OPC UA binding value 两类来源。
- [x] 5.5 保证 OPC UA Good/Bad/Uncertain status 映射到统一 TagQuality。
- [x] 5.6 保证 OPC UA notification batch 进入 TagCache 后复用现有 AlarmEngine、Historian、Trend、IPC 和 Renderer ViewModel 链路。
- [x] 5.7 设备进入 `Disconnected`、`Reconnecting`、`Fault` 或 runtime dispose 时，统一停止 polling timer 或 OPC UA subscription。
- [x] 5.8 在 acquisition 切换和清理时记录 communication/application log，避免高频 INFO spam。
- [x] 5.9 增加采集 metrics hooks，记录 polling request count/duration、subscription notification count/duration、TagCache batch size、skipped tick 和 failure count。
- [x] 5.10 验证 100、500、1000 Tag 场景下 IPC 仍走 batch/throttle，不退化为每 Tag 一个 IPC 消息。

## 6. CommandService and Protocol Switching

- [x] 6.1 将 CommandDefinition 目标调整为 logical command / Tag binding，避免 Renderer 请求携带 Modbus address 或 OPC UA NodeId。
- [x] 6.2 保持 Modbus Start、Stop、Motor、Valve、Target Temperature、RPM Setpoint 命令行为兼容。
- [x] 6.3 新增 OPC UA Setpoint 写入命令映射。
- [x] 6.4 新增 OPC UA Running 或等价启停命令映射。
- [x] 6.5 保证 OPC UA 命令经过 device state、permission、audit preflight、writable、value type、range、timeout 和 verification 校验。
- [x] 6.6 实现 OPC UA read-back 或 protocol-neutral Tag feedback wait，用于区分 write accepted 和 verified success。
- [x] 6.7 保证 CommandService 不直接持有 OPC UA session/subscription/monitored item 对象。
- [x] 6.8 在 Modbus 和 OPC UA 下统一处理 command rejected、busy、timeout、communication failed、verify failed 和 succeeded。
- [x] 6.9 保证 `Disconnected`、`Reconnecting`、`Fault` 下 Modbus 和 OPC UA 命令都在 Main Process 写入前被拒绝。
- [x] 6.10 更新 Device/Settings 配置 UI，只允许提交受控 protocol config；Modbus TCP 保持默认协议，OPC UA 作为可选配置；Dashboard/ViewModel 不按协议类型分支处理 Tag 数据。

## 7. Performance and Long-Run Tooling

- [x] 7.1 新增可配置大规模 Tag Simulator，支持 100、500、1000 Tag。
- [x] 7.2 大规模 Tag definitions 生成保持 deterministic，支持 seed 或等价配置。
- [x] 7.3 新增性能 profile 脚本，记录运行命令、采样窗口、协议类型、Tag 数、scan/subscription 参数和环境摘要。
- [x] 7.4 性能 profile 记录 request count 或 notification count、duration、CPU、memory、IPC message rate、Renderer update rate、TagCache batch size、Historian write rate、Trend point count 和 log growth。
- [x] 7.5 性能 profile 输出 timestamped JSON / Markdown 报告，默认目录为 `reports/performance/`，并按项目 gitignore 策略处理原始报告。
- [x] 7.6 README 只描述性能脚本运行方式、报告字段和如何解读，不写未经脚本生成的固定性能数字。
- [x] 7.7 新增长期运行 smoke profile，默认 5-10 分钟，覆盖 connect、poll/subscription、command、disconnect、reconnect 和 dispose。
- [x] 7.8 新增长期运行 extended profile 文档，默认 30-120 分钟手工运行，不作为普通 CI 必跑项。
- [x] 7.9 长期运行检查 Timer、Event Listener、OPC UA subscription、reconnect loop、trend memory、SQLite write、log growth 和 resource cleanup。
- [x] 7.10 长期运行报告明确采样限制，不把未观测到泄漏写成证明不存在泄漏。

## 8. Tests

- [x] 8.1 补充 Tag decode 单元测试，覆盖 Modbus scale/offset、OPC UA value normalization、quality 和 timestamp。
- [x] 8.2 补充 Alarm condition 单元测试，覆盖 threshold、BooleanState、delay、recovery debounce 和 non-Good quality 行为。
- [x] 8.3 补充 Device state 单元测试，覆盖 legal transition、invalid transition、reconnect cancellation 和 resource cleanup。
- [x] 8.4 补充 Recipe validation 单元测试，覆盖必填参数、类型、范围、保存和下载前校验。
- [x] 8.5 补充 Permission 单元测试，覆盖 Operator、Engineer、Admin 权限矩阵和 Main Process 权威校验。
- [x] 8.6 补充 Simulator + ModbusAdapter 集成测试，覆盖 connect/read/write/disconnect/reconnect。
- [x] 8.7 补充 disconnect/reconnect 集成测试，覆盖 Bad Quality、自动重连、恢复后 Good Quality。
- [x] 8.8 补充 CommandService 集成测试，覆盖 command success、rejected、timeout、verify failed、busy 和 audit result。
- [x] 8.9 补充 Historian 集成测试，覆盖 SQLite persistence、fixed interval、deadband、quality change 和 historical query。
- [x] 8.10 新增 OPC UA Simulator + OpcUaAdapter 集成测试，覆盖 connect、subscription update、write、read-back、disconnect 和 cleanup。
- [x] 8.11 更新 architecture boundary 测试，禁止 Renderer 导入 Node.js、SQLite、Modbus/OPC UA 库、Main Process adapter、DeviceManager、CommandService、PollingScheduler、TagService 和 TagCache。
- [x] 8.12 增加 performance smoke 测试或脚本验证，至少证明 100/500/1000 Tag profile 能启动并生成真实报告结构。

## 9. Documentation and Demo

- [x] 9.1 更新 README 项目介绍，明确学习/模拟/工程实践定位。
- [x] 9.2 更新 README Architecture 和 Technology Stack，反映 Electron、React、TypeScript、MobX、MVVM、SQLite、Modbus TCP、OPC UA。
- [x] 9.3 更新 README 工业通信架构，说明 Main Process 协议边界、`IProtocolAdapter` capability、Modbus polling 和 OPC UA subscription。
- [x] 9.4 更新 README Modbus Mapping，保持 human reference address 和 PDU zero-based address 说明。
- [x] 9.5 更新 README Tag Model，说明 TagDefinition、TagValue、Quality、protocol binding 和 stale/Bad/Uncertain 规则。
- [x] 9.6 更新 README Polling Architecture，说明 scan group、batching、UI refresh 与 PLC sampling 分离。
- [x] 9.7 更新 README Device State Machine，列出 Disconnected、Connecting、Connected、Reconnecting、Fault 和合法转换。
- [x] 9.8 更新 README Alarm Lifecycle，说明 Active、Acknowledged、Recovered 不混淆。
- [x] 9.9 更新 README Historian，说明 SQLite、fixed interval、deadband、quality change、query cap。
- [x] 9.10 更新 README Recipe，说明 validation、download plan、CommandService、read-back、partial failure。
- [x] 9.11 更新 README OPC UA，说明 Simulator endpoint、变量、subscription、命令写入和限制。
- [x] 9.12 更新 README 如何运行 Simulator，分别说明 Modbus Simulator、OPC UA Simulator 和大规模 Tag Simulator。
- [x] 9.13 更新 README Demo 步骤，覆盖六个面试演示场景。
- [x] 9.14 更新 README Testing，列出 OpenSpec、typecheck、lint、test、build、performance profile 和 long-run profile。
- [x] 9.15 更新 README Known Limitations，明确不是真实生产现场 Safety System。
- [x] 9.16 同步更新相关模块 README 或 Help 文档，避免仍声称 Modbus、OPC UA、报警、Historian、Recipe 尚未实现。

## 10. Verification

- [x] 10.1 运行 `openspec validate add-opcua-production-hardening --strict`。
- [x] 10.2 运行 `openspec validate --all --strict`。
- [x] 10.3 运行 `git diff --check`。
- [x] 10.4 运行 `yarn typecheck`。
- [x] 10.5 运行 `yarn lint`。
- [x] 10.6 运行 `yarn test`。
- [x] 10.7 运行 `yarn build`。
- [x] 10.8 运行 Modbus Simulator 集成验收。
- [x] 10.9 运行 OPC UA Simulator 集成验收。
- [x] 10.10 运行 100、500、1000 Tag performance profile，并保存真实报告或说明未运行原因。
- [x] 10.11 运行 long-run smoke profile，并记录资源、SQLite、Trend 和 log 增长结论。
- [x] 10.12 验证 Demo 1 到 Demo 6 的核心链路：README 已给出演示步骤，`yarn smoke:start`、Modbus/OPC UA 集成测试、报警/历史趋势/配方测试、performance profile 和 long-run smoke 已覆盖演示所需能力；人工点击录屏不纳入本次提交。
- [x] 10.13 汇报所有 validation/test/build/profile 结果，不自动 commit、push 或 archive。
