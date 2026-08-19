## ADDED Requirements

### Requirement: OPC UA Adapter
The system SHALL provide an `OpcUaAdapter` behind `IProtocolAdapter` for OPC UA communication in the Main Process.

#### Scenario: Adapter lifecycle is protocol abstracted
- **WHEN** DeviceManager connects an OPC UA device
- **THEN** it SHALL call `connect`, `disconnect`, `getStatus`, `read`, `write`, and subscription-related adapter capabilities through `IProtocolAdapter`
- **AND** DeviceManager SHALL NOT import or depend on a concrete OPC UA client library

#### Scenario: Adapter connects to simulator endpoint
- **WHEN** the OPC UA Simulator is running on the configured endpoint
- **THEN** `OpcUaAdapter.connect` SHALL establish an OPC UA session
- **AND** `getStatus` SHALL report `Connected` with an endpoint summary

#### Scenario: Adapter reads configured variables
- **WHEN** `OpcUaAdapter` reads configured variable bindings for Temperature, Level, RPM, Running, or Setpoint
- **THEN** it SHALL return protocol-neutral values that TagService can decode into TagValue objects
- **AND** low-level OPC UA node structures SHALL NOT cross to Renderer

#### Scenario: Adapter writes configured variables
- **WHEN** CommandService writes a writable OPC UA variable such as Setpoint or Running through `IProtocolAdapter`
- **THEN** `OpcUaAdapter` SHALL execute the write against the configured NodeId
- **AND** it SHALL return a structured protocol write result instead of a raw OPC UA status object

#### Scenario: Adapter converts OPC UA failures
- **WHEN** OPC UA session creation, read, write, subscription, monitored item, timeout, or session close fails
- **THEN** `OpcUaAdapter` SHALL convert the failure to the unified application or communication error shape
- **AND** Renderer SHALL NOT receive raw OPC UA status codes or stack traces

#### Scenario: Adapter cleans up resources
- **WHEN** an OPC UA device disconnects, reconnects, faults, or the runtime is disposed
- **THEN** `OpcUaAdapter` SHALL close active sessions, subscriptions, monitored items, timers, and listeners
- **AND** later reconnect attempts SHALL NOT reuse stale subscription state

### Requirement: OPC UA Simulator
The system SHALL provide an independent OPC UA Server Simulator for the simulated constant-temperature mixing equipment.

#### Scenario: Simulator starts without Electron HMI
- **WHEN** the maintainer starts the OPC UA Simulator through its simulator script
- **THEN** the server SHALL start without launching Electron HMI
- **AND** it SHALL listen on a configurable OPC UA endpoint

#### Scenario: Simulator has default endpoint
- **WHEN** the OPC UA Simulator starts without endpoint overrides
- **THEN** it SHALL use the default local endpoint `opc.tcp://127.0.0.1:4840/industrial-hmi-simulator`
- **AND** README or simulator documentation SHALL describe how to override it

#### Scenario: Simulator uses local non-production security defaults
- **WHEN** the OPC UA Simulator starts in the default local development configuration
- **THEN** it SHALL use anonymous / no-security access for local simulation
- **AND** README or Known Limitations SHALL state that this is not a production OPC UA security configuration

#### Scenario: Simulator exposes required variables
- **WHEN** the OPC UA Simulator address space is inspected
- **THEN** it SHALL expose variables for Temperature, Level, RPM, Running, and Setpoint
- **AND** Temperature, Level, RPM, and Running SHALL be readable by HMI
- **AND** Setpoint SHALL be writable by HMI through CommandService

#### Scenario: Simulator process dynamics are consistent
- **WHEN** Running is true and Setpoint changes
- **THEN** Temperature SHALL move toward Setpoint over time
- **AND** RPM and Level SHALL remain bounded according to the simulator rules

#### Scenario: Simulator stop is independent
- **WHEN** the OPC UA Simulator process is stopped
- **THEN** Electron HMI SHALL remain able to run
- **AND** DeviceManager SHALL handle the communication loss through existing device state and quality rules

### Requirement: OPC UA Subscription Acquisition
The system SHALL use OPC UA subscription as the preferred data acquisition mechanism when adapter capabilities allow it.

