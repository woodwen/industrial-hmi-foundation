## MODIFIED Requirements

### Requirement: Repository README
项目 SHALL 在根目录提供 `README.md`，使新读者可以理解、运行、验证和演示当前工业 HMI 模拟应用。

#### Scenario: 读者查看 README
- **WHEN** 读者打开根目录 `README.md`
- **THEN** README SHALL 至少包含项目介绍、Architecture、Technology Stack、工业通信架构、Modbus Mapping、Tag Model、Polling Architecture、Device State Machine、Alarm Lifecycle、Historian、Recipe、OPC UA、如何运行 Simulator、Demo 步骤、Testing 和 Known Limitations
- **AND** README SHALL 描述当前项目的主要运行命令、测试命令、目录结构、架构边界、帮助入口、更新检查和打包发布流程

#### Scenario: README 说明业务边界
- **WHEN** README 描述工业 HMI 能力
- **THEN** README SHALL 明确当前项目是工业自动化学习、模拟和工程实践项目
- **AND** README SHALL 明确它不代表真实生产现场 Safety System，不替代 Safety PLC、硬件联锁、急停、工业网络安全或现场认证流程

#### Scenario: README 描述协议能力
- **WHEN** README 描述工业通信架构
- **THEN** README SHALL 说明 Modbus TCP 使用 polling 和地址批量读取
- **AND** README SHALL 说明 OPC UA 优先使用 subscription 和 monitored item notification
- **AND** README SHALL 说明 Modbus TCP 是默认协议，OPC UA 是可选协议配置
- **AND** README SHALL 说明 OPC UA Simulator 默认 endpoint 为 `opc.tcp://127.0.0.1:4840/industrial-hmi-simulator`
- **AND** README SHALL 说明本期 OPC UA Simulator 默认 anonymous / no-security 仅用于本地模拟，不代表生产安全配置
- **AND** README SHALL 明确 Dashboard/ViewModel 通过 Tag 和 ViewModel 状态消费数据，不依赖底层协议类型

#### Scenario: README 描述性能验证边界
- **WHEN** README 描述性能测试
- **THEN** README SHALL 提供 100、500、1000 Tag profile 的运行方式和报告字段说明
- **AND** README SHALL 说明性能报告默认输出到 `reports/performance/`
- **AND** README SHALL 说明 long-run smoke profile 默认为 5-10 分钟，extended profile 默认为 30-120 分钟手工验收
- **AND** README SHALL NOT 写入未经脚本生成的固定性能数字

### Requirement: Industrial Business Scope Remains Deferred
系统 SHALL 明确区分已实现的模拟工业业务能力和仍然不属于本项目的真实生产现场能力。

#### Scenario: Product readiness 能力实施完成
- **WHEN** 维护者查看产品就绪基础能力
- **THEN** 项目 SHALL 保留多语言、帮助、更新检查、changelog 和发布打包能力
- **AND** 工业业务模拟能力 SHALL 以当前各业务 capability spec 为准，不再由本 requirement 统一声明延期

#### Scenario: Product hardening 能力实施完成
- **WHEN** 本 change 实施完成
- **THEN** 项目 MAY 包含 Modbus、OPC UA、PLC Simulator、Tag Polling、Alarm processing、Historian storage、Trend、Recipe、Permission 和 Audit 的模拟实现
- **AND** 文档、UI 和测试数据 SHALL 继续保持 PLC Simulator/学习项目语境

#### Scenario: 真实生产安全能力仍不声明
- **WHEN** 文档、Help、Demo、README 或 UI 文案描述项目用途
- **THEN** 系统 SHALL NOT 暗示已经部署于真实生产环境
- **AND** SHALL NOT 声称提供 Safety PLC、安全继电器、硬件联锁、急停、SIL、生产认证或现场网络安全合规能力

#### Scenario: Known limitations are explicit
- **WHEN** README 或 Help 文档描述 Known Limitations
- **THEN** 它 SHALL 明确列出 Simulator-only、OPC UA security/certificate 未作为生产配置实现、性能测试为本机采样、长期运行检查窗口有限、以及真实设备接入需要额外工程验证

## ADDED Requirements

### Requirement: Interview Demo Documentation
项目 SHALL 提供面试演示场景文档，使读者可以按步骤展示核心工业 HMI 能力。

#### Scenario: Demo index exists
- **WHEN** 读者在 README 或文档入口查找 Demo
- **THEN** 文档 SHALL 列出设备启动及实时监控、PLC 断线到 Bad Quality 到自动重连、高温报警确认恢复、历史趋势、Recipe Download、Modbus / OPC UA 协议切换六个 Demo

#### Scenario: Demo steps include prerequisites
- **WHEN** 某个 Demo 需要 Simulator、登录用户、权限、历史采集时间或协议配置
- **THEN** 文档 SHALL 在步骤开始前列出前置条件
- **AND** 不满足前置条件时 SHALL 提供可诊断的提示或回退说明

#### Scenario: Demo language stays simulator-scoped
- **WHEN** Demo 文档描述设备、报警、历史趋势、配方或协议切换
- **THEN** 文档 SHALL 使用模拟设备或 PLC Simulator 语境
- **AND** SHALL NOT 暗示该流程已经验证真实生产现场安全要求
