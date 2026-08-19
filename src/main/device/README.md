# Device Module

This module owns Main Process device configuration and protocol adapter binding.

Current scope:

- One default simulated mixer device.
- Modbus TCP default configuration at `127.0.0.1:1502`, unit id `1`.
- Optional OPC UA configuration at `opc.tcp://127.0.0.1:4840/industrial-hmi-simulator`.
- Explicit connection state machine: `Disconnected`, `Connecting`, `Connected`, `Reconnecting`, and `Fault`.
- Manual `connectDevice`, `disconnectDevice`, `getDeviceStatus`, and `readDeviceRegisters` operations.
- Controlled `updateDeviceConfig` protocol switching while preserving business-layer APIs.
- Automatic reconnect after communication loss from `Connected` using bounded backoff.
- Typed device state events for Main Process consumers and Renderer IPC publishers.
- Lifecycle callbacks for polling/subscription acquisition and Tag Quality updates.
- Legacy write requests are routed through Main Process `CommandService`; Renderer-facing writes must not bypass command validation.
- No Safety PLC enforcement or production OPC UA security profile.

Renderer code reaches this module only through typed IPC and Preload APIs.
