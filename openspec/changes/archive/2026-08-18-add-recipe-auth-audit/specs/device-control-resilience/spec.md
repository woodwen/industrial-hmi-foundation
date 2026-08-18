## ADDED Requirements

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
