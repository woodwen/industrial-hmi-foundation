# Modbus PLC Simulator

本文档记录 `add-modbus-plc-simulator` change 引入的模拟 PLC 与 Modbus TCP 手工验证路径。

## Scope

当前版本用于验证协议链路：

- 独立 PLC Simulator，可脱离 Electron HMI 启动。
- Modbus TCP Server 默认监听 `127.0.0.1:1502`，Unit ID `1`。
- Electron Main Process 通过 `DeviceManager -> IProtocolAdapter -> ModbusAdapter` 连接模拟 PLC。
- Renderer 只通过 Preload 暴露的 `window.hmi.devices` typed API 操作设备。
- Device 页面支持 Connect、Disconnect、Connection Status、手工读取和受控写入。
- 本期未新增 Modbus 生产依赖，采用 Node TCP 实现轻量 Modbus TCP client/server，便于控制 Electron Main Process 和独立 Simulator 的打包边界。

`add-modbus-plc-simulator` 本身不实现以下能力；其中 Tag 模型、TagCache、周期采集和 Dashboard 实时监控已在后续 `add-tag-polling-monitoring` change 中实现，见 `docs/tag-polling-monitoring.md`。设备状态机、自动重连、CommandService 和 fault injection 已在 `add-device-control-resilience` change 中实现，见 `docs/device-control-resilience.md`。

- Alarm
- Historian
- Recipe
- OPC UA

## Start And Stop

启动模拟器：

```bash
yarn simulator:start
```

停止模拟器：

```text
stop
```

也可以在模拟器终端中使用 `exit`、`quit`，或发送 `SIGINT` / `SIGTERM`。

## Configuration

可通过环境变量覆盖默认配置：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `HMI_SIMULATOR_HOST` | `127.0.0.1` | Simulator 监听地址 |
| `HMI_SIMULATOR_PORT` | `1502` | Simulator 监听端口 |
| `HMI_SIMULATOR_UNIT_ID` | `1` | Modbus Unit ID |
| `HMI_SIMULATOR_TICK_MS` | `250` | 过程模型 tick 间隔 |

Electron HMI 当前默认连接 `127.0.0.1:1502` / Unit ID `1`。如果修改模拟器端口，后续也需要扩展设备配置能力；本期保持单一默认设备。

## Fault Controls

模拟器故障命令只通过控制台触发，不占用业务寄存器：

| 命令 | 行为 |
| --- | --- |
| `status` | 输出 Simulator 当前 listening/faulted/endpoint 状态 |
| `disconnect` | 关闭 Modbus TCP Server，保留内存和过程状态 |
| `recover` | 重新启动 Modbus TCP Server，继续使用保留的内存和过程状态 |
| `delay <ms>` | 为 read/write response 增加固定响应延迟 |
| `delay off` | 清除响应延迟 |
| `write-fail once` | 下一次写请求返回 Modbus exception |
| `write-fail on` | 持续写失败 |
| `write-fail off` | 清除写失败 |
| `network-error` | 中断 active socket；无连接时中断下一次请求 |
| `clear-faults` | 清除 delay / write failure / pending network error |
| `stop` | 停止 TCP Server 和过程模型；下次完整启动恢复初始值 |

## Initial Values

| 点位 | 初始值 |
| --- | --- |
| 当前温度 | `25.0 °C` |
| 目标温度 | `60.0 °C` |
| 当前液位 | `40.0 %` |
| 当前压力 | `0.12 MPa` |
| 电机转速 | `0 rpm` |
| 生产计数 | `0` |
| 所有 Coil / Discrete Input | `OFF` |

## Modbus Address Mapping

代码内部使用 Modbus PDU zero-based address；文档和 UI 同时展示工业常用 reference address。

### Coil

| 点位 ID | 名称 | Reference Address | PDU Address | 数据类型 | 访问 |
| --- | --- | --- | ---: | --- | --- |
| `deviceStartCommand` | 设备启动 | `00001` | `0` | Bool | R/W |
| `mixerMotorCommand` | 搅拌电机 | `00002` | `1` | Bool | R/W |
| `inletValveCommand` | 进料阀 | `00003` | `2` | Bool | R/W |
| `outletValveCommand` | 出料阀 | `00004` | `3` | Bool | R/W |
| `autoModeCommand` | 自动模式 | `00005` | `4` | Bool | R/W |