#### Scenario: Capability prefers subscription
- **WHEN** `OpcUaAdapter` reports its acquisition capability
- **THEN** the preferred acquisition mode SHALL be `subscription`
- **AND** the system SHALL NOT force OPC UA into Modbus-style polling by default

#### Scenario: Subscriptions monitor configured Tags
- **WHEN** an OPC UA device enters `Connected`
- **THEN** the Tag acquisition layer SHALL create monitored items for configured OPC UA Tag bindings
- **AND** monitored item notifications SHALL be grouped into TagCache batch updates where practical

#### Scenario: Notifications update TagCache
- **WHEN** an OPC UA monitored item notification is received and decoded successfully
- **THEN** TagService SHALL produce a TagValue with `quality` equal to `Good`
- **AND** TagCache SHALL publish it through the same batch update path used by Modbus polling

#### Scenario: Bad OPC UA status degrades quality
- **WHEN** an OPC UA notification or read result reports bad or uncertain quality
- **THEN** the affected TagValue SHALL be marked `Bad` or `Uncertain` according to the unified TagQuality model
- **AND** prior values SHALL NOT continue to be displayed as fresh `Good` data

#### Scenario: Subscription failure enters reconnect lifecycle
- **WHEN** an OPC UA subscription or session fails unexpectedly while the device is `Connected`
- **THEN** DeviceManager SHALL be notified through a protocol-neutral communication failure path
- **AND** the device SHALL enter the existing reconnect and Tag Quality lifecycle

#### Scenario: Subscription fallback is explicit
- **WHEN** an OPC UA endpoint or test configuration does not support subscription
- **THEN** the system MAY use polling fallback only if adapter capability and configuration explicitly allow it
- **AND** logs and performance reports SHALL identify that fallback mode was used

### Requirement: Protocol Switching
The system SHALL allow the simulated mixer device configuration to select Modbus TCP or OPC UA without changing Dashboard or ViewModel data logic.

#### Scenario: Device config selects protocol kind
- **WHEN** a device configuration is created or edited
- **THEN** it SHALL include a protocol kind with supported values `modbusTcp` and `opcUa`
- **AND** protocol-specific endpoint fields SHALL be validated in Main Process before connection

#### Scenario: Modbus remains default protocol
- **WHEN** the default simulated mixer device configuration is created without an explicit protocol override
- **THEN** it SHALL select `modbusTcp`
- **AND** OPC UA SHALL remain an optional protocol configuration

#### Scenario: DeviceManager uses adapter factory
- **WHEN** DeviceManager connects a configured device
- **THEN** it SHALL obtain the concrete adapter from a protocol adapter factory or registry
- **AND** business services SHALL continue depending on `IProtocolAdapter`

#### Scenario: Dashboard remains protocol-agnostic
- **WHEN** Dashboard displays Temperature, Level, RPM, Running, alarms, trends, or command results
- **THEN** it SHALL consume Tag, Device State, Alarm, Trend, and Command ViewModel state
- **AND** Dashboard View and ViewModel SHALL NOT branch on Modbus register type or OPC UA NodeId

#### Scenario: Protocol label is display-only
- **WHEN** Renderer displays the selected protocol or endpoint summary
- **THEN** that label SHALL be used only for operator context and demo clarity
- **AND** Renderer SHALL NOT use it to choose protocol read, write, decode, or subscription logic

### Requirement: OPC UA Command Integration
The system SHALL route OPC UA writes through the existing CommandService boundary.

#### Scenario: Setpoint write uses CommandService
- **WHEN** the user changes Setpoint while the device uses OPC UA
- **THEN** Renderer SHALL call the typed command API
- **AND** CommandService SHALL validate permission, device state, writable target, value range, audit preflight, timeout, and verification before reporting success

#### Scenario: OPC UA write acceptance is not final verification
- **WHEN** an OPC UA write returns successfully
- **THEN** CommandService SHALL treat it as write acceptance only
- **AND** the command SHALL be verified only after read-back or feedback confirms the expected device state

#### Scenario: Renderer does not send NodeIds
- **WHEN** Renderer requests a command for an OPC UA device
- **THEN** the request SHALL use controlled command or Tag identifiers
- **AND** Renderer SHALL NOT submit raw OPC UA NodeIds, namespace indexes, session ids, or subscription ids
