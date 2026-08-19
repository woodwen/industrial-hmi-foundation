# M-13(feat): 增加 OPC UA 协议与生产加固

OpenSpec Change: add-opcua-production-hardening

背景:
- Industrial HMI 已具备 Modbus TCP、Tag 采集、设备控制、报警、历史趋势、配方、权限和审计等模拟能力，需要验证 `IProtocolAdapter` 是否能承载第二种工业协议。
- 本期目标是在不大规模重写现有业务层的前提下接入 OPC UA，并补齐性能、长期运行、测试和项目文档，服务面试演示和工程可信度。

调查结论:
- Modbus TCP 更适合 polling 和连续地址批量读取；OPC UA 更适合 subscription 和 monitored item notification，不能为了统一接口把 OPC UA 强行伪装成 Modbus polling。
- `node-opcua-debug` 请求的 `hexy@0.4.0` 在 Electron 33 / Node 20 下会触发 ESM require 错误，已通过 Yarn `resolutions` 固定 `hexy@0.3.5` 并用 Electron runtime 验证。

方案概述:
- 扩展协议抽象、capability、协议绑定和 adapter factory，保持 `DeviceManager`、`TagService`、采集层和 `CommandService` 依赖协议无关接口。
- 新增 `OpcUaAdapter` 和独立 OPC UA Simulator；Modbus TCP 保持默认协议和现有 polling/batching 路径，OPC UA 默认走 subscription。
- 新增协议切换配置、性能 profile、long-run smoke、README 和 OpenSpec 主 specs 更新。

实现改动:
- 新增 `ProtocolKind`、`ProtocolAdapterCapabilities`、Modbus/OPC UA binding、`TagAcquisitionCoordinator`、`OpcUaAdapter` 和 OPC UA Simulator。
- 调整 Main/Preload/Renderer typed API，使 Settings 可以提交受控协议配置，Dashboard/ViewModel 不理解底层协议类型。
- `CommandService` 使用 logical command + protocol binding 执行 Modbus / OPC UA 写入，并保留 permission、audit、range、timeout 和 read-back 验证。
- 新增 `scripts/run-performance-profile.mjs`、`scripts/run-long-run-smoke.mjs`、`reports/performance/.gitkeep` 和相关测试。
- 更新 README、模块 README、Help 文档、Changelog、OpenSpec 主 specs，并归档 change 到 `openspec/changes/archive/2026-08-19-add-opcua-production-hardening`。

测试计划(UT):
- `openspec validate add-opcua-production-hardening --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `yarn typecheck`
- `yarn lint`
- `yarn test`
- `yarn build`
- `yarn simulator:build`
- `ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron -e "require('node-opcua'); console.log('node-opcua ok')"`
- `yarn smoke:start`
- `yarn perf:profile --tags 100,500,1000 --durationMs 1000`
- `yarn longrun:smoke --durationMs 5000 --reconnectDelayMs 200 --tags 100`

影响范围(建议手动测试范围):
- 协议配置：Settings 中 Modbus TCP 默认配置、OPC UA endpoint 配置和配置切换后的连接状态。
- 设备通信：Modbus Simulator、OPC UA Simulator、断线重连、Bad Quality 恢复和命令写入验证。
- 实时数据链路：TagCache、AlarmEngine、Historian、Trend、IPC batching 和 Renderer update throttle。
- 面试演示：设备启动监控、断线重连、高温报警确认恢复、历史趋势、Recipe Download、Modbus / OPC UA 协议切换。

风险与后续:
- OPC UA 仍限定为本地 anonymous / no-security simulator 配置，不包含生产证书、用户身份、namespace discovery、vendor profile 或 method call。
- 性能和 long-run 报告是本机采样结果，不能伪装成生产 SLA；30-120 分钟 extended profile 仍建议在面试前或发布前手工执行。
- `reports/performance/` 下 timestamped 原始报告按 `.gitignore` 保留在本地，不随 commit 提交。
