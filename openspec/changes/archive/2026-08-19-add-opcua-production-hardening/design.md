## Context

当前项目已经完成 Electron Main / Preload / Renderer 分层、MobX MVVM、独立 Modbus TCP PLC Simulator、`ModbusAdapter`、`DeviceManager`、`TagService`、`TagCache`、`PollingScheduler`、`CommandService`、设备状态机、自动重连、报警、Historian/Trend、Recipe、Permission 和 Audit。

现有 `IProtocolAdapter` 位于 `src/main/protocol/types.ts`，但 `ProtocolReadRequest` / `ProtocolWriteRequest` 仍带有 `ModbusRegisterArea`、PDU address、unit id 等 Modbus 形态。`DeviceManager`、`PollingScheduler`、`CommandService` 已经通过 adapter 抽象调用读写，但运行时创建的是单个 `ModbusAdapter`。因此本期的关键不是重写业务层，而是把 adapter contract 从“只有 Modbus 能自然表达”演进为“协议能力 + Tag/Point 绑定 + 采集模式”。

本期同时承担性能、长期运行、测试和文档加固。性能数据必须来自真实脚本运行输出，并标明运行环境、设备数量、Tag 数量、协议类型、采样窗口和限制，不能在 README 或报告里写固定漂亮数字。

## Goals / Non-Goals

**Goals:**

- 新增 OPC UA 支持并验证现有协议抽象能力。
- 让 `DeviceManager`、`TagService`、Tag acquisition、`CommandService` 依赖协议抽象和 Tag/Command 定义，不直接依赖 Modbus 或 OPC UA 具体库。
- 明确 Modbus 与 OPC UA 数据采集模型差异：Modbus 优先 polling + address batching；OPC UA 优先 subscription + monitored item notification。
- 新增简单 OPC UA Server Simulator，模拟 Temperature、Level、RPM、Running、Setpoint。
- 支持设备配置选择 `Modbus TCP` 或 `OPC UA`，Renderer Dashboard/ViewModel 不需要知道底层协议类型。
- 建立大规模 Tag 性能测试和长期运行检查框架，覆盖 request count、duration、CPU、memory、IPC rate、Renderer update rate 和资源清理。
- 补齐指定 Unit Test / Integration Test 矩阵和 README / Demo 文档。
- 保持本项目定位为工业自动化学习及模拟项目，不声明真实 Safety System 能力。

**Non-Goals:**

- 不重写 DeviceManager、TagService、TagCache、CommandService、AlarmEngine、Historian 或 Renderer MVVM。
- 不让 OPC UA 为了适配旧接口强行完全模拟成 Modbus polling。
- 不把 OPC UA 第三方客户端或 server 库暴露给 Renderer、ViewModel、TagService 或 CommandService。
- 不实现生产级 OPC UA 安全策略、证书管理、用户认证、复杂 method call、复杂 namespace 建模或真实 PLC vendor profile；本期 local simulator 使用 anonymous / no-security 并显式标注非生产配置。
- 不新增真实生产现场 safety interlock、SIL、ESD、硬件联锁或合规认证能力。
- 不为了性能测试提前做大规模架构优化；先测真实瓶颈，再做最小必要优化。
- 不伪造、硬编码或手工美化性能数据。

## Decisions

### 1. 协议抽象采用 capability + protocol binding，而不是上层 `if protocol === ...`

现有 adapter contract 会保留 `connect`、`disconnect`、`getStatus`、`read`、`write` 的基本形态，但需要扩展：

- `ProtocolKind`: `modbusTcp` / `opcUa`。
- `ProtocolConnectionConfig`: 改为 discriminated union，Modbus 保留 host/port/unitId，OPC UA 使用 endpointUrl、namespace、security profile 等模拟所需字段。
- `ProtocolAdapterCapabilities`: 描述 `supportsPolling`、`supportsSubscription`、`preferredAcquisition`、`supportsBatchRead`、`supportsWrite`、`supportsReadBack`、`maxItemsPerSubscription`、`requestTimeoutMs` 等能力。
- `ProtocolDataAddress` 或等价绑定：Modbus binding 使用 register area + PDU address + quantity；OPC UA binding 使用 nodeId + value type + sampling interval。

