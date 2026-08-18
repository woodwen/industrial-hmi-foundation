# Device Module

This module owns Main Process device configuration and protocol adapter binding.

Current scope:

- One default simulated mixer PLC device at `127.0.0.1:1502`, unit id `1`.
- Explicit connection state machine: `Disconnected`, `Connecting`, `Connected`, `Reconnecting`, and `Fault`.
- Manual `connectDevice`, `disconnectDevice`, `getDeviceStatus`, and `readDeviceRegisters` operations.
- Automatic reconnect after communication loss from `Connected` using bounded backoff.
- Typed device state events for Main Process consumers and Renderer IPC publishers.
- Lifecycle callbacks for polling and Tag Quality updates.
- Legacy write requests are routed through Main Process `CommandService`; Renderer-facing writes must not bypass command validation.
- No Alarm, Historian, Recipe, permission audit, Safety PLC enforcement, or OPC UA.

Renderer code reaches this module only through typed IPC and Preload APIs.
