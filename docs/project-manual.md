# Industrial HMI Foundation 项目说明书

本文档说明 Industrial HMI Foundation 的开发目的、工程边界、模拟协议与真实协议关系，以及工业 HMI 项目中常见的通信、采集、报警、趋势、配方、权限和审计问题。

本项目是工业自动化 HMI 的学习、模拟、工程实践和面试展示项目。当前业务场景是自动化恒温混料设备监控与控制系统，设备侧由本项目提供的 Simulator 模拟。它不代表真实生产现场 Safety System，不替代 Safety PLC、安全继电器、硬件联锁、急停、SIL、生产认证或现场网络安全合规能力。

## 1. 开发目的

Industrial HMI Foundation 的目标是用一个可以运行、可以测试、可以演示的桌面应用，串起工业上位机项目中最容易被忽略的工程问题：

- Electron Main / Preload / Renderer 的安全边界。
- React + MobX + MVVM 的前端分层。
- Modbus TCP 和 OPC UA 这两类工业通信模型。
- Tag 统一点位模型、Quality、timestamp 和 stale value 处理。
- 周期采集、订阅采集、批量读取、IPC batching 和 UI refresh 分离。
- 设备状态机、超时、断线、自动重连和资源释放。
- CommandService、写入校验、read-back / verify 和防重复命令。
- 报警生命周期、Historian、实时趋势、历史趋势、Recipe、权限和 Audit。

这个项目适合用于学习工业 HMI 架构，也适合在面试中展示如何把桌面应用工程、工业通信和业务模型组织到同一个可维护系统里。

## 2. 本项目解决的问题

很多 HMI 示例只展示页面和按钮，不处理真实工程中的边界问题。本项目重点解决以下问题：

- 通信不放在 Renderer：PLC 通信、SQLite、协议库和系统资源全部放在 Electron Main Process。
- UI 不理解协议细节：View 和 ViewModel 消费 TagValue、设备状态、报警、趋势和命令结果，不理解 Modbus Function Code 或 OPC UA NodeId。
- 实时数据不只有 value：TagValue 同时包含 `quality` 和 `timestamp`，断线或超时时不会继续把旧值当作正常实时数据。
- 采集不是一个点位一个 timer：Modbus 由 PollingScheduler 按设备、采样周期、寄存器类型和连续地址分组批量读取。
- OPC UA 不强行伪装成 Modbus：OPC UA 默认使用 subscription / monitored item notification。
- 控制命令统一入口：Start、Stop、设定值和阀门控制都经过 CommandService、权限、审计、超时和验证。
- 报警、趋势、配方、权限和审计是 domain 能力，不是 UI 上临时拼出来的效果。

## 3. 模拟业务场景

当前模拟对象是自动化恒温混料设备，默认设备 ID 为 `simulated-mixer-plc`。它包含以下典型变量：

- Temperature：当前温度。
- Target Temperature / Setpoint：目标温度。
- Level：液位。
- Pressure：压力。
- Motor RPM：电机转速。
- Motor Running：电机运行状态。
- Inlet Valve：进料阀。
- Outlet Valve：出料阀。
- Production Count：生产计数。
- Operation Mode / Auto Mode：运行模式。

这些变量覆盖了工业 HMI 中常见的模拟量、数字量、可写设定值、反馈状态和生产统计。Simulator 只是测试设备，业务代码不能依赖 Simulator 内部实现。未来接入真实 PLC 时，业务层应继续通过 ProtocolAdapter、TagDefinition 和 CommandService 工作。

## 4. 总体架构

```text
PLC / PLC Simulator
        |
        | Modbus TCP / OPC UA
        v
Electron Main Process
        |
        | DeviceManager
        | IProtocolAdapter
        | TagAcquisitionCoordinator
        | PollingScheduler / OPC UA Subscription
        | TagService / TagCache
        | CommandService
        | AlarmEngine / HistorianService / Recipe / Permission / Audit
        v
Preload typed window.hmi API
        v
Renderer ViewModel
        v
React View
```

核心依赖方向是：

```text
View -> ViewModel -> Application / Domain Service -> Infrastructure
```

Renderer 不直接访问 Node.js、TCP、Modbus、OPC UA、SQLite 或 Electron Main-only API。Preload 只暴露最小 typed API，不暴露 raw `ipcRenderer`。

## 5. 模拟协议与真实协议映射

| 本项目能力 | 模拟对象 | 对应真实协议/设备 | 当前边界 |
| --- | --- | --- | --- |
| Modbus TCP Simulator | 本地 TCP 模拟 PLC | Modbus TCP PLC、远程 IO、工业网关 | 已实现，默认协议，使用 polling 和连续地址批量读取 |
| OPC UA Simulator | 本地 OPC UA Server | OPC UA Server、PLC、SCADA、工业网关 | 已实现，可选协议，默认 subscription，anonymous / no-security 仅用于本地模拟 |
| Modbus RTU | 当前未实现 runtime | RS-485 / RS-232 串口 Modbus RTU 设备 | 仅解释协议概念和未来接入方式，不声明当前已支持 |

