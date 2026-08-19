## ADDED Requirements

### Requirement: Protocol-Neutral Tag Acquisition
The Tag pipeline SHALL accept TagValue batches from both polling and subscription acquisition sources.

#### Scenario: Acquisition mode follows adapter capability
- **WHEN** a connected device starts Tag acquisition
- **THEN** the system SHALL choose polling or subscription according to adapter capability and device configuration
- **AND** the choice SHALL be logged with device id, protocol kind, and acquisition mode

#### Scenario: Polling remains valid for Modbus
- **WHEN** the selected protocol is Modbus TCP
- **THEN** PollingScheduler SHALL remain the default acquisition mechanism
- **AND** it SHALL preserve scan-rate grouping and address continuity batching

#### Scenario: Subscription is valid for OPC UA
- **WHEN** the selected protocol is OPC UA and subscription is supported
- **THEN** the acquisition layer SHALL use OPC UA monitored item notifications instead of defaulting to periodic polling
- **AND** notifications SHALL feed the same TagService and TagCache batch path as polling

#### Scenario: Acquisition cleanup follows device lifecycle
- **WHEN** a device disconnects, reconnects, faults, or runtime disposes
- **THEN** all acquisition resources for that device SHALL be stopped or disposed
- **AND** stale polling timers or OPC UA subscriptions SHALL NOT continue producing Tag updates

### Requirement: Protocol Binding Decode
TagService SHALL decode Tag values using protocol-neutral Tag definitions and protocol-specific bindings without leaking protocol details to Renderer.

#### Scenario: Modbus binding uses existing decode
- **WHEN** a Modbus polling result is decoded
- **THEN** TagService SHALL continue applying data type, scale, offset, unit, quantity, and quality rules from existing Modbus Tag definitions

#### Scenario: OPC UA binding maps node values
- **WHEN** an OPC UA variable update is decoded
- **THEN** TagService SHALL map the configured OPC UA binding to the corresponding Tag id
- **AND** it SHALL normalize the raw value into the existing TagValue shape with value, quality, and timestamp

#### Scenario: Renderer receives no protocol binding
- **WHEN** Renderer receives a Tag snapshot or update batch
- **THEN** it SHALL receive TagDefinition and TagValue DTOs suitable for UI display
- **AND** it SHALL NOT receive Modbus PDU addresses, OPC UA NodeIds, subscription ids, or client handles as runtime control data

### Requirement: Acquisition Metrics
The Tag acquisition layer SHALL produce metrics needed for performance and long-running verification.

#### Scenario: Polling metrics are recorded
- **WHEN** PollingScheduler executes scan groups
- **THEN** the system SHALL be able to record request count, scan group count, polling duration, skipped tick count, failed request count, and decoded Tag count

#### Scenario: Subscription metrics are recorded
- **WHEN** OPC UA subscriptions are active
- **THEN** the system SHALL be able to record subscription count, monitored item count, notification count, notification processing duration, bad status count, and reconnect count

#### Scenario: IPC and Renderer rates are measured
- **WHEN** TagCache updates are published to Renderer
- **THEN** the system SHALL be able to measure IPC message rate, average batch size, suppressed update count, and Renderer update rate
- **AND** these metrics SHALL be usable in 100, 500, and 1000 Tag performance profiles

### Requirement: Large Tag Update Boundaries
The Tag pipeline SHALL remain bounded when handling large Tag counts.

#### Scenario: IPC remains batched
- **WHEN** 100, 500, or 1000 Tags update within a throttle window
- **THEN** Tag IPC SHALL continue sending batched updates rather than one IPC message per Tag

#### Scenario: Renderer applies batches
- **WHEN** Renderer receives a large Tag update batch
- **THEN** the relevant ViewModel SHALL apply the batch in a bounded update action
- **AND** React rendering SHALL NOT be directly tied to every individual PLC sample or OPC UA notification

#### Scenario: Quality rules stay active at scale
- **WHEN** a large Tag profile experiences communication loss or stale data
- **THEN** affected Tags SHALL still be marked `Bad` or `Uncertain` according to the existing Tag Quality lifecycle
- **AND** performance mode SHALL NOT bypass quality handling to improve reported numbers
