# Industrial HMI Foundation

Industrial HMI Foundation 是一个基于 Electron 的工业自动化上位机 / HMI 学习、模拟和工程实践项目。当前业务场景是自动化恒温混料设备监控与控制系统，设备侧由本项目提供的 Simulator 模拟。

本项目不代表真实生产现场 Safety System，不包含 Safety PLC、安全继电器、硬件联锁、急停、SIL/PL 认证、真实 OPC UA 证书策略、生产控制授权模型或现场网络安全合规能力。所有通信和控制能力仅用于学习、模拟、测试和面试演示。

应用图标使用工业 HMI 面板、趋势图和设备控制元素作为品牌视觉，项目内打包资产位于 `build/icon.png`、`build/icon.icns` 和 `build/icon.ico`。

掘金推广文章草稿见 [docs/articles/juejin-industrial-hmi-foundation.md](docs/articles/juejin-industrial-hmi-foundation.md)。该文章面向外部项目展示和技术社区发布，集中介绍 Electron + React 工业 HMI 学习项目的架构、截图、Demo 路线和工程边界。

详细项目说明书见 [docs/project-manual.md](docs/project-manual.md)，也可以在应用内通过 `帮助 -> 项目说明书` 离线查看。该文档逐条回答 PLC/设备通信、Modbus TCP/RTU、OPC UA、周期采集、1000 点位、断线重连、UI 隔离、实时刷新、报警、历史趋势、PLC 控制、防重复命令、通信线程隔离、异常超时重连、配方、Tag 管理、权限和操作日志等问题。

## 1. 项目介绍

项目覆盖桌面 HMI 的典型工程边界：Electron Main / Preload / Renderer 分层、React + MobX MVVM、受控 IPC、工业通信抽象、Tag 实时数据、设备状态机、报警、趋势、Historian、Recipe、权限和审计。

默认设备是 `simulated-mixer-plc`，可通过 Modbus TCP Simulator 或 OPC UA Simulator 连接。Modbus TCP 是默认协议，OPC UA 是可选协议。Modbus RTU 是真实工业串口协议形态，但当前项目未实现 RTU runtime。

## Showcase

项目当前可演示的亮点：

- Electron Main / Preload / Renderer 边界清晰，Renderer 不直接访问 Node.js、TCP、Modbus、OPC UA 或 SQLite。
- Modbus TCP 采用 polling、scan group 和连续地址批量读取；OPC UA 默认走 subscription / monitored item notification。
- 实时数据统一进入 Tag 模型，`TagValue` 同时包含 value、quality 和 timestamp。
- Device State、CommandService、Alarm、Historian、Trend、Recipe、Permission 和 Audit 都作为独立工程模型展示。
- Simulator-first 演示路径完整：Settings 启动 Simulator，Device Connect，Dashboard/Trend/Alarm/Recipe/Audit 展示业务闭环。

界面截图位于 [docs/assets/juejin](docs/assets/juejin)，对应页面如下：

当前截图索引覆盖 Dashboard、Device、Alarm、Trend、Recipe、Audit、User Management、Tag Management 和 Settings 页面。

| 页面 | 截图 | 展示重点 |
| --- | --- | --- |
| Dashboard | [dashboard-logged-in.png](docs/assets/juejin/dashboard-logged-in.png) / [dashboard-logged-out.png](docs/assets/juejin/dashboard-logged-out.png) | 过程值、运行状态、登录状态 |
| Device | [device-disconnected.png](docs/assets/juejin/device-disconnected.png) / [device-connected.png](docs/assets/juejin/device-connected.png) | 设备连接状态、Tag Monitor、Quality |
| Alarm | [alarm-history.png](docs/assets/juejin/alarm-history.png) | 实时报警、历史报警、确认记录 |
| Trend | [trend-realtime.png](docs/assets/juejin/trend-realtime.png) | 实时趋势、历史趋势入口 |
| Recipe | [recipe-management.png](docs/assets/juejin/recipe-management.png) | 配方编辑、下载结果 |
| Audit | [audit-log.png](docs/assets/juejin/audit-log.png) | 关键控制操作审计 |
| User Management | [user-management.png](docs/assets/juejin/user-management.png) | 本地用户、角色、启用状态 |
| Tag Management | [tag-management.png](docs/assets/juejin/tag-management.png) | Tag 管理入口和后续配置边界 |
| Settings | [settings-simulator.png](docs/assets/juejin/settings-simulator.png) | 协议配置、日志开关、Simulator 启停 |

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

