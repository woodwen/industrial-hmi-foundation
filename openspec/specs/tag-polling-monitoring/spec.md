# tag-polling-monitoring Specification

## Purpose
TBD - created by archiving change add-tag-polling-monitoring. Update Purpose after archive.
## Requirements
### Requirement: Tag Domain Model
The system SHALL define a unified industrial Tag domain model for real-time monitoring data.

#### Scenario: TagDefinition contains required fields
- **WHEN** Tag definitions are inspected
- **THEN** each TagDefinition SHALL include `id`, `name`, `deviceId`, `address`, `registerType`, `dataType`, `scale`, `offset`, `unit`, `writable`, and `scanRate`
- **AND** implementation MAY include additional metadata such as `referenceAddress`, `quantity`, `description`, or dashboard display role

#### Scenario: TagValue contains quality and timestamp
- **WHEN** any real-time Tag value is created or updated
- **THEN** it SHALL include `tagId`, `value`, `quality`, and `timestamp`
- **AND** the system SHALL NOT represent real-time industrial data as only `tagId` plus `value`

#### Scenario: TagQuality uses explicit states
- **WHEN** Tag quality is represented
- **THEN** it SHALL use explicit states `Good`, `Bad`, and `Uncertain`
- **AND** stale, failed, or not-yet-read values SHALL NOT be reported as normal `Good` real-time values

#### Scenario: Default mixer monitoring tags exist
- **WHEN** the default simulated mixer device Tag definitions are loaded
- **THEN** Tags SHALL exist for current temperature, current level, current pressure, motor RPM, production count, running state, and operation mode
- **AND** these Tags SHALL reference the existing simulated Modbus device id

#### Scenario: Default scan rates are assigned
- **WHEN** the default simulated mixer device Tag definitions are loaded
- **THEN** current temperature, current level, current pressure, motor RPM, running state, and operation mode SHALL use `500ms` scan rate
- **AND** production count, target temperature, and manual motor RPM setpoint SHALL use `1000ms` scan rate
- **AND** `100ms` SHALL remain a supported scan rate without being assigned to core Dashboard Tags by default

### Requirement: TagService
The Main Process SHALL provide a TagService that centrally manages Tag definitions and converts protocol reads into Tag values.

#### Scenario: Tag definitions are listed through TagService
- **WHEN** Main Process services need configured monitoring Tags
- **THEN** they SHALL obtain Tag definitions through TagService
- **AND** duplicate hard-coded monitoring Tag lists SHALL NOT be required across PollingScheduler, IPC, Dashboard, and Device Tag Monitor

#### Scenario: Raw Modbus data is decoded through TagService
- **WHEN** PollingScheduler receives raw Modbus values for a Scan Group
- **THEN** TagService SHALL decode each Tag according to its `dataType`
- **AND** TagService SHALL apply `scale` and `offset` before producing TagValue

#### Scenario: Successful reads become Good quality
- **WHEN** raw protocol data is read and decoded successfully for a Tag
- **THEN** TagService SHALL update that TagValue with `quality` equal to `Good`
- **AND** it SHALL set `timestamp` to the read/update time

#### Scenario: Decode failures do not crash Renderer
- **WHEN** a Tag cannot be decoded from the raw protocol result
- **THEN** TagService SHALL produce or preserve a TagValue with `quality` equal to `Bad`
- **AND** the error SHALL be logged without propagating a low-level protocol exception to Renderer

### Requirement: TagCache
The Main Process SHALL provide a TagCache that stores the latest value for every configured Tag.

#### Scenario: Cache initializes all Tags
- **WHEN** TagCache is initialized
- **THEN** it SHALL create or expose a current TagValue for every configured Tag
- **AND** Tags that have not yet been successfully sampled SHALL have `quality` equal to `Uncertain`

#### Scenario: Cache updates are batched
- **WHEN** multiple TagValues are produced from one protocol read or polling tick
- **THEN** TagCache SHALL accept the values as a batch
- **AND** consumers SHALL be able to observe the batch without requiring one event per Tag

