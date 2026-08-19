## ADDED Requirements

### Requirement: Protocol Capability Descriptor
The Main Process protocol abstraction SHALL expose protocol capabilities so business services can choose supported acquisition and command behavior without depending on concrete adapters.

#### Scenario: Adapter reports capabilities
- **WHEN** any `IProtocolAdapter` implementation is inspected after construction
- **THEN** it SHALL expose a protocol capability descriptor or equivalent method
- **AND** the descriptor SHALL include protocol kind, preferred acquisition mode, polling support, subscription support, batch read support, write support, and read-back support

#### Scenario: Modbus capabilities reflect polling
- **WHEN** `ModbusAdapter` reports its capabilities
- **THEN** the preferred acquisition mode SHALL be `polling`
- **AND** batch read support SHALL be true for continuous Modbus address ranges
- **AND** subscription support SHALL be false unless a later explicit Modbus extension adds it

#### Scenario: Business modules use capabilities
- **WHEN** DeviceManager, Tag acquisition, or CommandService needs protocol-specific behavior
- **THEN** it SHALL use protocol capabilities and configured Tag/Command bindings
- **AND** it SHALL NOT use concrete class checks such as `instanceof ModbusAdapter` or `instanceof OpcUaAdapter`

### Requirement: Adapter Factory Selection
The system SHALL create protocol adapters through a central factory or registry based on device configuration.

#### Scenario: Modbus config creates ModbusAdapter
- **WHEN** a device configuration selects `modbusTcp`
- **THEN** the adapter factory SHALL create a `ModbusAdapter` with the configured host, port, unit id, connect timeout, and request timeout
- **AND** existing default simulator settings SHALL remain supported

#### Scenario: OPC UA config does not change Modbus defaults
- **WHEN** OPC UA support is added
- **THEN** the default Modbus TCP Simulator endpoint, unit id, address mapping, timeouts, and manual validation flow SHALL remain compatible unless a separate change explicitly modifies them

#### Scenario: Unsupported protocol is rejected
- **WHEN** a device configuration contains an unsupported protocol kind
- **THEN** Main Process SHALL reject the configuration or transition the device to `Fault`
- **AND** Renderer SHALL receive a unified user-facing error rather than a low-level factory exception

### Requirement: Modbus Regression Preservation
The existing Modbus TCP Simulator and ModbusAdapter behavior SHALL remain protected while OPC UA is added.

#### Scenario: Modbus simulator integration still passes
- **WHEN** the Modbus TCP Simulator is running on the default endpoint
- **THEN** HMI integration tests SHALL still verify connect, read, write, disconnect, reconnect, and command behavior through `ModbusAdapter`

#### Scenario: Modbus batching remains active
- **WHEN** continuous Modbus Tags are polled
- **THEN** PollingScheduler SHALL continue batching safe continuous address ranges
- **AND** adding OPC UA SHALL NOT cause one Modbus request per Tag for the default mixer Tags

#### Scenario: Modbus errors still trigger quality and reconnect
- **WHEN** the Modbus Simulator disconnect fault is triggered during polling
- **THEN** affected Tags SHALL become `Bad`
- **AND** DeviceManager SHALL enter the existing automatic reconnect lifecycle
