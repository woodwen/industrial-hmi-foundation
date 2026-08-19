# Protocol Module

This module owns Main Process industrial communication adapters.

Current scope:

- `IProtocolAdapter` defines the protocol boundary used by device, tag, and command services.
- `ProtocolAdapterCapabilities` lets the application choose polling or subscription without checking concrete adapter classes.
- `ModbusAdapter` implements Modbus TCP polling/batch read/write without exposing concrete Modbus client details to business modules.
- `OpcUaAdapter` implements OPC UA connect/read/write/subscription for local simulator endpoints.
- `createProtocolAdapter` selects the adapter from controlled device configuration.

Renderer code must not import this module directly.
