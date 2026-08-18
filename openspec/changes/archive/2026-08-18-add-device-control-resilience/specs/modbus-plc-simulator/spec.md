## MODIFIED Requirements

### Requirement: Simulator Fault Control
The PLC Simulator SHALL provide fault controls for disconnecting, delaying, failing, and recovering the Modbus TCP endpoint.

#### Scenario: Disconnect fault closes communication
- **WHEN** the Simulator disconnect fault is triggered
- **THEN** the Simulator SHALL close active Modbus TCP connections
- **AND** it SHALL stop accepting Modbus TCP requests until recovery is triggered

#### Scenario: Recovery restores communication
- **WHEN** the Simulator recovery action is triggered after a disconnect fault
- **THEN** the Simulator SHALL listen again on the configured Modbus TCP endpoint
- **AND** the HMI SHALL be able to reconnect automatically through DeviceManager reconnect backoff without restarting Electron

#### Scenario: Recovery preserves simulation state
- **WHEN** the Simulator recovery action is triggered without restarting the Simulator process
- **THEN** the Simulator SHALL preserve its current register memory and process state

#### Scenario: Response delay can be simulated
- **WHEN** a Simulator response delay fault is configured
- **THEN** Modbus read and write responses SHALL be delayed by the configured duration
- **AND** the delay SHALL be usable to trigger HMI request or command timeout tests

#### Scenario: Write failure can be simulated
- **WHEN** a Simulator write failure fault is configured
- **THEN** targeted Modbus write requests SHALL fail or be rejected according to the configured fault mode
- **AND** read requests SHALL remain independently controllable for read-back and recovery tests

#### Scenario: Network error can be simulated
- **WHEN** a Simulator network error fault is triggered
- **THEN** the Simulator SHALL be able to close or interrupt active communication in a way that surfaces as a communication failure to HMI
- **AND** the Electron Renderer SHALL remain outside the fault injection mechanism

#### Scenario: Fault control is external to Modbus
- **WHEN** disconnect, recovery, response delay, network error, or write failure fault control is implemented
- **THEN** it SHALL be triggered through a Simulator console command, CLI command, or test helper
- **AND** it SHALL NOT require writing a Modbus register from HMI

### Requirement: Protocol Adapter Abstraction
The Main Process SHALL define an `IProtocolAdapter` abstraction for industrial protocol communication.

#### Scenario: Adapter lifecycle methods exist
- **WHEN** protocol adapters are implemented
- **THEN** they SHALL provide `connect`, `disconnect`, `read`, `write`, and `getStatus` methods

#### Scenario: Adapter status uses explicit states
- **WHEN** protocol connection status is represented
- **THEN** it SHALL use explicit states including `Disconnected`, `Connecting`, `Connected`, `Reconnecting`, and `Fault`
- **AND** it SHALL NOT represent complex connection lifecycle through independent boolean flags

#### Scenario: Automatic reconnect is not active
- **WHEN** a connection is lost after the HMI has connected successfully
- **THEN** DeviceManager SHALL own the automatic reconnect lifecycle
- **AND** concrete protocol adapters SHALL NOT start independent hidden reconnect loops

#### Scenario: Adapter exposes failures for reconnect decisions
- **WHEN** connect, read, write, or status check fails
- **THEN** the adapter SHALL surface a unified communication error that DeviceManager can classify as retryable or unrecoverable
- **AND** low-level protocol exceptions SHALL NOT cross directly to Renderer

#### Scenario: Business modules depend on abstraction
- **WHEN** Main Process business or application services communicate with a device
- **THEN** they SHALL depend on `IProtocolAdapter`
- **AND** they SHALL NOT depend directly on a concrete Modbus library

### Requirement: Device Manager
The Main Process SHALL provide a `DeviceManager` for device configuration, connection lifecycle management, and device state publication.

#### Scenario: DeviceManager connects configured device
- **WHEN** Renderer requests connection to the configured simulated PLC
- **THEN** the Main Process SHALL route the request through `DeviceManager`
- **AND** `DeviceManager` SHALL connect through an `IProtocolAdapter`

#### Scenario: DeviceManager disconnects configured device
- **WHEN** Renderer requests device disconnection
- **THEN** `DeviceManager` SHALL disconnect the active adapter
- **AND** connection status SHALL become `Disconnected`
- **AND** reconnect, polling, and pending command resources for that device SHALL be cleaned up

#### Scenario: DeviceManager reports status
- **WHEN** Renderer requests device status
- **THEN** `DeviceManager` SHALL return the explicit connection status and relevant endpoint summary

#### Scenario: DeviceManager publishes lifecycle changes
- **WHEN** device state changes between `Disconnected`, `Connecting`, `Connected`, `Reconnecting`, and `Fault`
- **THEN** `DeviceManager` SHALL publish a typed state event for Main Process consumers and Renderer IPC publishers