Modbus TCP 和 OPC UA 都在 Main Process 的协议适配层内实现。Renderer、ViewModel、Alarm、Historian、Trend 和 Recipe 不直接依赖具体协议库。

## 6. 核心工程模型

### 6.1 Device State

设备连接状态至少包含：

- `Disconnected`
- `Connecting`
- `Connected`
- `Reconnecting`
- `Fault`

通信失败后系统进入 `Reconnecting` 并按受控 backoff 重试。手动断开进入 `Disconnected`。不可恢复错误进入 `Fault`。状态机避免用多个 boolean 拼接复杂连接状态。

### 6.2 Tag

`TagDefinition` 描述点位定义，包含 ID、名称、设备、地址、数据类型、比例、偏移、单位、是否可写和采样周期。

`TagValue` 描述实时值，包含：

- `tagId`
- `value`
- `quality`: `Good` / `Bad` / `Uncertain`
- `timestamp`

断线、超时或数据异常时可以保留 last value，但必须降级 quality 并更新时间，不能让 UI 继续把旧值当作 `Good` 数据。

### 6.3 Acquisition

Modbus TCP 默认由 PollingScheduler 周期采集。OPC UA 默认由 subscription 接收 monitored item notification。两类采集结果最终都进入 TagService 和 TagCache，后续再分发给报警、Historian、Trend、IPC 和 Renderer。

### 6.4 Command

所有写设备操作都通过 CommandService：

```text
View -> ViewModel -> typed IPC -> CommandService -> ProtocolAdapter -> PLC / Simulator
```

CommandService 负责 writable、类型、范围、设备状态、权限、忙碌状态、超时、写入结果、read-back / verify 和 Audit。

### 6.5 Alarm

报警是 Main Process domain，不是 UI toast。生命周期区分：

- `Inactive`
- `Active`
- `Acknowledged`
- `Recovered`

`Acknowledged` 只表示人已经确认报警，不表示工况已经恢复。`Recovered` 表示触发条件消失。

### 6.6 Historian 和 Trend

Historian 使用 SQLite 保存历史数据，通过 service/repository 隔离 SQL。历史采集支持固定周期、deadband 和 quality change，避免每次 polling 都写数据库。实时趋势使用有上限的 ring buffer，历史趋势从 SQLite 查询并限制返回规模。

### 6.7 Recipe

Recipe 是工业业务对象，不只是页面表单。下载流程是：

```text
Recipe -> Validate -> Generate Commands -> Write PLC -> Read-back / Verify -> Result
```

部分命令失败时，Recipe Download 不能返回整体成功。

### 6.8 Permission 和 Audit

Renderer 可以按权限控制按钮显示，但关键写操作仍必须由 Main Process / CommandService 做权威校验。关键操作进入 Audit Log，至少包含时间、用户、动作、目标、旧值、新值和结果。

## 7. 关键问题回答

### 怎么和 PLC / 设备通信？

真实项目中，上位机通常通过工业协议连接 PLC、远程 IO、变频器、仪表或工业网关。本项目在 Main Process 中通过 `IProtocolAdapter` 连接设备，当前实现 `ModbusAdapter` 和 `OpcUaAdapter`。

通信流程是：

```text
DeviceManager 建立连接
ProtocolAdapter 读写协议数据
TagService 解码为 TagValue
TagCache 批量更新
Alarm / Historian / Trend / Renderer 消费统一数据
```

UI 不直接连接 PLC。Renderer 只通过 typed `window.hmi` API 发起连接、断开、命令和订阅。

### 1. Modbus TCP / RTU 是什么？

Modbus 是常见工业通信协议。

Modbus TCP 运行在以太网上，通常使用 TCP 端口 `502`。它适合 PLC、远程 IO、网关和上位机之间的简单寄存器读写。本项目已实现 Modbus TCP Simulator 和 Modbus TCP adapter。

Modbus RTU 运行在串口链路上，常见物理层是 RS-485 或 RS-232。它使用站号、功能码、寄存器地址和 CRC 校验，常见于仪表、变频器和小型控制器。本项目当前未实现 Modbus RTU runtime，只在文档中解释概念。未来接入 RTU 时，应新增独立 adapter，并继续保持 Renderer 不直接访问串口。

### 2. OPC UA 是什么？

OPC UA 是面向工业自动化的数据建模和通信协议。它不只是寄存器读写，还能表达对象、变量、数据类型、状态码、命名空间和订阅。

