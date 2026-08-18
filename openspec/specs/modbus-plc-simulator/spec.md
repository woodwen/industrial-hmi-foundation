# modbus-plc-simulator Specification

## Purpose
定义 Industrial HMI 连接模拟 PLC 的 Modbus TCP 基础能力，包括独立 PLC Simulator、地址映射、Main Process 协议抽象、DeviceManager、typed IPC，以及 Device 页面手工读写验证流程。
## Requirements
### Requirement: Independent PLC Simulator
The system SHALL provide an independent PLC Simulator for the automated constant-temperature mixing equipment scenario.

#### Scenario: Simulator starts without Electron HMI
- **WHEN** the maintainer starts the PLC Simulator through its simulator script
- **THEN** the Simulator SHALL start without launching the Electron HMI
- **AND** it SHALL listen as a Modbus TCP server on the configured host, port, and unit id

#### Scenario: Simulator uses default endpoint
- **WHEN** the Simulator starts without endpoint overrides
- **THEN** it SHALL listen on `127.0.0.1:1502`
- **AND** it SHALL use Modbus unit id `1`

#### Scenario: Simulator initializes process values
- **WHEN** the Simulator starts as a new process
- **THEN** current temperature SHALL initialize to `25.0°C`
- **AND** target temperature SHALL initialize to `60.0°C`
- **AND** current level SHALL initialize to `40.0%`
- **AND** current pressure SHALL initialize to `0.12MPa`
- **AND** motor RPM SHALL initialize to `0`
- **AND** production count SHALL initialize to `0`

#### Scenario: Simulator stops without HMI shutdown
- **WHEN** the PLC Simulator process is stopped
- **THEN** the Electron HMI application SHALL remain able to run
- **AND** the Simulator stop SHALL NOT require Renderer cleanup or Electron process shutdown

### Requirement: Modbus TCP Address Mapping
The system SHALL define a documented Modbus TCP address mapping for the simulated mixing equipment.

#### Scenario: Coil mapping exists
- **WHEN** the Modbus mapping is inspected
- **THEN** it SHALL define writable Coil points for device start command, mixer motor command, inlet valve command, outlet valve command, and auto/manual mode command

#### Scenario: Discrete Input mapping exists
- **WHEN** the Modbus mapping is inspected
- **THEN** it SHALL define read-only Discrete Input feedback points for device running status, mixer motor running status, inlet valve open status, outlet valve open status, and auto mode status

#### Scenario: Input Register mapping exists
- **WHEN** the Modbus mapping is inspected
- **THEN** it SHALL define read-only Input Register points for current temperature, current level, current pressure, motor RPM, and production count

#### Scenario: Production count word order is explicit
- **WHEN** the production count mapping is inspected
- **THEN** it SHALL use Input Registers `30005-30006`
- **AND** it SHALL encode the value as UInt32 with high word first and low word second

#### Scenario: Holding Register mapping exists
- **WHEN** the Modbus mapping is inspected
- **THEN** it SHALL define writable Holding Register points for target temperature and manual motor RPM setpoint

#### Scenario: Writable analog ranges are explicit
- **WHEN** the Holding Register mapping is inspected
- **THEN** target temperature SHALL use `40001` with scale `0.1` and valid range `20.0°C` to `90.0°C`
- **AND** manual motor RPM setpoint SHALL use `40002` with scale `1` and valid range `0` to `1800 rpm`

#### Scenario: Address convention is explicit
- **WHEN** developers read or use the Modbus mapping
- **THEN** the mapping SHALL explicitly distinguish human reference addresses from Modbus PDU zero-based addresses
- **AND** implementation code SHALL use zero-based addresses internally

### Requirement: Simulator Process Dynamics
The PLC Simulator SHALL simulate basic process dynamics for the automated constant-temperature mixing equipment.

#### Scenario: Running equipment changes analog values
- **WHEN** the device start command is enabled
- **THEN** current temperature SHALL gradually move toward target temperature
- **AND** current level, current pressure, motor RPM, and production count SHALL be updated by the simulation loop

#### Scenario: Stopped equipment settles process values
- **WHEN** the device start command is disabled
- **THEN** motor RPM SHALL trend toward zero
- **AND** production count SHALL stop increasing

