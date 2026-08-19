## Why

Industrial HMI 已经具备 Modbus TCP Simulator、统一 Tag 采集、设备重连、控制命令、报警、历史趋势、配方、权限和审计等基础能力。下一阶段需要验证 `IProtocolAdapter` 是否足以承载第二种工业协议，并用性能、长期运行、测试和项目文档补齐面试演示与工程可信度。

本 change 重点是在既有架构上增加 OPC UA 接入与生产级加固验证，而不是为了 OPC UA 重写 DeviceManager、TagService、PollingScheduler、CommandService 或 Renderer MVVM。

## What Changes

- 新增 `OpcUaAdapter`，作为 `IProtocolAdapter` 的具体实现，并保持第三方 OPC UA 客户端库只存在于 Main Process 的协议适配层。
- 扩展 `IProtocolAdapter` capability，使协议层能声明采集模式、写入能力、订阅能力、批量读取能力和连接语义；业务层不通过 `instanceof ModbusAdapter` / `instanceof OpcUaAdapter` 判断协议。
- 明确 Modbus TCP 与 OPC UA 的采集差异：Modbus 默认走 polling 和地址连续批量读取；OPC UA 默认优先走 subscription，不强行伪装成 Modbus polling。
- 新增简单 OPC UA Server Simulator，模拟已有自动化恒温混料设备变量，至少包含 Temperature、Level、RPM、Running、Setpoint。
- 设备配置支持选择 `Modbus TCP` 或 `OPC UA`，Dashboard 和 Renderer ViewModel 只消费 Tag、Device State、Command Result，不感知底层协议类型。
- 扩展 Tag 采集架构，允许同一 Tag pipeline 接收 PollingScheduler 或 Protocol Subscription 产生的 TagValue 批次。
- 保持 CommandService 为所有写入的统一入口；OPC UA 写入 Setpoint / Running 等变量也必须通过 CommandService、权限、审计和验证边界。
- 增加可配置大规模 Tag Simulator 和性能测试脚本，至少覆盖 100、500、1000 个 Tag，并记录 request count、polling/subscription duration、CPU、memory、IPC message rate、Renderer update rate。
- 增加长期运行检查计划，覆盖 Timer 泄漏、Event Listener 泄漏、OPC subscription 清理、reconnect 资源清理、trend memory、SQLite 写入和日志增长。
- 补齐重点 Unit Test 和 Integration Test 矩阵，覆盖 Tag decode、Alarm condition、Device state、Recipe validation、Permission，以及 Simulator + ModbusAdapter、disconnect/reconnect、command、historian。
- 更新 README，使其覆盖项目介绍、Architecture、Technology Stack、工业通信架构、Modbus Mapping、Tag Model、Polling Architecture、Device State Machine、Alarm Lifecycle、Historian、Recipe、OPC UA、Simulator 运行、Demo 步骤、Testing 和 Known Limitations。
- 增加面试演示场景说明：设备启动及实时监控、断线到 Bad Quality 到自动重连、高温报警确认恢复、历史趋势、Recipe Download、Modbus / OPC UA 协议切换。
- 固化默认实施决策：Modbus TCP 仍为默认协议；OPC UA Simulator 默认 endpoint 为 `opc.tcp://127.0.0.1:4840/industrial-hmi-simulator`；本期 OPC UA Simulator 使用本地 anonymous / no-security 配置并明确非生产安全配置；本期仍只支持默认 simulated mixer device，不扩展完整多设备管理 UI；性能报告默认输出到 `reports/performance/`；long-run 默认提供 5-10 分钟 smoke profile 和 30-120 分钟手工 extended profile。
- 明确本项目是工业自动化学习及模拟项目，不代表真实生产现场 Safety System，也不承诺真实产线可用性或安全联锁能力。

## Capabilities

### New Capabilities
- `opcua-protocol-support`: 定义 OPC UA Adapter、OPC UA Simulator、协议配置切换、OPC UA subscription 采集、OPC UA 写入验证和与现有业务层的协议无关边界。
- `production-hardening`: 定义大规模 Tag 性能测试、长期运行资源检查、测试覆盖矩阵、README 文档完整性和面试 Demo 场景。

### Modified Capabilities
- `modbus-plc-simulator`: 扩展现有 `IProtocolAdapter` 抽象和设备配置要求，使 Modbus 继续作为现有协议实现，同时允许设备选择 OPC UA 且不破坏 Modbus 行为。
- `tag-polling-monitoring`: 扩展 Tag 采集 pipeline，允许 PollingScheduler 与 OPC UA subscription 共同产出 TagValue 批次，并增加采集/IPC/Renderer 指标采集要求。
- `device-control-resilience`: 收紧 CommandService 的协议无关要求，确保 Modbus 和 OPC UA 写入均经过统一命令、状态、权限、审计、timeout 和验证边界。
- `product-readiness`: 更新 README 和演示文档要求，使文档反映当前已实现的工业模拟能力、OPC UA 范围、测试方式和 Safety System 限制。

## Impact

- 影响 `src/main/protocol/`：新增 `OpcUaAdapter`、协议 capability、adapter factory / registry、统一错误转换和资源释放约定。
- 影响 `src/main/device/`：设备配置增加 protocol type、endpoint 结构和 adapter 创建策略；DeviceManager 仍依赖 `IProtocolAdapter`。
- 影响 `src/main/tag/`：Tag pipeline 需要接纳 polling 与 subscription 两类数据源，继续通过 TagService decode、TagCache batch update 和 typed IPC 向 Renderer 分发；现有 `PollingScheduler` 位于该模块内。
- 影响 `src/main/command/`：CommandService 继续保持唯一写入入口，并支持 OPC UA 变量写入和 read-back/subscription-based verification。
- 影响 Simulator：保留现有 Modbus Simulator，新增简单 OPC UA Server Simulator，并新增大规模 Tag Simulator / profiling helper。
- 影响 Renderer ViewModel 和页面：只新增协议选择配置和 Demo 展示状态；Dashboard 不出现协议分支逻辑。
- 影响测试：新增或扩展 unit、integration、performance 和 long-run 验证脚本；性能测试必须输出真实采样数据和运行环境说明，不得写入伪造结果。
- 影响文档：README、运行说明、Modbus Mapping、OPC UA、Testing、Demo 和 Known Limitations 需要与当前模拟项目定位一致。
- 不主动修改 Git history、不 push、不 archive；本 change 仅生成方案 artifacts，实施需要后续明确指令。
