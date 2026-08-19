# Command Module

Main Process command orchestration for simulator device control.

Current scope:

- Routes all device writes through `CommandService`.
- Supports Start, Stop, Motor Start/Stop, Inlet Valve, Outlet Valve, Target Temperature, and RPM Setpoint.
- Validates device connection state, writable targets, value type, and configured ranges before protocol writes.
- Separates protocol write acceptance from device state verification.
- Uses read-back or feedback verification with bounded command timeouts.
- Allows one active command per device; concurrent commands return `busy` rather than being queued.
- Uses protocol bindings so Modbus writes registers/coils and OPC UA writes logical nodes without exposing protocol details to Renderer.

This module validates the HMI / PLC Simulator control architecture. It does not provide real industrial Safety PLC capability.
