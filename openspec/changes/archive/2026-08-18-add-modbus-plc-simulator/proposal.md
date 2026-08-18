## Why

Industrial HMI 已完成 Electron、Preload、Renderer MVVM、日志和错误处理的基础框架，但当前仍缺少可运行的工业通信链路。需要先通过独立 PLC Simulator 与 Modbus TCP 基础能力验证 Main Process 到模拟设备的读写路径，为后续 Tag、Polling、Alarm、Historian 等能力提供真实可测的协议基础。

## What Changes

- 新增独立 PLC Simulator，可脱离 Electron HMI 单独启动和关闭。
- Simulator 通过 Modbus TCP 暴露自动化恒温混料设备的模拟寄存器和线圈，默认监听 `127.0.0.1:1502`、Unit ID `1`。
- 设计并实现覆盖 Coil、Discrete Input、Holding Register、Input Register 的 Modbus Address Mapping。
- Modbus 文档和 UI 显示 reference address，代码内部统一使用 Modbus PDU zero-based address。
- Simulator 支持基础运行仿真：启动后温度、液位、电机转速、压力和生产计数随时间变化。
- Simulator 支持简单故障模拟：通过独立控制台命令或 CLI 触发断开连接与恢复连接，恢复时默认保留仿真状态。
- Main Process 新增 `IProtocolAdapter` 抽象，至少包含 `connect`、`disconnect`、`read`、`write`、`getStatus`。
- Main Process 新增 `ModbusAdapter`，通过协议适配层封装本期最小 Modbus TCP client 实现，业务模块不得直接依赖具体 TCP/Modbus 实现细节。
- Main Process 新增 `DeviceManager`，负责设备配置、连接、断开和连接状态管理。
- Preload 新增面向设备验证的 typed IPC API，不暴露 raw IPC、Node.js API 或底层 Modbus client。
- Device 页面新增基础协议链路验证能力：Connect、Disconnect、Connection Status、手工读取预定义点位、手工写入目标温度和受控 Coil；Dashboard 至多显示摘要。
- 增加连接失败、请求超时、非法寄存器地址、非法写入、Simulator 未启动、Simulator 停止后的异常处理与日志记录。
- 本期不实现自动轮询、TagCache、Alarm、Historian、Recipe、自动重连或 OPC UA。

## Capabilities

### New Capabilities
- `modbus-plc-simulator`: 定义独立 PLC Simulator、Modbus TCP 地址映射、Main Process 协议适配、DeviceManager、Preload typed IPC 以及 Renderer 手工读写验证能力。

### Modified Capabilities
- 无。

## Impact

- 影响 `src/main/protocol/`：新增协议抽象、读写请求模型、连接状态和 Modbus TCP 适配实现。
- 影响 `src/main/device/`：新增设备配置、设备连接生命周期和连接状态管理。
- 影响 `src/main/ipc/` 与 `src/preload/`：新增设备连接和手工读写相关 typed API。
- 影响 `src/renderer/`：Device 或 Dashboard 页面及对应 ViewModel 增加手工连接、读取和写入验证状态。
- 新增独立 Simulator 源码、启动脚本和开发说明。
- 本期不新增 Modbus 生产依赖，采用隔离在 Adapter/Simulator 层的 Node TCP 最小 Modbus TCP client/server 实现；后续如替换为第三方库，不得将该依赖暴露给 Renderer。
- 新增或更新单元测试、集成测试和手工验收说明，覆盖协议适配、设备状态、异常路径和 Renderer 边界。