#### Scenario: Cache preserves latest values
- **WHEN** TagCache is queried for a snapshot
- **THEN** it SHALL return the latest TagDefinition and TagValue data available for configured Tags
- **AND** every returned TagValue SHALL contain `quality` and `timestamp`

#### Scenario: Failed reads update quality
- **WHEN** a protocol read fails for a Scan Group after a prior successful value existed
- **THEN** TagCache SHALL retain or update the affected Tags with `quality` equal to `Bad`
- **AND** the UI SHALL be able to distinguish the stale or failed value from a normal `Good` real-time value

### Requirement: PollingScheduler Scan Groups
The Main Process SHALL provide a PollingScheduler that performs periodic Tag sampling through Scan Groups.

#### Scenario: Scheduler supports standard scan rates
- **WHEN** PollingScheduler is configured
- **THEN** it SHALL support scan rates of `100ms`, `500ms`, and `1000ms`
- **AND** the default simulated mixer configuration SHALL assign core monitoring Tags to `500ms` and slow-changing or setpoint Tags to `1000ms`

#### Scenario: Scheduler does not create one timer per Tag
- **WHEN** multiple Tags are sampled periodically
- **THEN** PollingScheduler SHALL NOT create a separate `setInterval` for each Tag
- **AND** timers SHALL be grouped by device and scan rate or by an equivalently bounded scheduler strategy

#### Scenario: Scan Groups include grouping dimensions
- **WHEN** PollingScheduler builds Scan Groups
- **THEN** it SHALL consider `deviceId`, `scanRate`, Modbus `registerType`, and address continuity
- **AND** Tags from different devices, scan rates, or register types SHALL NOT be merged into the same protocol read

#### Scenario: Scheduler avoids uncontrolled reentry
- **WHEN** a scan rate tick occurs before the previous tick for the same device and scan rate has completed
- **THEN** PollingScheduler SHALL skip or defer the overlapping tick
- **AND** it SHALL NOT start uncontrolled concurrent Modbus reads against the same device connection

#### Scenario: Scheduler cleanup releases timers
- **WHEN** the device is disconnected or the application runtime is disposed
- **THEN** PollingScheduler SHALL stop relevant timers
- **AND** it SHALL release scheduler resources so polling does not continue after cleanup

### Requirement: Register Batching
PollingScheduler SHALL batch continuous Modbus addresses into range reads when it is safe to do so.

#### Scenario: Continuous input registers are read together
- **WHEN** Tags map to continuous Input Registers such as `30001`, `30002`, `30003`, `30004`, and `30005-30006`
- **THEN** PollingScheduler SHALL read them using one continuous Input Register range when they share the same device and scan rate
- **AND** it SHALL NOT issue one Modbus request per Tag for those continuous registers

#### Scenario: Continuous holding registers are read together
- **WHEN** Tags map to continuous Holding Registers such as `40001` and `40002`
- **THEN** PollingScheduler SHALL read them using one continuous Holding Register range when they share the same device and scan rate

#### Scenario: Continuous discrete inputs are read together
- **WHEN** Tags map to continuous Discrete Inputs such as `10001` through `10005`
- **THEN** PollingScheduler SHALL read them using one continuous Discrete Input range when they share the same device and scan rate

#### Scenario: Non-continuous addresses are not blindly merged
- **WHEN** Tags in the same bucket have an address gap
- **THEN** PollingScheduler SHALL split them into separate Scan Groups unless design explicitly defines a safe maximum gap
- **AND** it SHALL avoid reading large undefined ranges that could produce Modbus illegal address errors

#### Scenario: Batched raw values are decoded per Tag
- **WHEN** a batched Modbus read returns raw values for multiple Tags
- **THEN** TagService SHALL slice the raw values for each Tag by address offset and quantity
- **AND** each produced TagValue SHALL preserve the correct Tag id, engineering value, quality, and timestamp