TagDefinition 继续保留工业统一字段 `id`、`name`、`deviceId`、`address`、`registerType`、`dataType`、`scale`、`offset`、`unit`、`writable`、`scanRate`，但允许增加协议绑定 metadata。Modbus 默认 Tag 可以继续使用现有 fields；OPC UA Tag 通过 binding 表达 nodeId，避免业务服务解析 OPC UA NodeId。

备选方案是让 `ProtocolReadRequest` 保持 Modbus shape，然后 OPC UA Adapter 把 register address 映射成 NodeId。该方案会隐藏协议差异，并迫使 OPC UA 模拟 Modbus，后续 subscription、monitored item、namespace 能力都难以表达，因此不采用。

### 2. DeviceManager 只选择 adapter，不理解协议细节

DeviceManager 负责设备状态机、connect/disconnect/reconnect、状态发布和生命周期回调。它通过 adapter factory / registry 根据设备配置创建具体 adapter：

```text
DeviceConfig.protocol = "modbusTcp" | "opcUa"
DeviceManager
  -> ProtocolAdapterFactory
  -> IProtocolAdapter
```

DeviceManager 可以记录 protocol kind 和 endpoint summary 供 UI 显示，但不得调用 Modbus 或 OPC UA 专属 API。运行时默认仍只支持一个 simulated mixer device；本期不扩展完整多设备管理 UI。

备选方案是在 `createMainRuntime` 里根据 UI 状态直接创建 `ModbusAdapter` 或 `OpcUaAdapter` 并分支传给各服务。该方案会把协议选择扩散到 runtime 和服务装配层，后续多设备会变难，因此只允许 factory/registry 这种集中创建点。

### 3. 采集层拆分为 Polling 和 Subscription 的协调，而不是把 OPC UA 塞进 PollingScheduler

Tag 数据仍统一进入：

```text
Protocol acquisition
  -> TagService decode / normalize
  -> TagCache batch update
  -> AlarmEngine / Historian / Trend / IPC
  -> Renderer ViewModel
```

但 acquisition 来源分为：

- Modbus TCP：使用现有 `PollingScheduler`，按 device、scanRate、registerType、address continuity 分组批量读取。
- OPC UA：新增 `SubscriptionScheduler` 或 `OpcUaSubscriptionManager`，按 device 和 OPC UA capability 建立 subscription / monitored items，收到 notification 后产出 TagValue 批次。
- Hybrid / fallback：如果某个 OPC UA server 不支持 subscription 或测试明确关闭 subscription，才允许使用 polling fallback，并在 capability / log / report 中标明。

新增 `TagAcquisitionCoordinator` 或等价协调层，负责根据 adapter capability 启动/停止 polling 或 subscription，并在设备断开、重连、dispose 时统一清理资源。这样 `PollingScheduler` 保持 Modbus polling 专注，不需要理解 OPC UA subscription。

备选方案是扩展 `PollingScheduler` 支持 `setInterval` 内读取 OPC UA NodeId。该方案能快速接入，但不能验证 OPC UA 更自然的 subscription 模型，且会让 `PollingScheduler` 变成通用采集 God Class，因此不采用。

### 4. OpcUaAdapter 最小实现范围

`OpcUaAdapter` 位于 `src/main/protocol/opcua/`，只实现本期所需能力：

- connect / disconnect / getStatus。
- read one or multiple configured OPC UA variable nodes。
- write configured writable variable nodes。
- create / dispose subscription and monitored items。
- 将 OPC UA status code、session close、subscription error、timeout 等转换为统一 AppError / communication error。
- 在 disconnect、reconnect、subscription dispose、application dispose 时释放 session、subscription、monitored item、timer 和 listener。

第三方 OPC UA 依赖必须在实施前做依赖评审：确认 Electron 主进程适配、打包影响、维护情况、许可证、TypeScript 类型、server simulator 支持和 native dependency 风险。默认优先评审 `node-opcua`；若打包、native runtime、维护或体积风险不可接受，再改用更轻量的 OPC UA 方案。无论最终依赖选择如何，直接依赖只能出现在 Main / simulator 侧，Renderer import boundary 测试要覆盖禁止项。

### 5. OPC UA Simulator 与现有 Modbus Simulator 解耦但共享设备语义

新增简单 OPC UA Server Simulator，默认可以独立启动和关闭，不依赖 Electron HMI。它模拟同一自动化恒温混料设备的核心变量：

