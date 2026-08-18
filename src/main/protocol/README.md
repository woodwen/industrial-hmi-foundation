# Protocol Module

This module owns Main Process industrial communication adapters.

Current scope:

- `IProtocolAdapter` defines the protocol boundary used by device services.
- `ModbusAdapter` implements the current Modbus TCP client path without exposing concrete Modbus client details to business modules.
- OPC UA remains reserved for a later OpenSpec change.

Renderer code must not import this module directly.