### Requirement: Polling Error Handling
The polling chain SHALL handle protocol failures, data timeout, and automatic recovery without crashing Renderer.

#### Scenario: Simulator stops during polling
- **WHEN** the PLC Simulator stops after polling has started
- **THEN** the next affected polling result SHALL mark relevant Tags as `Bad`
- **AND** the device state SHALL enter `Reconnecting`
- **AND** the Electron Renderer SHALL remain usable

#### Scenario: Manual disconnect marks values uncertain
- **WHEN** the user manually disconnects the device through the HMI
- **THEN** polling for that device SHALL stop
- **AND** affected Tags SHALL be marked `Uncertain`
- **AND** the system SHALL NOT report those values as fresh `Good` real-time values

#### Scenario: Device is not connected
- **WHEN** PollingScheduler is asked to poll while the device is not connected
- **THEN** it SHALL avoid sending protocol reads
- **AND** affected Tags SHALL NOT be shown as fresh `Good` real-time values

#### Scenario: Reconnecting pauses polling
- **WHEN** a device enters `Reconnecting`
- **THEN** PollingScheduler SHALL stop or pause polling for that device
- **AND** related Tags SHALL remain `Bad` until polling restarts and succeeds after reconnect

#### Scenario: Data timeout marks affected Tags bad
- **WHEN** a Tag exceeds its configured stale timeout without a successful sample
- **THEN** TagCache SHALL update that Tag with `quality` equal to `Bad`
- **AND** Dashboard or Device Tag Monitor SHALL display the degraded quality

#### Scenario: Polling failures are logged
- **WHEN** a Scan Group read fails
- **THEN** the system SHALL log a communication entry containing the device id, scan group, register type, address range, and error summary
- **AND** high-frequency repeated failures SHALL be controlled to avoid excessive log spam

#### Scenario: Manual recovery does not require HMI restart
- **WHEN** Simulator communication fails and the Simulator later recovers
- **THEN** DeviceManager SHALL reconnect automatically using bounded backoff
- **AND** polling SHALL resume without restarting the Electron HMI
- **AND** subsequent successful reads SHALL update affected Tags back to `Good`

### Requirement: Typed Tag IPC
The system SHALL expose real-time Tag monitoring to Renderer through typed Preload APIs.

#### Scenario: Renderer retrieves Tag snapshot
- **WHEN** Renderer initializes real-time monitoring state
- **THEN** it SHALL call a typed Preload API to retrieve Tag definitions and current TagValues
- **AND** the snapshot SHALL include `quality` and `timestamp` for every TagValue

#### Scenario: Renderer subscribes to batched Tag updates
- **WHEN** Renderer needs live Tag updates
- **THEN** it SHALL subscribe through a typed Preload API that returns an unsubscribe function
- **AND** Renderer SHALL NOT receive raw `ipcRenderer`, arbitrary IPC channel access, Node.js APIs, TCP sockets, or Modbus clients

#### Scenario: Tag IPC sends batches
- **WHEN** multiple TagValues change within the IPC throttle window
- **THEN** Main Process SHALL send them to Renderer as one batch event using the default `250ms` throttle interval
- **AND** it SHALL NOT send one IPC event per Tag by default

#### Scenario: IPC uses change detection
- **WHEN** a polling cycle only updates timestamps but the Tag engineering value and quality have not changed
- **THEN** the normal change event path SHALL be allowed to suppress that update
- **AND** the system SHALL use a default `2000ms` heartbeat or snapshot refresh to keep displayed timestamps from becoming misleading

#### Scenario: Subscription cleanup removes listeners
- **WHEN** Renderer unsubscribes or its window is destroyed
- **THEN** Tag IPC subscription listeners SHALL be removed
- **AND** Main Process SHALL NOT keep stale Renderer listeners for Tag updates