#### Scenario: DeviceManager rejects read-only writes
- **WHEN** a legacy or internal write request targets Discrete Input or Input Register areas
- **THEN** Main Process SHALL reject the write before it reaches the protocol library
- **AND** Renderer-facing write requests SHALL be routed through CommandService validation

#### Scenario: DeviceManager delegates write operations
- **WHEN** Renderer requests a device control or writable Tag update
- **THEN** the write SHALL be routed through CommandService
- **AND** DeviceManager SHALL NOT expose a Renderer-facing path that bypasses CommandService validation

### Requirement: Typed Device IPC API
The system SHALL expose device communication use cases to Renderer through typed Preload APIs.

#### Scenario: Renderer connects through typed API
- **WHEN** Device or Dashboard UI requests Connect
- **THEN** the ViewModel SHALL call a typed `window.hmi` device API through the Renderer API client
- **AND** Renderer SHALL NOT access raw `ipcRenderer`, Node.js APIs, TCP sockets, or the Modbus library

#### Scenario: Renderer reads through typed API
- **WHEN** Device or Dashboard UI requests manual reading of configured points
- **THEN** the request SHALL pass through Preload typed IPC to Main Process
- **AND** Main Process SHALL return values or a unified error response

#### Scenario: Renderer writes through typed API
- **WHEN** Device or Dashboard UI writes target temperature, RPM setpoint, or mapped Coil controls
- **THEN** the request SHALL pass through Preload typed IPC to Main Process CommandService
- **AND** CommandService SHALL perform validation before sending the write to the adapter

#### Scenario: Renderer subscribes to state through typed API
- **WHEN** Renderer needs live device state
- **THEN** it SHALL subscribe through a typed Preload API that returns an unsubscribe function
- **AND** the subscription SHALL NOT expose raw IPC channels or protocol objects

### Requirement: Communication Error Handling
The system SHALL handle expected Modbus and TCP error paths without crashing the Electron Renderer.

#### Scenario: Simulator is not running
- **WHEN** the user clicks Connect while the Simulator is not running
- **THEN** the HMI SHALL show a connection failure state or message
- **AND** the device state SHALL enter `Fault` rather than starting automatic reconnect
- **AND** the Renderer process SHALL NOT crash

#### Scenario: Illegal address is requested
- **WHEN** a read or write targets an unmapped Modbus address
- **THEN** the system SHALL return a unified illegal address error
- **AND** it SHALL record a communication log entry with useful context

#### Scenario: Illegal write is requested
- **WHEN** a write targets a read-only area or uses an out-of-range value
- **THEN** the system SHALL reject the write before protocol execution
- **AND** it SHALL return a unified write rejection error

#### Scenario: Simulator stops after connection
- **WHEN** the Simulator stops after HMI has connected
- **THEN** the next status check, polling read, manual read, or command SHALL surface a connection lost or request failure state
- **AND** the device state SHALL enter `Reconnecting`
- **AND** the Electron application SHALL remain usable

#### Scenario: Simulator restarts after failure
- **WHEN** the Simulator is restarted or recovered after a connection failure
- **THEN** the HMI SHALL reconnect automatically through the bounded DeviceManager reconnect loop
- **AND** successful reconnection SHALL NOT require restarting the Electron HMI

#### Scenario: Delayed response causes timeout
- **WHEN** the Simulator delays a response beyond the configured request or command timeout
- **THEN** Main Process SHALL return a unified timeout result
- **AND** Renderer SHALL remain responsive

#### Scenario: Simulated write failure is isolated
- **WHEN** the Simulator write failure fault rejects or drops a write request
- **THEN** CommandService SHALL return a failed or timeout command result
- **AND** low-level socket or Modbus errors SHALL NOT be exposed directly to Renderer

### Requirement: Deferred Runtime Scope
The system SHALL keep later industrial runtime features out of this change unless explicitly specified by the current change.

#### Scenario: Polling remains deferred
- **WHEN** this change is implemented
- **THEN** it SHALL NOT introduce per-Tag polling timers or duplicate raw protocol polling loops
- **AND** existing centralized PollingScheduler SHALL remain the owner of automatic Tag polling

#### Scenario: Tag and business modules remain deferred
- **WHEN** this change is implemented
- **THEN** it SHALL NOT implement Alarm, Historian, Trend persistence, Recipe execution, Permission, Audit, or OPC UA behavior
- **AND** Tag changes SHALL remain limited to communication quality and recovery semantics

#### Scenario: Simulator remains a test device
- **WHEN** reconnect, command validation, timeout, or fault injection behavior is documented or displayed
- **THEN** it SHALL be described as HMI and Simulator engineering practice
- **AND** it SHALL NOT claim the project is deployed to a real production line or provides real industrial Safety PLC protection

#### Scenario: Protocol validation is not a full Tag system
- **WHEN** Device or Dashboard displays controls and command results
- **THEN** those controls SHALL be treated as Simulator control workflows
- **AND** they SHALL NOT be presented as certified industrial safety controls