| Variable | Type | Access | 初始语义 |
| --- | --- | --- | --- |
| Temperature | Double | read | 当前温度，随 Running 和 Setpoint 动态变化 |
| Level | Double | read | 当前液位 |
| RPM | Int32 | read | 当前转速 |
| Running | Boolean | read/write 或命令写入映射 | 设备运行状态 |
| Setpoint | Double | read/write | 目标温度 |

默认 endpoint 使用 `opc.tcp://127.0.0.1:4840/industrial-hmi-simulator`。本期 OPC UA Simulator 默认使用本地 anonymous / no-security 连接，并在 README / Known Limitations 中明确这不是生产 OPC UA 安全配置。为了避免业务代码依赖 Simulator，HMI 只把它当作普通 OPC UA endpoint 连接；故障注入和大规模 Tag 模拟控制仍通过 simulator CLI/test helper，不通过业务 API 伪造。

Modbus Simulator 不因 OPC UA 新增而改变既有映射和默认端口。可在 simulator 内复用“混料过程模型”作为测试 helper，但 HMI Main Process 不直接引用 simulator 内部对象。

### 6. CommandService 保持唯一写入入口

CommandService 继续执行：

```text
Renderer View
  -> ViewModel
  -> typed Preload API
  -> Main IPC
  -> Permission / Audit / Device State / Command Validation
  -> CommandService
  -> IProtocolAdapter
```

命令定义以 logical command / target Tag 为中心，而不是以 Modbus register 或 OPC UA node 为中心。Setpoint 写入在 Modbus 下映射到 Holding Register，在 OPC UA 下映射到 Setpoint NodeId；Running 可通过 Boolean node 或命令点映射执行。验证策略仍区分 write accepted、read-back / feedback verified、timeout、failed、rejected。

OPC UA subscription 可用于等待反馈变化，但 CommandService 不能直接持有 OPC UA subscription 对象；它应通过 protocol-neutral read-back 或 TagCache/feedback wait abstraction 等待结果。

### 7. Renderer 协议感知边界

Renderer 可以在 Device/Settings 配置区显示协议选项 `Modbus TCP` / `OPC UA`，并提交受控设备配置 DTO。默认协议仍为 `Modbus TCP`，OPC UA 作为可选配置。Dashboard、TagValuesViewModel、AlarmViewModel、TrendViewModel、RecipeViewModel 不根据协议分支处理数据。

允许 UI 显示 endpoint summary 和 protocol label 作为设备配置/演示信息；不允许 View 或 ViewModel 理解 Modbus function code、holding register、OPC UA NodeId、subscription id、session id 或 low-level status code。

### 8. 性能测试先采集真实指标，再决定优化

新增可配置大规模 Tag Simulator 和 profiling 脚本，默认矩阵：

| Case | Tag count | 目标 |
| --- | --- | --- |
| small | 100 | 验证基础调度、IPC batching、Renderer update |
| medium | 500 | 观察 request count、duration、CPU、memory |
| large | 1000 | 暴露采集、IPC、Renderer 和 historian 的瓶颈 |

指标至少包括：

- protocol request count 或 OPC UA notification / monitored item count。
- polling duration 或 subscription notification processing duration。
- Main Process CPU / memory。
- Renderer update rate。
- IPC message rate 和 batch size。
- TagCache batch size 和 update duration。
- Historian write count / duration。
- Trend buffer point count / memory estimate。
- log file growth。

性能报告默认输出到 `reports/performance/`，使用 timestamped JSON / Markdown artifact，标明运行命令、采样窗口、机器信息、协议类型、Tag 数、采样/订阅参数和失败项。该目录默认按仓库 gitignore 策略处理：原始 profile 报告不作为方案要求强制提交，是否提交样例报告由实施阶段明确决定。README 只能引用“如何运行”和“报告路径/示例字段”，不写未经本机脚本生成的固定结论。

### 9. 长期运行检查作为脚本化验收，不作为性能作秀

新增 long-run 检查，默认提供短时自动化 profile 和可选长时手工 profile：

- smoke：5-10 分钟，适合 CI 或本地快速验证。
- extended：30-120 分钟，适合面试前或发布前手工运行。

检查重点：

- Timer 数量启动/停止后回落。
- EventEmitter / subscription listener 取消后回落。
- OPC UA session、subscription、monitored item 在 disconnect/reconnect/dispose 后清理。
- reconnect loop 不重复创建。
- Trend RingBuffer 点数保持上限。
- SQLite 写入速率受 historian 策略限制，query 有上限。
- log 文件增长可解释，高频 polling 不刷 INFO。