本项目已实现本地 OPC UA Simulator 和 `OpcUaAdapter`。默认 endpoint 是：

```text
opc.tcp://127.0.0.1:4840/industrial-hmi-simulator
```

当前 OPC UA Simulator 使用 anonymous / no-security，只用于本地学习和测试，不代表生产 OPC UA 证书、安全策略或用户认证配置。

### 3. 怎么做周期采集？

周期采集不能一个 Tag 一个 `setInterval`。本项目由 PollingScheduler 统一管理 Modbus polling，并按以下维度分组：

- device
- scanRate
- registerType
- address continuity

例如连续 Holding Register 会合并成一次批量读取。读取结果进入 TagService 做 scale / offset / data type 解码，然后批量更新 TagCache。

### 4. 1000 个点位怎么处理？

1000 个点位不能逐点读、逐点发 IPC、逐点触发 React render。本项目的处理思路是：

- 点位按 scanRate、寄存器类型和连续地址分组。
- Modbus 对连续地址做 batch read。
- OPC UA 使用 monitored item subscription 接收批量 notification。
- TagCache 批量更新。
- IPC publisher 做 batch/throttle。
- Renderer ViewModel 消费批量状态，UI refresh 与 PLC sampling 分离。
- 性能 profile 覆盖 100、500、1000 Tag，并输出 request count、duration、CPU、memory、IPC message rate、Renderer update rate 等字段。

README 不写固定性能数字，真实结果以 `reports/performance/` 下脚本生成报告为准。

### 5. 设备断线怎么办？

设备断线后，DeviceManager 会更新状态并触发受控重连。TagCache 可以保留 last value，但 Tag Quality 必须降级为 `Bad` 或 `Uncertain`，避免 UI 继续展示正常实时数据。

自动重连使用 backoff，例如 1s、2s、4s、8s、10s。重新连接成功后需要恢复 polling 或 subscription，并重新产生 `Good` quality 的新数据。

### 6. 怎么避免 UI 被通信阻塞？

通信在 Electron Main Process 中运行，Renderer 只做 UI 和 ViewModel。协议库、TCP、OPC UA session、SQLite 和文件系统不进入 Renderer。

Main 与 Renderer 之间通过 typed IPC 传递受控 DTO。高频实时数据经过 batch/throttle 后再发给 Renderer，避免通信请求阻塞 React render 或造成高频 IPC。

### 7. 实时数据怎么刷新？

实时数据流程是：

```text
Protocol acquisition -> TagService -> TagCache -> IPC batch -> ViewModel -> React View
```

PLC sampling rate 和 UI refresh rate 是两个概念。采集可以按 100ms、500ms、1000ms 等 scan group 执行，UI 可以按更适合渲染的节奏批量刷新。这样既保证数据正确，也避免 UI 因每个 Tag 变化都 render。

### 8. 怎么做报警？

报警由 AlarmEngine 在 Main Process 中处理。报警规则可以包含 threshold、level、delay、debounce、timestamp 和 triggerValue。

报警生命周期是：

```text
Inactive -> Active -> Acknowledged -> Recovered
```

确认报警不等于恢复报警。操作员 acknowledge 后，如果温度仍然超限，报警仍是已确认但未恢复。只有触发条件消失并满足 debounce 规则后才进入 recovered。

### 9. 历史趋势怎么保存？

历史数据由 HistorianService 写入 SQLite。写入策略支持：

- first sample
- fixed interval
- deadband
- quality change

趋势分为实时趋势和历史趋势。实时趋势使用 bounded ring buffer，不无限增长。历史趋势从 SQLite 查询，并设置查询时间范围和数据量上限。

### 10. 如何控制 PLC？

UI 控制 PLC 时不直接写寄存器或 NodeId，而是调用 ViewModel 方法。ViewModel 通过 typed IPC 请求 Main，Main 中的 CommandService 做校验后调用 ProtocolAdapter。

控制流程是：

```text
View -> ViewModel -> IPC -> Permission -> CommandService -> ProtocolAdapter -> Read-back / Verify -> Result -> Audit
```

CommandService 会区分“通信写入成功”和“设备状态达到目标”。例如写入目标温度成功不代表温度已经达到目标温度。

### 11. 怎么防止重复下发命令？

防重复命令需要在 Main Process 权威处理，而不是只禁用按钮。本项目通过 CommandService 管理命令状态：

- 校验设备是否 connected。
- 校验用户权限。
- 校验 Tag 是否 writable。
- 校验 value type 和 range。
- 对同一目标或同类命令设置 busy / pending 状态。
- 对命令设置 timeout。
- 写入后做 read-back 或反馈验证。
- 记录 succeeded、rejected、busy、timeout、verify failed 等结果。

Renderer 可以禁用按钮提升体验，但不能作为唯一防护。