#### Scenario: Valve commands affect level
- **WHEN** inlet valve command or outlet valve command changes
- **THEN** current level SHALL change according to the active valve state
- **AND** current level SHALL remain bounded between 0.0% and 100.0%

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

### Requirement: Modbus TCP Adapter
The system SHALL implement a `ModbusAdapter` for Modbus TCP communication behind `IProtocolAdapter`.

#### Scenario: Adapter connects to running Simulator
- **WHEN** the PLC Simulator is running on the configured endpoint
- **THEN** `ModbusAdapter.connect` SHALL establish a Modbus TCP connection
- **AND** `getStatus` SHALL report `Connected`

#### Scenario: Adapter reads mapped values
- **WHEN** the adapter is connected and reads mapped Input Registers
- **THEN** it SHALL return current temperature, current level, and motor RPM values from the Simulator

#### Scenario: Adapter writes holding register
- **WHEN** the adapter is connected and writes the target temperature Holding Register with a valid value
- **THEN** the Simulator SHALL accept the write
- **AND** a subsequent read SHALL return the updated target temperature value

#### Scenario: Adapter writes coil
- **WHEN** the adapter is connected and writes a mapped Coil with a valid boolean value
- **THEN** the Simulator SHALL accept the write
- **AND** a subsequent read of the corresponding Coil or feedback point SHALL reflect the requested control state

#### Scenario: Adapter enforces request timeout
- **WHEN** a Modbus request does not complete before the configured request timeout
- **THEN** the adapter SHALL fail the request with a unified timeout error
- **AND** it SHALL keep internal resources eligible for cleanup

#### Scenario: Adapter uses default timeouts
- **WHEN** no timeout overrides are provided
- **THEN** Modbus connect timeout SHALL default to `3000ms`
- **AND** Modbus request timeout SHALL default to `2000ms`

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

### Requirement: Manual Device Page Verification
The Renderer SHALL provide a Device or Dashboard page workflow for manually validating the Modbus protocol chain.

#### Scenario: User connects to running Simulator
- **WHEN** the Simulator is running and the user clicks Connect
- **THEN** the page SHALL show connection status as connected
- **AND** the application SHALL NOT require automatic polling to show that status

#### Scenario: Device page hosts protocol validation
- **WHEN** the manual Modbus validation UI is implemented
- **THEN** it SHALL be hosted on the Device page by default
- **AND** Dashboard SHALL NOT become the primary raw protocol validation surface

#### Scenario: User reads process values
- **WHEN** the user manually reads current temperature, current level, and motor RPM
- **THEN** the page SHALL display returned values with their configured units

#### Scenario: User changes target temperature
- **WHEN** the user enters a valid target temperature and submits the write
- **THEN** the page SHALL show the write result
- **AND** a subsequent manual read SHALL show the updated target temperature

#### Scenario: User controls Coil points
- **WHEN** the user toggles a mapped Coil control
- **THEN** the page SHALL show the write result
- **AND** a subsequent manual read SHALL reflect the control state or corresponding feedback state

#### Scenario: User cannot enter arbitrary Modbus address
- **WHEN** the manual validation UI is displayed
- **THEN** it SHALL expose predefined mapped points and controlled write inputs
- **AND** it SHALL NOT expose arbitrary Modbus function code or arbitrary address input

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

### Requirement: Communication Logging
The system SHALL log Modbus communication lifecycle and diagnostic events from Main Process.

#### Scenario: Connection lifecycle is logged
- **WHEN** device connect, disconnect, connection failure, or connection lost events occur
- **THEN** Main Process SHALL write communication log entries containing device id, endpoint summary, event type, and result

#### Scenario: Manual read and write are logged
- **WHEN** a manual read or write request is executed
- **THEN** Main Process SHALL write a communication log entry containing device id, register area, address, quantity, duration, and success or error summary

#### Scenario: High-frequency logs are not introduced
- **WHEN** this change is implemented
- **THEN** it SHALL NOT introduce automatic polling logs
- **AND** it SHALL NOT log continuous high-frequency process values by default

#### Scenario: Process value logging is limited
- **WHEN** the Simulator updates process values through its simulation loop
- **THEN** the HMI SHALL NOT log each continuous process value update by default

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