Renderer 不直接访问 TCP、Modbus、OPC UA、SQLite、Node.js 或 Main Process adapter。通信能力只在 Main Process 的协议层和业务服务中运行。Preload 只暴露受控 typed `window.hmi` API，不暴露 raw `ipcRenderer`。

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
- Yarn 1.x

## 4. 工业通信架构

协议接入通过 `IProtocolAdapter`：

- `ModbusAdapter`：默认协议，适合周期 polling 和连续地址 batching。
- `OpcUaAdapter`：可选协议，优先使用 subscription / monitored item notification。
- `ProtocolAdapterCapabilities`：描述协议支持 polling、subscription、batch read、write、read-back、timeout 和订阅规模。

`DeviceManager`、`TagService`、`CommandService`、Dashboard 和 ViewModel 不直接依赖具体协议库。Dashboard/ViewModel 只消费 Tag、设备状态和命令结果，不根据协议类型分支处理数据。

## 5. 模拟协议与真实协议

| 本项目能力 | 模拟对象 | 对应真实协议/设备 | 当前边界 |
| --- | --- | --- | --- |
| Modbus TCP Simulator | 本地 TCP 模拟 PLC | Modbus TCP PLC、远程 IO、工业网关 | 已实现，默认协议，使用 polling 和地址批量读取 |
| OPC UA Simulator | 本地 OPC UA Server | OPC UA Server、PLC、SCADA、工业网关 | 已实现，可选协议，默认 subscription |
| Modbus RTU | 当前未实现 runtime | RS-485 / RS-232 串口 Modbus RTU 设备 | 仅说明协议概念和未来接入方式 |

OPC UA Simulator 默认 endpoint：

```text
opc.tcp://127.0.0.1:4840/industrial-hmi-simulator
```

本地 OPC UA Simulator 默认 anonymous / no-security，仅用于学习和本地测试，不代表生产安全配置。

## 6. Modbus Mapping

Modbus 使用 human reference address 和 PDU zero-based address：

- Coil: `00001` 对应 PDU `0`
- Discrete Input: `10001` 对应 PDU `0`
- Input Register: `30001` 对应 PDU `0`
- Holding Register: `40001` 对应 PDU `0`

默认点位包括 Temperature、Level、Pressure、RPM、Production Count、Running feedback、Auto Mode、Target Temperature 和 Manual RPM Setpoint。

## 7. Tag Model

`TagDefinition` 描述逻辑 Tag：`id`、`name`、`deviceId`、地址、数据类型、scale、offset、unit、writable、scanRate 和显示角色。

`TagValue` 必须包含：

- `tagId`
- `value`
- `quality`: `Good` / `Bad` / `Uncertain`
- `timestamp`

断线、超时或采集失败时可以保留 last value，但必须把 quality 降级，不能让 UI 把旧值当作正常实时值。

## 8. Polling Architecture

Modbus 默认走 `PollingScheduler`：

- 按 device、scanRate、registerType、连续地址分组。
- 禁止一个 Tag 一个 timer。
- 避免把 UI refresh rate 等同于 PLC sampling rate。
- TagCache 批量分发，IPC publisher 做 batch/throttle。

OPC UA 默认不强行模拟成 Modbus polling，而是由 `TagAcquisitionCoordinator` 根据 adapter capability 选择 subscription。

100、500、1000 Tag profile 可通过性能脚本运行。README 不记录固定性能数字，真实结果以 `reports/performance/` 下脚本生成的 JSON / Markdown 报告为准。

