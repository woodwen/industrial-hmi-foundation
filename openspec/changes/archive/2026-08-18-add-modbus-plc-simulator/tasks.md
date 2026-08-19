## 1. Dependency and Scope Setup

- [x] 1.1 Review current `package.json`, source layout, and foundation boundaries before implementation.
- [x] 1.2 Confirm whether an existing project dependency can support Modbus TCP client/server.
- [x] 1.3 If a new dependency is required, select a maintained Node-compatible Modbus TCP library or isolated client/server libraries suitable for Electron Main Process and independent Simulator usage, and document the decision before implementation.
- [x] 1.4 Add simulator and Modbus development scripts using the existing npm script style.
- [x] 1.5 Confirm the implementation scope excludes PollingScheduler, TagCache, Alarm, Historian, Recipe, automatic reconnect, and OPC UA.

## 2. Modbus Mapping and Shared Types

- [x] 2.1 Create documented Modbus Address Mapping for Coil, Discrete Input, Holding Register, and Input Register areas.
- [x] 2.2 Define shared TypeScript types for register area, zero-based PDU address, reference address, point id, data type, scale, unit, access mode, and valid range.
- [x] 2.3 Add mapped Coil points for device start command, mixer motor command, inlet valve command, outlet valve command, and auto/manual mode command.
- [x] 2.4 Add mapped Discrete Input feedback points for device running status, mixer motor running status, inlet valve open status, outlet valve open status, and auto mode status.
- [x] 2.5 Add mapped Input Register points for current temperature, current level, current pressure, motor RPM, and two-register UInt32 production count with high word first.
- [x] 2.6 Add mapped Holding Register points for target temperature `20.0°C-90.0°C` and manual motor RPM setpoint `0-1800 rpm`.
- [x] 2.7 Add tests that verify mapping addresses, access modes, scale metadata, valid ranges, and zero-based address convention.

## 3. Independent PLC Simulator

- [x] 3.1 Create an independent Simulator module that can start without Electron HMI.
- [x] 3.2 Implement Simulator configuration for default `127.0.0.1:1502`, unit id `1`, tick interval, and initial values: `25.0°C`, `60.0°C`, `40.0%`, `0.12MPa`, `0 rpm`, production count `0`.
- [x] 3.3 Implement Simulator memory map for Coils, Discrete Inputs, Holding Registers, and Input Registers.
- [x] 3.4 Implement process dynamics for temperature moving toward target temperature.
- [x] 3.5 Implement process dynamics for inlet/outlet valve effects on liquid level with bounds.
- [x] 3.6 Implement process dynamics for motor command, motor RPM, pressure, and production count.
- [x] 3.7 Implement write validation for writable Coils and Holding Registers.
- [x] 3.8 Implement illegal address and illegal value behavior for unsupported reads/writes.
- [x] 3.9 Implement Simulator console command, CLI command, or test helper fault controls for disconnect and recover without using Modbus register writes.
- [x] 3.10 Ensure recover preserves current Simulator memory and process state, while full process restart uses initial values.
- [x] 3.11 Add tests for process dynamics, write validation, illegal addresses, state-preserving recover, and fault control behavior.

## 4. Protocol Adapter Layer

- [x] 4.1 Define `IProtocolAdapter` in Main Process protocol boundary with `connect`, `disconnect`, `read`, `write`, and `getStatus`.
- [x] 4.2 Define protocol connection states including `Disconnected`, `Connecting`, `Connected`, `Reconnecting`, and `Fault`.
- [x] 4.3 Define protocol read/write request and result types without exposing concrete Modbus library types.
- [x] 4.4 Implement `ModbusAdapter` behind `IProtocolAdapter`.
- [x] 4.5 Implement connect timeout, request timeout, disconnect cleanup, and socket/listener/timer cleanup.
- [x] 4.6 Implement read support for Coil, Discrete Input, Holding Register, and Input Register areas.
- [x] 4.7 Implement write support for Coil and Holding Register areas.
- [x] 4.8 Map Modbus exceptions, TCP failures, timeouts, connection loss, illegal addresses, and illegal writes to unified application errors.
- [x] 4.9 Add communication logs for connect, disconnect, read, write, timeout, and error paths.
- [x] 4.10 Add unit tests for adapter status transitions and error mapping.

## 5. DeviceManager

