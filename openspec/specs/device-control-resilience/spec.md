# device-control-resilience Specification

## Purpose
TBD - created by archiving change add-device-control-resilience. Update Purpose after archive.
## Requirements
### Requirement: Device State Machine
The system SHALL manage each industrial device connection through an explicit Device State Machine.

#### Scenario: Supported device states are explicit
- **WHEN** device connection state is represented
- **THEN** it SHALL use explicit states `Disconnected`, `Connecting`, `Connected`, `Reconnecting`, and `Fault`
- **AND** it SHALL NOT represent the lifecycle through multiple independent boolean flags

#### Scenario: Legal state transitions are enforced
- **WHEN** a device state transition is requested
- **THEN** the system SHALL allow only documented transitions between `Disconnected`, `Connecting`, `Connected`, `Reconnecting`, and `Fault`
- **AND** invalid transitions SHALL be rejected or ignored with an application/error log entry

#### Scenario: Manual connect enters connecting
- **WHEN** the user requests Connect while the device is `Disconnected` or retryable `Fault`
- **THEN** the device state SHALL transition to `Connecting`

#### Scenario: Successful connect enters connected
- **WHEN** the protocol adapter connects successfully from `Connecting`
- **THEN** the device state SHALL transition to `Connected`
- **AND** polling for that device SHALL be eligible to start

#### Scenario: Initial connect failure enters fault without reconnect loop
- **WHEN** the first user-initiated connection attempt fails before the device has reached `Connected`
- **THEN** the device state SHALL transition to `Fault`
- **AND** the system SHALL NOT start the automatic reconnect loop until the user retries or connects again

#### Scenario: Unexpected communication loss enters reconnecting
- **WHEN** polling, status check, read, or command execution detects an unexpected connection loss while the device is `Connected`
- **THEN** the device state SHALL transition to `Reconnecting`
- **AND** the transition SHALL be published to Renderer through typed device state APIs

#### Scenario: Manual disconnect stops lifecycle
- **WHEN** the user manually disconnects a device from `Connecting`, `Connected`, `Reconnecting`, or `Fault`
- **THEN** the device state SHALL transition to `Disconnected`
- **AND** active reconnect timers, polling timers, pending command verification, and protocol resources SHALL be cleaned up

### Requirement: Automatic Reconnect Backoff
The system SHALL automatically reconnect a device after unexpected communication loss using a bounded backoff strategy.

#### Scenario: Reconnect uses bounded delays
- **WHEN** a connected device loses communication unexpectedly
- **THEN** reconnect attempts SHALL use a backoff sequence equivalent to `1000ms`, `2000ms`, `4000ms`, `8000ms`, and a maximum interval of `10000ms`
- **AND** the system SHALL NOT perform zero-delay or high-frequency infinite reconnect attempts

#### Scenario: Reconnect has no default maximum attempt count
- **WHEN** a retryable communication loss remains unresolved
- **THEN** the reconnect loop SHALL continue retrying by default
- **AND** every retry SHALL respect the configured maximum interval of `10000ms`

#### Scenario: Only one reconnect loop exists
- **WHEN** a device is already `Reconnecting`
- **THEN** the system SHALL NOT start a second reconnect loop for the same device

#### Scenario: Reconnect success restores connected state
- **WHEN** a reconnect attempt succeeds
- **THEN** the device state SHALL transition from `Reconnecting` to `Connected`
- **AND** polling for that device SHALL restart without requiring an Electron HMI restart

#### Scenario: Reconnect can be cancelled
- **WHEN** the user manually disconnects during `Reconnecting`
- **THEN** the reconnect loop SHALL stop
- **AND** no further reconnect attempts SHALL be scheduled for that device until the user connects again

#### Scenario: Unrecoverable reconnect failure enters fault
- **WHEN** reconnect fails because of an unrecoverable configuration or resource error
- **THEN** the device state SHALL transition to `Fault`
- **AND** the system SHALL stop automatic reconnect attempts until the user retries or resets the device lifecycle