### Discrete Input

| 点位 ID | 名称 | Reference Address | PDU Address | 数据类型 | 访问 |
| --- | --- | --- | ---: | --- | --- |
| `deviceRunningStatus` | 设备运行反馈 | `10001` | `0` | Bool | R |
| `mixerMotorRunningStatus` | 电机运行反馈 | `10002` | `1` | Bool | R |
| `inletValveOpenStatus` | 进料阀反馈 | `10003` | `2` | Bool | R |
| `outletValveOpenStatus` | 出料阀反馈 | `10004` | `3` | Bool | R |
| `autoModeStatus` | 自动模式反馈 | `10005` | `4` | Bool | R |

### Input Register

| 点位 ID | 名称 | Reference Address | PDU Address | 数据类型 | Scale | 单位 | 访问 |
| --- | --- | --- | ---: | --- | ---: | --- | --- |
| `currentTemperature` | 当前温度 | `30001` | `0` | Int16 | `0.1` | `°C` | R |
| `currentLevel` | 当前液位 | `30002` | `1` | UInt16 | `0.1` | `%` | R |
| `currentPressure` | 当前压力 | `30003` | `2` | UInt16 | `0.01` | `MPa` | R |
| `motorRpm` | 电机转速 | `30004` | `3` | UInt16 | `1` | `rpm` | R |
| `productionCount` | 生产计数 | `30005-30006` | `4` | UInt32 | `1` | `count` | R |

`productionCount` 使用两个 register，高字在前、低字在后。

### Holding Register

| 点位 ID | 名称 | Reference Address | PDU Address | 数据类型 | Scale | 范围 | 单位 | 访问 |
| --- | --- | --- | ---: | --- | ---: | --- | --- | --- |
| `targetTemperature` | 目标温度 | `40001` | `0` | Int16 | `0.1` | `20.0-90.0` | `°C` | R/W |
| `manualMotorRpmSetpoint` | 手动转速设定 | `40002` | `1` | UInt16 | `1` | `0-1800` | `rpm` | R/W |

## Process Dynamics

每个 tick 中 Simulator 会根据 Coil 和 Holding Register 更新过程值：

- 设备启动后，当前温度逐步向目标温度靠近；停止后逐步回到环境温度 `25 °C`。
- 进料阀打开时液位上升，出料阀打开时液位下降，液位限制在 `0-100 %`。
- 设备启动或搅拌电机命令打开时，电机转速逐步靠近手动转速设定；手动设定为 `0` 时使用默认运行转速。
- 压力随液位和转速变化。
- 设备运行且转速超过阈值后，生产计数按周期递增。
- Discrete Input 反馈由过程模型根据 Coil 命令更新。

## Manual Verification

验收流程：

1. 运行 `yarn simulator:start`。
2. 启动 Electron HMI。
3. 打开 Device 页面，点击 `Connect`。
4. 点击 `手工读取`，确认当前温度、液位、电机转速等过程值展示。
5. 修改目标温度并点击 `写入`，确认 read-back 值更新。
6. 使用 CommandService 控制入口执行 Start、Stop、Motor Start/Stop、Inlet Valve、Outlet Valve，观察反馈点位变化。
7. 在 Simulator 终端输入 `disconnect`，确认 Device 状态进入 `Reconnecting`，相关 Tag Quality 变为 `Bad`。
8. 在 Simulator 终端输入 `recover`，确认 HMI 自动连接、重新采集数据，成功采集后的 Quality 回到 `Good`。
9. 输入 `delay <ms>`、`write-fail once`、`network-error`，验证 timeout、写失败和网络异常不会导致 Renderer 卡死或崩溃。

## Error Handling

当前实现将底层通信错误转换为统一设备错误：

- TCP connect failure -> `DEVICE_CONNECTION_FAILED`
- request timeout -> `DEVICE_REQUEST_TIMEOUT`
- connection lost -> `DEVICE_CONNECTION_LOST`
- illegal Modbus address -> `DEVICE_ILLEGAL_ADDRESS`
- illegal write / read-only write -> `DEVICE_WRITE_REJECTED`
- malformed protocol response -> `PROTOCOL_ERROR`

通信日志记录连接、断开、手工读写、超时和错误摘要。高频过程 tick 不输出通信日志。