### Requirement: Renderer Monitoring ViewModels
Renderer ViewModels SHALL consume Tag snapshot and batch events without directly polling Modbus.

#### Scenario: Shared Tag ViewModel stores values
- **WHEN** Renderer receives a Tag snapshot or batch update
- **THEN** a Renderer ViewModel SHALL store TagValues in MobX observable state
- **AND** batch updates SHALL be applied inside one MobX action or equivalent batched update

#### Scenario: Dashboard derives metrics from Tags
- **WHEN** Dashboard is displayed
- **THEN** DashboardViewModel SHALL derive Temperature, Level, Pressure, RPM, Running State, Mode, and Production Count from Tag values
- **AND** Dashboard View SHALL NOT call Modbus, TCP, Node.js, or raw IPC APIs

#### Scenario: Device Tag Monitor derives rows from Tags
- **WHEN** Device page displays Tag Monitor
- **THEN** DeviceViewModel or a shared Tag ViewModel SHALL provide rows containing Tag Name, Value, Unit, Quality, and Timestamp
- **AND** Device Tag Monitor SHALL NOT perform protocol reads from React View code

#### Scenario: Bad quality is visible
- **WHEN** a TagValue has `quality` equal to `Bad` or `Uncertain`
- **THEN** Dashboard or Device Tag Monitor SHALL display a distinguishable quality state
- **AND** it SHALL NOT present the value as normal fresh `Good` data

### Requirement: Dashboard Real-Time Monitoring
The Dashboard SHALL display live simulated mixer monitoring values from the Tag pipeline.

#### Scenario: Dashboard shows required real-time values
- **WHEN** the Simulator is running, the device is connected, and polling has produced good values
- **THEN** Dashboard SHALL display Temperature, Level, Pressure, RPM, Running State, Mode, and Production Count
- **AND** displayed values SHALL come from TagCache through typed IPC and ViewModel state

#### Scenario: Dashboard excludes setpoints by default
- **WHEN** Dashboard real-time monitoring is displayed
- **THEN** target temperature and manual motor RPM setpoint SHALL NOT be required as primary Dashboard metrics
- **AND** those setpoint Tags SHALL remain available through Device Tag Monitor

#### Scenario: Simulator changes appear in Dashboard
- **WHEN** Simulator process values change over time
- **THEN** Dashboard SHALL update its displayed values through Tag batch updates
- **AND** React rendering SHALL NOT be directly tied to every PLC sampling operation

#### Scenario: Dashboard handles communication loss
- **WHEN** Simulator communication stops after Dashboard has displayed values
- **THEN** Dashboard SHALL remain mounted and usable
- **AND** affected values SHALL show non-Good quality or an equivalent degraded state

### Requirement: Device Tag Monitor
The Device page SHALL provide a Tag Monitor for all configured monitoring Tags.

#### Scenario: Tag Monitor displays required columns
- **WHEN** Device Tag Monitor is displayed
- **THEN** it SHALL show at least Tag Name, Value, Unit, Quality, and Timestamp

#### Scenario: Tag Monitor uses the shared Tag pipeline
- **WHEN** Tag values update in TagCache
- **THEN** Device Tag Monitor SHALL receive updates through the same typed IPC and Renderer ViewModel pipeline as Dashboard
- **AND** it SHALL NOT rely on manually clicking read buttons for real-time Tag updates

#### Scenario: Tag Monitor remains safe after Simulator stop
- **WHEN** Simulator stops during monitoring
- **THEN** Device Tag Monitor SHALL keep rendering without crashing
- **AND** affected Tags SHALL show `Bad` or `Uncertain` quality

### Requirement: Architecture Boundaries
The real-time monitoring implementation SHALL preserve Electron process and MVVM boundaries.

#### Scenario: Renderer does not import protocol infrastructure
- **WHEN** Renderer source is inspected or architecture boundary tests run
- **THEN** Renderer SHALL NOT import Main Process modules, Node.js APIs, TCP clients, ModbusAdapter, PollingScheduler, TagService, or TagCache