## 9. Device State Machine

设备状态：

- `Disconnected`
- `Connecting`
- `Connected`
- `Reconnecting`
- `Fault`

通信失败从 `Connected` 进入 `Reconnecting`，使用受控 backoff；手动断开进入 `Disconnected`；不可恢复错误进入 `Fault`。断线后相关 Tag quality 会降级，恢复采集后才重新显示 `Good`。

## 10. Alarm Lifecycle

报警是 Main Process domain，不是 UI toast。生命周期区分：

- `Inactive`
- `Active`
- `Acknowledged`
- `Recovered`

`Acknowledged != Recovered`。报警规则支持 threshold、delay、debounce、triggerValue、timestamp 和 non-Good quality 行为。

## 11. Historian

Historian 使用 SQLite，通过 repository/service 隔离 SQL。历史采集支持 first sample、fixed interval、deadband 和 quality change，避免把每次 polling 全量写入数据库。

实时趋势使用 bounded ring buffer；历史趋势从 SQLite 查询并对大范围数据做聚合和上限控制。

## 12. Recipe

Recipe 是工业业务对象，不只是表单。下载流程：

```text
Recipe -> Validate -> Generate Commands -> CommandService -> ProtocolAdapter -> Read-back / Verify -> Result
```

部分写入失败不能返回整体成功；关键控制操作进入 Audit。

## 13. 如何运行 Simulator

安装依赖：

```bash
yarn install
```

普通演示路径：

1. 启动应用开发环境。
2. 进入 Settings 页面，在 `Simulator` 区域启动 Modbus TCP 或 OPC UA Simulator。
3. 回到 Device 页面执行 Connect。启动 Simulator 只是准备本地测试端点，不等于连接设备；设备连接仍由 DeviceManager 流程完成。

```bash
yarn dev
```

维护者、自动化测试和独立协议验证仍可使用脚本启动 Modbus TCP Simulator：

```bash
yarn simulator:start
```

或启动 OPC UA Simulator：

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

## 14. Demo 步骤

Demo 1：设备启动及实时监控

1. 启动 simulator。
2. 打开 HMI，进入 Device，Connect。
3. 点击 Start，观察 Dashboard / Device Tag Monitor 的 Temperature、Level、RPM、Running。

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
openspec validate <change-id> --strict
openspec validate --all --strict
git diff --check
```

性能报告输出到 `reports/performance/`，该目录的原始报告默认不纳入 git。long-run smoke profile 默认为 5-10 分钟，extended profile 默认为 30-120 分钟手工验收。

## 16. 文档入口

- [掘金推广文章草稿](docs/articles/juejin-industrial-hmi-foundation.md)：面向技术社区发布和外部项目展示，配合截图说明项目架构、Demo 路线和工程边界。
- [项目说明书](docs/project-manual.md)：详细解释开发目的、解决的问题、协议映射和关键工程问答；应用内 `帮助 -> 项目说明书` 可离线查看同源内容。
- 应用内 `帮助 -> 使用说明书`：离线操作说明。
- 应用内 `帮助 -> 版本更新说明`：从内置 `CHANGELOG.md` 展示版本变化。
- [docs/modbus-plc-simulator.md](docs/modbus-plc-simulator.md)：Modbus Simulator 说明。
- [docs/opcua-dependency-review.md](docs/opcua-dependency-review.md)：OPC UA 依赖评审。

## 17. Known Limitations

- 本项目是工业自动化学习及模拟项目，不代表真实生产现场 Safety System。
- OPC UA 默认 anonymous / no-security，不适用于生产环境。
- Modbus RTU 当前未实现 runtime。
- Simulator 不代表任何真实 PLC vendor profile。
- 性能脚本是本地 profile，不是生产 benchmark。
- Long-run smoke 未发现问题不等于证明不存在泄漏。
- UI 配置目前面向单个默认 simulated mixer device。
- 真实设备接入需要额外的现场网络、安全、协议、权限、验收和异常工况验证。
