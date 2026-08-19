# Industrial HMI Foundation

Industrial HMI Foundation 是一个基于 Electron 的工业自动化上位机 / HMI 学习、模拟和工程实践项目。当前业务场景是自动化恒温混料设备监控与控制系统，设备侧由本项目提供的 Simulator 模拟。

本项目不代表真实生产现场 Safety System，不包含安全 PLC、硬件联锁、SIL/PL 认证、真实 OPC UA 证书策略或生产控制授权模型。所有通信和控制能力仅用于学习、模拟、测试和面试演示。

## 1. 项目介绍

项目覆盖桌面 HMI 的典型工程边界：Electron Main / Preload / Renderer 分层、React + MobX MVVM、受控 IPC、工业通信抽象、Tag 实时数据、设备状态机、报警、趋势、Historian、Recipe、权限和审计。

默认设备是 `simulated-mixer-plc`，可通过 Modbus TCP Simulator 或 OPC UA Simulator 连接。

## 2. Architecture

```text
PLC / Simulator
        |
        | Modbus TCP / OPC UA
        v
Electron Main Process
        |
        | DeviceManager / IProtocolAdapter / TagAcquisitionCoordinator
        | TagService / TagCache / CommandService
        | AlarmEngine / HistorianService / Recipe / Permission / Audit
        v
Preload typed window.hmi API
        v
Renderer ViewModel
        v
React View
```

Renderer 不直接访问 TCP、Modbus、OPC UA、SQLite、Node.js 或 Main Process adapter。通信能力只在 Main Process 的协议层和业务服务中运行。

## 3. Technology Stack

- Electron
- React
- TypeScript
- MobX
- MVVM
- SQLite / better-sqlite3
- Modbus TCP
- OPC UA / node-opcua
- Vitest
- OpenSpec

## 4. 工业通信架构

协议接入通过 `IProtocolAdapter`：

- `ModbusAdapter`：默认协议，适合周期 polling 和连续地址 batching。
- `OpcUaAdapter`：可选协议，优先使用 subscription / monitored item。
- `ProtocolAdapterCapabilities`：描述协议支持 polling、subscription、batch read、write、read-back、timeout 和订阅规模。

`DeviceManager`、`TagService`、`CommandService`、Dashboard 和 ViewModel 不直接依赖具体协议库。

## 5. Modbus Mapping

Modbus 使用 human reference address 和 PDU zero-based address：

- Coil: `00001` 对应 PDU `0`
- Discrete Input: `10001` 对应 PDU `0`
- Input Register: `30001` 对应 PDU `0`
- Holding Register: `40001` 对应 PDU `0`

默认点位包括 Temperature、Level、Pressure、RPM、Production Count、Running feedback、Auto Mode、Target Temperature 和 Manual RPM Setpoint。

## 6. Tag Model

`TagDefinition` 描述逻辑 Tag：`id`、`name`、`deviceId`、地址、数据类型、scale、offset、unit、writable、scanRate 和显示角色。

`TagValue` 必须包含：

- `tagId`
- `value`
- `quality`: `Good` / `Bad` / `Uncertain`
- `timestamp`

断线、超时或采集失败时可以保留 last value，但必须把 quality 降级，不能让 UI 把旧值当作正常实时值。

## 7. Polling Architecture

Modbus 默认走 `PollingScheduler`：

- 按 device、scanRate、registerType、连续地址分组。
- 禁止一个 Tag 一个 timer。
- 避免把 UI refresh rate 等同于 PLC sampling rate。
- TagCache 批量分发，IPC publisher 做 batch/throttle。

OPC UA 默认不强行模拟成 Modbus polling，而是由 `TagAcquisitionCoordinator` 根据 adapter capability 选择 subscription。

## 8. Device State Machine

设备状态：

- `Disconnected`
- `Connecting`
- `Connected`
- `Reconnecting`
- `Fault`

通信失败从 `Connected` 进入 `Reconnecting`，使用受控 backoff；手动断开进入 `Disconnected`；不可恢复错误进入 `Fault`。

## 9. Alarm Lifecycle

报警是 Main Process domain，不是 UI toast。生命周期区分：

- `Inactive`
- `Active`
- `Acknowledged`
- `Recovered`