### Requirement: Device State IPC
The system SHALL expose device state snapshots and updates to Renderer through typed Preload APIs.

#### Scenario: Renderer retrieves device state snapshot
- **WHEN** Renderer initializes Device or Dashboard state
- **THEN** it SHALL retrieve current device state through a typed Preload API
- **AND** the response SHALL include device id, state, endpoint summary, last transition time, and optional user-facing error summary

#### Scenario: Renderer subscribes to device state changes
- **WHEN** device state changes in Main Process
- **THEN** Renderer SHALL receive the update through a typed subscription API
- **AND** Renderer SHALL NOT receive raw `ipcRenderer`, protocol adapter instances, TCP sockets, or Modbus clients

#### Scenario: Device state subscription cleans up listeners
- **WHEN** Renderer unsubscribes or its window is destroyed
- **THEN** Main Process and Preload SHALL remove the related device state listeners

### Requirement: CommandService Routing
The system SHALL route all device write operations through Main Process `CommandService`.

#### Scenario: Renderer command flow crosses correct layers
- **WHEN** the user executes a device control command from the UI
- **THEN** the request SHALL flow Renderer View -> ViewModel -> typed Preload API -> Main IPC -> CommandService -> IProtocolAdapter -> PLC
- **AND** Renderer ViewModel SHALL NOT call protocol write methods directly

#### Scenario: CommandService owns write validation
- **WHEN** a command request reaches Main Process
- **THEN** CommandService SHALL validate writability, value type, value range, device state, and command definition before calling the protocol adapter

#### Scenario: Protocol details remain behind adapter
- **WHEN** CommandService executes a command
- **THEN** it SHALL depend on `IProtocolAdapter`
- **AND** it SHALL NOT expose Modbus function codes, raw register addresses, TCP sockets, or concrete protocol library errors to Renderer

### Requirement: Device Control Commands
The system SHALL support basic control commands for the simulated constant-temperature mixing equipment.

#### Scenario: Start command is supported
- **WHEN** the user executes Start
- **THEN** CommandService SHALL write the configured device start command point
- **AND** it SHALL verify the device running feedback when configured

#### Scenario: Stop command is supported
- **WHEN** the user executes Stop
- **THEN** CommandService SHALL write the configured device start command point to the stopped value
- **AND** it SHALL verify the device running feedback becomes stopped when configured

#### Scenario: Motor start and stop commands are supported
- **WHEN** the user executes Motor Start or Motor Stop
- **THEN** CommandService SHALL write the configured mixer motor command point
- **AND** it SHALL verify the mixer motor feedback when configured

#### Scenario: Valve control commands are supported
- **WHEN** the user commands Inlet Valve or Outlet Valve open or closed
- **THEN** CommandService SHALL write the configured valve command point
- **AND** it SHALL verify the corresponding valve feedback when configured

#### Scenario: Target temperature command is supported
- **WHEN** the user writes Target Temperature
- **THEN** CommandService SHALL write the configured writable target temperature Tag
- **AND** it SHALL verify the value through holding-register read-back

#### Scenario: RPM setpoint command is supported
- **WHEN** the user writes RPM Setpoint
- **THEN** CommandService SHALL write the configured writable manual motor RPM setpoint Tag
- **AND** it SHALL verify the value through holding-register read-back

### Requirement: Command Validation and Protection
The system SHALL reject unsafe or invalid command requests before they reach the protocol adapter.

#### Scenario: Read-only Tag cannot be written
- **WHEN** a command attempts to write a Tag whose definition is not writable
- **THEN** CommandService SHALL reject the command before calling the protocol adapter
- **AND** the result SHALL identify the command as rejected rather than failed communication

#### Scenario: Invalid value type cannot be written
- **WHEN** a command value does not match the target Tag data type
- **THEN** CommandService SHALL reject the command before calling the protocol adapter

