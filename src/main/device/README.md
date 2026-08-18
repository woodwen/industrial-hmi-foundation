# Device Module

This module owns Main Process device configuration and protocol adapter binding.

Current scope:

- One default simulated mixer PLC device at `127.0.0.1:1502`, unit id `1`.
- Manual `connectDevice`, `disconnectDevice`, `getDeviceStatus`, `readDeviceRegisters`, and `writeDeviceRegisters` operations.
- Point-level write rejection before protocol calls for read-only areas.
- No automatic polling, TagCache, Alarm, Historian, Recipe, automatic reconnect, or OPC UA.

Renderer code reaches this module only through typed IPC and Preload APIs.