- [x] 5.1 Implement default simulated PLC device configuration for `127.0.0.1:1502`, unit id `1`, connect timeout `3000ms`, and request timeout `2000ms`.
- [x] 5.2 Implement `DeviceManager` with `connectDevice`, `disconnectDevice`, `getDeviceStatus`, `readDeviceRegisters`, and `writeDeviceRegisters`.
- [x] 5.3 Ensure `DeviceManager` depends on `IProtocolAdapter`, not a concrete Modbus library.
- [x] 5.4 Reject writes to Discrete Input and Input Register areas before they reach the protocol adapter.
- [x] 5.5 Update device connection status correctly on connect success, disconnect, connect failure, timeout, and connection loss.
- [x] 5.6 Add tests for DeviceManager lifecycle, read/write routing, read-only write rejection, and status reporting.

## 6. IPC and Preload API

- [x] 6.1 Define shared typed request/response models for device connect, disconnect, status, read, and write use cases.
- [x] 6.2 Add IPC channels for device use cases through the existing centralized IPC channel structure.
- [x] 6.3 Register Main IPC handlers that validate input, call `DeviceManager`, convert errors, and log context.
- [x] 6.4 Extend Preload `window.hmi` with a minimal typed device API.
- [x] 6.5 Update Renderer global type declarations and API client implementation.
- [x] 6.6 Add contract or type tests ensuring Renderer receives typed device APIs and no raw IPC access.

## 7. Renderer Manual Verification UI

- [x] 7.1 Extend `DeviceViewModel` with connection status, operation state, selected point values, write inputs, loading state, and error state.
- [x] 7.2 Add ViewModel actions for connect, disconnect, refresh status, manual read of configured values, target temperature write, and Coil writes.
- [x] 7.3 Update Device page View to render Connect, Disconnect, Connection Status, manual read controls, target temperature input, and Coil controls; keep Dashboard limited to optional summary display.
- [x] 7.4 Ensure the View consumes ViewModel state and does not import protocol, Main Process, Node.js, TCP, or Modbus modules.
- [x] 7.5 Display current temperature, level, motor RPM, target temperature, and Coil/feedback values with units and clear success/error states.
- [x] 7.6 Ensure the UI exposes only predefined mapped points and controlled write inputs, with no arbitrary Modbus function code or address entry.
- [x] 7.7 Add ViewModel tests for connect, disconnect, read, write, error, and loading flows using mocked typed HMI API client.

## 8. Integration and Manual Acceptance

- [x] 8.1 Add an integration test or scripted smoke test that starts Simulator and connects through the ModbusAdapter.
- [x] 8.2 Verify Scenario 1: Simulator started, Electron/Main protocol path can connect successfully.
- [x] 8.3 Verify Scenario 2: manual read returns current temperature, liquid level, and motor RPM.
- [x] 8.4 Verify Scenario 3: manual write modifies target temperature and read-back returns the updated value.
- [x] 8.5 Verify Scenario 4: manual Coil control changes Coil or feedback state.
- [x] 8.6 Verify Scenario 5: stopping Simulator after connection surfaces a connection error without crashing HMI.
- [x] 8.7 Verify Scenario 6: restarting Simulator allows manual reconnect without restarting HMI.

## 9. Documentation

- [x] 9.1 Document how to start and stop the PLC Simulator independently.
- [x] 9.2 Document Simulator host, port, unit id, configuration overrides, and fault control commands.
- [x] 9.3 Document the Modbus Address Mapping with reference addresses and zero-based PDU addresses.
- [x] 9.4 Document default initial process values, target temperature range, manual RPM range, and production count word order.
- [x] 9.5 Document the manual Device page verification workflow and known scope exclusions.
- [x] 9.6 Update architecture or development documentation if the implemented paths differ from existing foundation docs.

## 10. Verification

- [x] 10.1 Run `openspec validate add-modbus-plc-simulator --strict`.
- [x] 10.2 Run `openspec validate --all --strict`.
- [x] 10.3 Run `git diff --check`.
- [x] 10.4 Run `npm run typecheck`.
- [x] 10.5 Run `npm run lint`.
- [x] 10.6 Run `npm run test`.
- [x] 10.7 Run `npm run build`.
- [x] 10.8 Confirm no automatic polling, TagCache, Alarm, Historian, Recipe, automatic reconnect, or OPC UA implementation was added.
- [x] 10.9 Report remaining risks, manual verification notes, and any failed validation honestly before implementation completion.