#### Scenario: Protocol libraries remain in infrastructure
- **WHEN** TagService, DashboardViewModel, or DeviceViewModel are implemented
- **THEN** they SHALL NOT depend on a concrete Modbus TCP library
- **AND** concrete Modbus behavior SHALL remain behind `IProtocolAdapter` and Main Process protocol infrastructure

#### Scenario: View code remains presentation-focused
- **WHEN** DashboardPage or DevicePage renders monitoring data
- **THEN** React View code SHALL read prepared ViewModel fields
- **AND** it SHALL NOT understand Modbus function codes, scan group construction, polling timers, or raw protocol decoding

### Requirement: Verification Coverage
The change SHALL include verification for the Tag polling and monitoring chain.

#### Scenario: Tag model and decode tests exist
- **WHEN** unit tests run
- **THEN** tests SHALL verify TagDefinition defaults, TagQuality states, decode behavior, scale/offset behavior, and TagValue timestamp/quality presence

#### Scenario: Scan group tests exist
- **WHEN** unit tests run
- **THEN** tests SHALL verify Scan Group construction by device, scan rate, register type, and address continuity
- **AND** tests SHALL verify continuous registers are batched instead of read one Tag at a time

#### Scenario: IPC and ViewModel tests exist
- **WHEN** renderer and contract tests run
- **THEN** tests SHALL verify typed Tag snapshot/subscription APIs and batched ViewModel update behavior
- **AND** tests SHALL verify Renderer does not directly import prohibited protocol or Main Process modules

#### Scenario: End-to-end chain is verified
- **WHEN** integration or manual acceptance verification is performed
- **THEN** Simulator -> ModbusAdapter -> PollingScheduler -> TagService -> TagCache -> IPC -> ViewModel -> React data flow SHALL be shown to work
- **AND** stopping Simulator SHALL be verified to avoid Renderer crashes

### Requirement: Tag Quality Resilience Lifecycle
The system SHALL maintain correct Tag Quality during communication loss, reconnect, data timeout, and recovery.

#### Scenario: Connection loss marks device Tags bad
- **WHEN** a connected device unexpectedly loses communication
- **THEN** all configured Tags for that device SHALL be marked with `quality` equal to `Bad`
- **AND** the system SHALL NOT keep showing prior values as normal `Good` real-time values

#### Scenario: Last value can be retained with bad quality
- **WHEN** communication fails after a Tag previously had a value
- **THEN** TagCache SHALL be allowed to retain the last engineering value
- **AND** it SHALL update `quality` to `Bad` and refresh `timestamp` or quality-change time so UI can identify the value as stale or failed

#### Scenario: Reconnecting keeps values non-good
- **WHEN** a device is in `Reconnecting`
- **THEN** related Tags SHALL remain `Bad` until a successful post-reconnect sample is decoded

#### Scenario: Data timeout marks stale Tags bad
- **WHEN** a Tag has not been successfully sampled before its configured stale timeout
- **THEN** that Tag SHALL be marked `Bad`
- **AND** the UI SHALL be able to distinguish the stale value from fresh `Good` data

#### Scenario: Default stale timeout is derived from scan rate
- **WHEN** stale timeout is calculated for a Tag
- **THEN** the timeout SHALL default to `max(3 * scanRate, 3000ms)`
- **AND** the timeout SHALL be evaluated independently from UI refresh throttling

#### Scenario: Successful post-reconnect sample restores good quality
- **WHEN** automatic reconnect succeeds and polling successfully samples a Tag again
- **THEN** that Tag SHALL be updated with `quality` equal to `Good`
- **AND** its timestamp SHALL reflect the successful sample time

#### Scenario: Manual disconnect remains uncertain
- **WHEN** the user manually disconnects a device
- **THEN** related Tags SHALL be marked `Uncertain`
- **AND** the system SHALL NOT present them as fresh `Good` real-time values

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