#### Scenario: Target temperature range is enforced
- **WHEN** Target Temperature is lower than `20.0°C` or higher than `90.0°C`
- **THEN** CommandService SHALL reject the command before calling the protocol adapter

#### Scenario: RPM setpoint range is enforced
- **WHEN** RPM Setpoint is lower than `0` or higher than `1800 rpm`
- **THEN** CommandService SHALL reject the command before calling the protocol adapter

#### Scenario: Safety scope is explicit
- **WHEN** command validation is documented or displayed
- **THEN** the system SHALL describe it as simulator/HMI-level protection
- **AND** it SHALL NOT claim to provide real industrial Safety PLC protection

### Requirement: Write Verification
The system SHALL distinguish protocol write acceptance from verified device state.

#### Scenario: Write response alone is not final verification
- **WHEN** the protocol adapter reports a successful Modbus write response
- **THEN** CommandService SHALL record that the write request was accepted
- **AND** it SHALL NOT report the command as verified unless the configured verification strategy succeeds

#### Scenario: Holding register commands use read-back
- **WHEN** Target Temperature or RPM Setpoint is written successfully
- **THEN** CommandService SHALL read back the configured holding register
- **AND** the command SHALL be verified only when the read-back value matches the requested engineering value within the configured tolerance

#### Scenario: Target temperature read-back uses default tolerance
- **WHEN** Target Temperature read-back verification compares the actual value with the requested value
- **THEN** the command SHALL be considered verified only when the engineering value differs by no more than `0.1°C`

#### Scenario: RPM setpoint read-back uses exact integer match
- **WHEN** RPM Setpoint read-back verification compares the actual value with the requested value
- **THEN** the command SHALL be considered verified only when the integer RPM value exactly matches the requested setpoint

#### Scenario: Boolean control commands use feedback when available
- **WHEN** Start, Stop, Motor Start/Stop, Inlet Valve, or Outlet Valve command is written successfully
- **THEN** CommandService SHALL read the configured feedback point when available
- **AND** the command SHALL be verified only when the feedback reaches the expected state before timeout

#### Scenario: Verification result is structured
- **WHEN** a command completes
- **THEN** CommandService SHALL return a structured result that identifies write acceptance, verification status, duration, command id, target Tag id, and any user-facing error summary

#### Scenario: Future handshake can be added
- **WHEN** a future PLC acknowledgement strategy is introduced
- **THEN** it SHALL be addable as a new verification strategy without bypassing CommandService

### Requirement: Command Timeout and Concurrency
The system SHALL bound command execution time and control concurrent protocol operations per device.

#### Scenario: Command timeout returns without blocking UI
- **WHEN** command verification does not complete before the configured command timeout
- **THEN** CommandService SHALL return a timeout result
- **AND** Renderer SHALL remain responsive and able to display the timeout state

#### Scenario: Default command timeouts are explicit
- **WHEN** command timeout configuration is inspected
- **THEN** normal setpoint commands SHALL default to `3000ms`
- **AND** Start, Stop, Motor Start/Stop, Inlet Valve, and Outlet Valve commands that wait for feedback SHALL default to `5000ms`

#### Scenario: Commands are rejected while reconnecting
- **WHEN** the device state is `Reconnecting`, `Fault`, or `Disconnected`
- **THEN** CommandService SHALL reject new control commands before calling the protocol adapter

#### Scenario: One active command per device is allowed by default
- **WHEN** a command is already active for a device
- **THEN** a second command for the same device SHALL be rejected as busy
- **AND** the implementation SHALL NOT allow uncontrolled concurrent writes to the same device connection

#### Scenario: Polling does not race command verification
- **WHEN** CommandService is executing a write or read-back on a device
- **THEN** PollingScheduler SHALL skip or defer overlapping polling work for that device
- **AND** protocol operations for the same device SHALL remain bounded and attributable