若 Node.js 无法稳定枚举所有 timer/listener，脚本需要标注采样局限，不能把未观测到的问题写成“证明不存在泄漏”。

### 10. README 和 Demo 面向面试但保持工程边界

README 更新为项目主文档，至少包含用户列出的 16 个部分。Demo 说明以“Simulator 场景”为语境：

- Demo 1：设备启动及实时监控。
- Demo 2：PLC 断线 -> Bad Quality -> 自动重连。
- Demo 3：高温 -> Alarm -> Acknowledge -> Recover。
- Demo 4：历史趋势。
- Demo 5：Recipe Download。
- Demo 6：Modbus / OPC UA 协议切换。

文档必须明确：本项目用于工业 HMI 学习、模拟和面试展示；不代表真实生产现场 Safety System，不替代 Safety PLC、硬件联锁、急停或工业认证流程。

## Risks / Trade-offs

- [Risk] 现有协议 request 类型偏 Modbus，直接接入 OPC UA 可能诱发全链路重构。 -> Mitigation: 只在 protocol binding/capability 和 adapter factory 上做最小演进，业务服务仍使用 Tag/Command 抽象。
- [Risk] 为统一接口把 OPC UA subscription 降级成 polling，无法验证真实协议差异。 -> Mitigation: capability 声明 preferred acquisition，OPC UA 默认 subscription，polling 仅作为显式 fallback。
- [Risk] 新增 OPC UA 依赖影响 Electron 打包或 native runtime。 -> Mitigation: 实施前做依赖评审，依赖隔离在 Main/simulator，build 和 dist 纳入验证。
- [Risk] 大规模 Tag 测试可能暴露性能不足。 -> Mitigation: 报告真实瓶颈，本期只做必要边界控制，不为数字提前过度优化。
- [Risk] 长期运行泄漏不一定能被短时脚本完全发现。 -> Mitigation: 区分 smoke 与 extended profile，报告采样窗口和局限。
- [Risk] Demo 文档容易暗示真实产线可用。 -> Mitigation: README、Help、Demo 和 Known Limitations 统一声明学习/模拟定位和 Safety System 非目标。
- [Risk] Modbus 现有行为被 OPC UA 改造破坏。 -> Mitigation: 保留 Modbus Simulator、Modbus mapping、Modbus integration tests 和断线/command/historian 回归测试。

## Migration Plan

1. 先扩展 protocol types、device config、adapter factory 和 capability，保持 `ModbusAdapter` 现有行为测试通过。
2. 引入 Tag protocol binding，并让现有 Modbus Tag definitions 通过兼容路径继续工作。
3. 新增 OPC UA Simulator 与 `OpcUaAdapter`，先验证 connect/read/write/disconnect。
4. 新增 subscription acquisition，接入 TagService / TagCache / IPC，不影响 Modbus PollingScheduler。
5. 迁移 runtime 组装为按 device protocol 选择 adapter/acquisition，并保持 Dashboard/ViewModel 无协议分支。
6. 接入 CommandService 的 OPC UA 写入和验证路径。
7. 增加性能与 long-run profiling 脚本，并用 100/500/1000 Tag 生成真实报告样例。
8. 补齐 Unit/Integration/Architecture boundary 测试。
9. 更新 README、Help/Demo 文档和 Known Limitations。
10. 实施完成后运行 OpenSpec、typecheck、lint、test、build 和 git diff 检查。

Rollback 策略：adapter factory 保留 `modbusTcp` 默认路径；如果 OPC UA 依赖或 subscription 实现阻塞，可以禁用 OPC UA protocol option，同时保留 Modbus 原链路和已通过的加固测试。

## Open Questions

无。以下默认决策已经固化到本方案：优先评审 `node-opcua`；OPC UA Simulator endpoint 使用 `opc.tcp://127.0.0.1:4840/industrial-hmi-simulator`；本地 simulator 使用 anonymous / no-security 并明确非生产安全配置；Modbus TCP 保持默认协议；本期只支持默认 simulated mixer device；性能 profile 输出到 `reports/performance/`；long-run smoke profile 为 5-10 分钟，extended profile 为 30-120 分钟手工验收。
