# M-7(feat): 新增 Modbus PLC 模拟器链路

OpenSpec Change: add-modbus-plc-simulator

背景:
- Industrial HMI 已有 Electron Main/Preload/Renderer、MVVM、日志、错误处理和基础页面骨架，但缺少可运行的工业通信链路。
- 当前自动化恒温混料设备场景需要先通过独立 PLC Simulator 和 Modbus TCP 验证 Main Process 到模拟设备的基础读写路径。

方案概述:
- 新增独立 PLC Simulator，默认监听 `127.0.0.1:1502` / Unit ID `1`，可脱离 Electron HMI 启动。
- 在 Main Process 建立 `IProtocolAdapter -> ModbusAdapter -> DeviceManager` 路径，业务层不依赖具体 Modbus client 实现。
- 通过 Preload 暴露最小 typed `window.hmi.devices` API，Renderer Device 页面只做手工连接、读取和受控写入。
- 明确本期不实现 PollingScheduler、TagCache、Alarm、Historian、Recipe、自动重连或 OPC UA。

实现改动:
- 新增 Modbus 地址映射和共享设备 API 类型，覆盖 Coil、Discrete Input、Holding Register、Input Register 以及工程值/原始值编解码。
- 新增轻量 Modbus TCP server/client、PLC Simulator 内存映射、过程模型和 `disconnect` / `recover` 故障控制命令。
- 新增 `IProtocolAdapter`、`ModbusAdapter`、统一设备错误映射和 `DeviceManager`，处理连接失败、请求超时、非法地址、非法写入和连接丢失。
- 扩展 IPC channel、Main handler、Preload、Renderer API client、`DeviceViewModel` 和 Device 页面手工验证 UI。
- 新增 `npm run simulator:build`、`npm run simulator:start`、`npm run simulator:dev`，并补充模拟器文档、内置帮助和 changelog。
- OpenSpec 已归档到 `openspec/changes/archive/2026-08-18-add-modbus-plc-simulator/`，并同步 `openspec/specs/modbus-plc-simulator/spec.md`。

测试计划(UT):
- `openspec validate add-modbus-plc-simulator --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run simulator:build`
- `npm run build`

影响范围(建议手动测试范围):
- Simulator：运行 `npm run simulator:start`，在终端验证 `status`、`disconnect`、`recover`、`stop`。
- HMI Device 页面：连接默认模拟 PLC，手工读取当前温度、液位、电机转速，写入目标温度和 Coil。
- 异常路径：Simulator 未启动、连接后 `disconnect`、恢复后手工重新 `Connect`。
- 架构边界：Renderer 仍不得直接访问 Node.js、TCP、Electron Main 或底层 Modbus 实现。

风险与后续:
- 当前只支持一个默认模拟设备配置；多设备、动态端口和真实 PLC 配置需要后续 change。
- 当前只做手工读写，不包含自动轮询、Tag quality、TagCache 或自动重连。
- 自实现轻量 Modbus TCP 覆盖本期功能码和测试场景，复杂真实 PLC 兼容性需要后续单独验证。