#### Scenario: Pending command resources are cleaned up
- **WHEN** a command succeeds, fails, times out, or is cancelled by disconnect
- **THEN** related timers, listeners, and pending verification state SHALL be released

### Requirement: Renderer Control Experience
The Renderer SHALL provide control UI behavior through ViewModels without crossing protocol boundaries.

#### Scenario: Device disconnected state is visible
- **WHEN** the device enters `Reconnecting`, `Disconnected`, or `Fault`
- **THEN** Dashboard or Device UI SHALL clearly show that the device is not providing normal live data
- **AND** affected Tag quality SHALL be visible as non-Good

#### Scenario: Controls are protected outside connected state
- **WHEN** the device state is `Reconnecting`, `Disconnected`, or `Fault`
- **THEN** Renderer control entry points SHALL be disabled or guarded from submission
- **AND** the UI SHALL explain the user-facing device state without exposing low-level socket errors

#### Scenario: Command state is visible
- **WHEN** a command is pending, succeeded, rejected, timed out, or failed
- **THEN** Device UI SHALL display the command state from ViewModel state
- **AND** React View code SHALL NOT interpret low-level protocol errors

#### Scenario: UI validation does not replace Main validation
- **WHEN** Renderer validates Target Temperature or RPM Setpoint inputs before submit
- **THEN** Main Process CommandService SHALL still perform the authoritative validation

#### Scenario: Renderer stays inside MVVM boundaries
- **WHEN** Renderer source is inspected or architecture boundary tests run
- **THEN** Renderer SHALL NOT import Main Process modules, Node.js APIs, ModbusAdapter, CommandService, DeviceManager, PollingScheduler, TagService, or TagCache

### Requirement: Resilience Acceptance Scenario
The system SHALL support the end-to-end disconnect and recovery scenario for the simulated PLC.

#### Scenario: Simulator disconnect recovers automatically
- **WHEN** the PLC Simulator is running normally and HMI is connected with real-time polling active
- **AND** the Simulator disconnect fault is triggered
- **THEN** the device state SHALL enter `Reconnecting`
- **AND** related Tag values SHALL be marked `Bad`
- **AND** UI SHALL clearly show device communication loss
- **WHEN** the Simulator recovery action restores communication
- **THEN** HMI SHALL reconnect automatically through the bounded backoff loop
- **AND** polling SHALL resume
- **AND** successfully sampled Tags SHALL return to `Good`

#### Scenario: Invalid writes are intercepted
- **WHEN** the user attempts an illegal value, out-of-range Target Temperature, out-of-range RPM Setpoint, or read-only Tag write
- **THEN** CommandService SHALL reject the request before protocol write
- **AND** UI SHALL show a bounded rejection result without freezing

#### Scenario: Command timeout is isolated
- **WHEN** Simulator response delay or network fault causes a command timeout
- **THEN** CommandService SHALL return a timeout result
- **AND** Renderer SHALL remain responsive
- **AND** the device lifecycle SHALL remain recoverable through reconnect or user retry

### Requirement: Verification Coverage
The change SHALL include automated and manual verification for device control resilience.

#### Scenario: State machine tests exist
- **WHEN** unit tests run
- **THEN** tests SHALL verify legal transitions, illegal transition rejection, manual disconnect cleanup, and reconnect success transition

#### Scenario: Backoff tests exist
- **WHEN** reconnect tests run
- **THEN** tests SHALL verify bounded delay progression, maximum interval enforcement, single reconnect loop behavior, and reconnect cancellation

#### Scenario: CommandService tests exist
- **WHEN** command tests run
- **THEN** tests SHALL verify read-only rejection, Target Temperature range rejection, RPM Setpoint range rejection, read-back success, write failure, timeout, and busy command behavior

#### Scenario: End-to-end resilience is verified
- **WHEN** integration or manual acceptance verification is performed
- **THEN** it SHALL cover normal polling, Simulator disconnect, `Reconnecting`, Tag `Bad`, Simulator recovery, automatic reconnect, resumed polling, and Tag `Good`