`Acknowledged != Recovered`。报警规则支持 threshold、delay、debounce、triggerValue、timestamp 和 non-Good quality 行为。

## 10. Historian

Historian 使用 SQLite，通过 repository/service 隔离 SQL。历史采集支持 first sample、fixed interval、deadband 和 quality change，避免把每次 polling 全量写入数据库。

实时趋势使用 bounded ring buffer；历史趋势从 SQLite 查询并对大范围数据做聚合/上限控制。

## 11. Recipe

Recipe 是工业业务对象，不只是表单。下载流程：

```text
Recipe -> Validate -> Generate Commands -> CommandService -> ProtocolAdapter -> Read-back / Verify -> Result
```

部分写入失败不能返回整体成功；关键控制操作进入 Audit。

## 12. OPC UA

默认 OPC UA Simulator endpoint：

```text
opc.tcp://127.0.0.1:4840/industrial-hmi-simulator
```

默认变量：

- `Temperature`
- `Level`
- `RPM`
- `Running`
- `Setpoint`

扩展变量还包括 Pressure、ProductionCount、MotorRunning、InletValve、OutletValve、AutoMode 和 ManualRpmSetpoint。OPC UA 本地 simulator 使用 anonymous / no-security，仅用于学习和本地测试，不是生产安全配置。

## 13. 如何运行 Simulator

安装依赖：

```bash
yarn install
```

启动 Modbus TCP Simulator：

```bash
yarn simulator:start
```

启动 OPC UA Simulator：

```bash
yarn simulator:opcua:start
```

运行大规模 Tag profile：

```bash
yarn perf:profile --tags 100,500,1000 --durationMs 5000
```

运行长期 smoke profile：

```bash
yarn longrun:smoke
```

短时间验证可传：

```bash
yarn longrun:smoke --durationMs 30000
```

## 14. Demo步骤

Demo 1：设备启动及实时监控

1. 启动 simulator。
2. 打开 HMI，进入 Device，Connect。
3. 点击 Start，观察 Dashboard/Device Tag Monitor 的 Temperature、Level、RPM、Running。

Demo 2：PLC 断线 -> Bad Quality -> 自动重连

1. 连接后在 simulator CLI 输入 `disconnect`。
2. 观察 Device 状态进入 `Reconnecting`，Tag Quality 变为 `Bad`。
3. 输入 `recover`，观察自动重连后 Quality 恢复 `Good`。

Demo 3：高温 -> Alarm -> Acknowledge -> Recover

1. 写入较高 Target Temperature。
2. 等待 Temperature 触发高温报警。
3. 在 Alarm 页面 acknowledge。
4. 降低设定值，等待过程恢复。

Demo 4：历史趋势

1. 连接设备并保持运行。
2. 进入 Trend 页面查看实时趋势。
3. 查询历史趋势，验证 SQLite historian 数据。

Demo 5：Recipe Download

1. 进入 Recipe 页面创建或选择配方。
2. 执行 Download。
3. 查看 CommandService read-back / verify 和 Audit 结果。

Demo 6：Modbus / OPC UA 协议切换

1. Settings 中选择 Modbus TCP 或 OPC UA。
2. 应用配置后重新 Connect。
3. Dashboard/ViewModel 不需要知道底层协议类型，仍消费统一 TagValue。

## 15. Testing

常规检查：

```bash
yarn typecheck
yarn lint
yarn test
yarn build
```

OpenSpec 检查：

```bash
openspec validate add-opcua-production-hardening --strict
openspec validate --all --strict
git diff --check
```

性能报告输出到 `reports/performance/`，该目录的原始报告默认不纳入 git。README 不记录固定性能数字；以脚本生成的 JSON / Markdown 报告为准。

## 16. Known Limitations

- 本项目是工业自动化学习及模拟项目，不代表真实生产现场 Safety System。
- OPC UA 默认 anonymous / no-security，不适用于生产环境。
- Simulator 不代表任何真实 PLC vendor profile。
- 性能脚本是本地 profile，不是生产 benchmark。
- Long-run smoke 未发现问题不等于证明不存在泄漏；30-120 分钟 extended profile 需要手工运行和记录。
- UI 配置目前面向单个默认 simulated mixer device。