### 12. PLC 通信线程和 UI 怎么隔离？

Electron 没有把 PLC 通信放到 Renderer。Main Process 负责工业通信、SQLite、日志、更新检查和系统资源。Renderer 负责 React View 和 ViewModel。

隔离边界是 Preload：

- `contextIsolation` 保持开启。
- `nodeIntegration` 保持关闭。
- Preload 只暴露 `window.hmi` 的 typed API。
- Renderer 不获得 raw `ipcRenderer`、`require` 或协议客户端。

如果未来通信压力更高，可以在 Main Process 内进一步引入 worker thread 或独立进程，但 UI 与通信的安全边界仍然不变。

### 13. 如何处理设备异常、超时、重连？

设备通信需要处理 connect timeout、request timeout、invalid response、malformed data、disconnect、reconnect 和 cleanup。

本项目的处理方式是：

- ProtocolAdapter 把底层错误转换成统一通信错误。
- DeviceManager 更新设备状态。
- TagCache 将相关 Tag quality 降级。
- PollingScheduler 或 subscription 停止或重建。
- 重连使用受控 backoff。
- disconnect、Fault、dispose 时释放 timer、socket、session、subscription、listener 和数据库相关资源。

底层错误不直接暴露给 UI，例如不让 Renderer 直接看到 `ECONNRESET`，而是展示设备通信状态和可理解的业务错误。

### 14. 配方是什么？

Recipe 是一组工业生产参数和控制目标，例如目标温度、搅拌转速、阀门策略和运行模式。Recipe 不是普通表单保存，它需要下载到设备并验证结果。

Recipe Download 流程是：

```text
Recipe -> Validate -> Generate Commands -> CommandService -> Write -> Read-back / Verify -> Result
```

如果部分参数写入失败，Recipe Download 必须返回明细结果，不能返回整体成功。

### 15. 点位 Tag 是怎么管理的？

Tag 是工业数据的统一模型。`TagDefinition` 管理点位定义，包含设备、地址、数据类型、比例、偏移、单位、采样周期和可写性。`TagValue` 管理实时值，包含 value、quality 和 timestamp。

Modbus Tag 可以绑定 register area 和 address。OPC UA Tag 可以绑定 NodeId、value type 和 sampling interval。业务层消费统一 Tag，不直接理解底层协议地址。

### 16. 操作员、工程师权限怎么区分？

权限不能只靠隐藏按钮。Renderer 可以根据权限隐藏或禁用 UI，但 Main Process / CommandService 必须做权威校验。

默认角色思路是：

- Operator：执行日常启停、确认报警、查看趋势和执行允许范围内的操作。
- Engineer：修改工艺设定、Recipe、部分设备配置和更高风险控制项。
- Admin：管理用户、权限和关键系统配置。

具体权限矩阵以项目内 Permission 模块和测试为准。

### 17. 怎么记录操作日志？

关键操作进入 Audit Log。典型字段包括：

- timestamp
- user
- action
- target
- oldValue
- newValue
- result

典型审计操作包括 Start、Stop、Setpoint Change、Valve Control、Recipe Download、Alarm Acknowledge 和 Configuration Change。通信日志和应用日志用于排查设备连接、请求、响应、超时、重连和命令失败，但不记录密码或 token。

## 8. Demo 与验证

常用 Demo：

1. 设备启动及实时监控。
2. PLC 断线 -> Bad Quality -> 自动重连。
3. 高温报警 -> Acknowledge -> Recover。
4. 历史趋势查询。
5. Recipe Download。
6. Modbus / OPC UA 协议切换。

常用验证命令：

```bash
yarn typecheck
yarn lint
yarn test
yarn build
```

OpenSpec 验证：

```bash
openspec validate refresh-app-icon-project-docs --strict
openspec validate --all --strict
git diff --check
```

性能和长期运行：

```bash
yarn perf:profile --tags 100,500,1000 --durationMs 5000
yarn longrun:smoke
```

性能报告默认输出到 `reports/performance/`。报告数据必须来自脚本实际运行，不手工写固定结论。

## 9. 已知边界

- 本项目是 Simulator-first 的学习和工程实践项目。
- 当前不代表真实生产现场 Safety System。
- 当前不提供 Safety PLC、安全继电器、硬件联锁、急停、SIL、生产认证或现场网络安全合规能力。
- OPC UA 默认 anonymous / no-security，仅用于本地模拟。
- Modbus RTU 当前未实现 runtime。
- 真实设备接入需要额外的网络、安全、协议、权限、现场验收和异常工况验证。
- 性能 profile 是本机采样，不代表生产 benchmark。
- Long-run smoke 未发现问题不等于证明不存在泄漏，发布或演示前应按需运行 30-120 分钟 extended profile。