### Requirement: Command Authorization
The system SHALL authorize device write commands in Main Process before reaching the protocol adapter.

#### Scenario: Command request uses current local user
- **WHEN** Renderer requests a device write command through typed Preload API
- **THEN** Main Process SHALL resolve the current local user session
- **AND** CommandService SHALL NOT trust a Renderer-supplied role or permission flag

#### Scenario: Operator can execute allowed start stop commands
- **WHEN** an Operator executes Start or Stop for a device and that command is marked as Operator allowed
- **THEN** CommandService SHALL authorize the command
- **AND** normal command validation, timeout, write, and verification rules SHALL still apply

#### Scenario: Operator cannot modify restricted setpoint
- **WHEN** an Operator attempts to write Target Temperature, RPM Setpoint, or another restricted parameter
- **THEN** CommandService SHALL reject the command before calling the protocol adapter
- **AND** the result SHALL identify the command as rejected for missing `parameter:write` permission

#### Scenario: Operator cannot execute advanced valve control
- **WHEN** an Operator attempts Inlet Valve or Outlet Valve control that requires `device:advanced-control`
- **THEN** CommandService SHALL reject the command before calling the protocol adapter
- **AND** no protocol write SHALL be sent

#### Scenario: Engineer can execute permitted parameter command
- **WHEN** an Engineer writes a valid Target Temperature or RPM Setpoint command
- **THEN** CommandService SHALL authorize the command
- **AND** existing writability, type, range, device state, concurrency, and read-back validation SHALL still apply

### Requirement: Command Audit Integration
The system SHALL audit key CommandService write operations and authorization failures.

#### Scenario: Authorized command writes audit
- **WHEN** Start, Stop, Setpoint 修改, RPM Setpoint 修改, Inlet Valve 控制, or Outlet Valve 控制 completes
- **THEN** CommandService SHALL write an Audit Log record
- **AND** the record SHALL include current user, action, target, old value, requested new value, and structured command result

#### Scenario: Unauthorized command writes rejected audit
- **WHEN** CommandService rejects a key command because the current user lacks permission
- **THEN** CommandService SHALL write a `Rejected` Audit Log record
- **AND** the audit target SHALL identify the attempted command and target device or Tag

#### Scenario: Command audit uses Main Process old value
- **WHEN** CommandService audits a setpoint or valve operation
- **THEN** `oldValue` SHALL come from TagCache snapshot, configured feedback/read-back, or another Main Process trusted source
- **AND** Renderer SHALL NOT provide the authoritative `oldValue`

#### Scenario: Audit preflight protects command write
- **WHEN** a key command requires audit and AuditService cannot create a pending record
- **THEN** CommandService SHALL reject the HMI command before protocol write
- **AND** the result SHALL identify audit persistence as unavailable

### Requirement: Command Result Includes Authorization and Audit Status
The system SHALL return structured command results that include authorization and audit outcomes when relevant.

#### Scenario: Permission rejection is distinguishable
- **WHEN** CommandService rejects a command due to missing permission
- **THEN** Renderer SHALL receive a structured result distinguishable from validation failure, timeout, or communication failure
- **AND** the result SHALL NOT expose low-level security or protocol implementation details

#### Scenario: Audit failure is distinguishable
- **WHEN** command execution succeeds or fails but audit finalization fails
- **THEN** CommandService SHALL include audit finalization status in the structured result
- **AND** Application/Error logs SHALL contain enough context to diagnose the audit failure

#### Scenario: Renderer command UI uses result state
- **WHEN** Renderer receives command results with `Succeeded`, `Rejected`, `Failed`, `TimedOut`, verification failure, or audit failure states
- **THEN** ViewModel SHALL expose those states for the View
- **AND** React View SHALL NOT infer command status from raw protocol errors
