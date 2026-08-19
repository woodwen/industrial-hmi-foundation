## ADDED Requirements

### Requirement: Protocol-Neutral Command Execution
CommandService SHALL execute device commands through protocol-neutral definitions for both Modbus TCP and OPC UA devices.

#### Scenario: Command target resolves through Tag or point binding
- **WHEN** CommandService executes Start, Stop, Running, Setpoint, valve, motor, or Recipe-generated command steps
- **THEN** it SHALL resolve the target through configured command or Tag bindings
- **AND** it SHALL NOT embed Modbus register addresses or OPC UA NodeIds in Renderer-facing command requests

#### Scenario: Modbus command behavior remains compatible
- **WHEN** a Modbus TCP device executes existing supported commands
- **THEN** CommandService SHALL preserve writable validation, range validation, operation gate behavior, timeout, read-back or feedback verification, permission checks, and audit behavior

#### Scenario: OPC UA command behavior uses same boundary
- **WHEN** an OPC UA device executes a writable command such as Setpoint or Running
- **THEN** CommandService SHALL perform the same device state, permission, audit, value, timeout, write acceptance, and verification checks before returning a result

#### Scenario: Concrete protocol errors are normalized
- **WHEN** Modbus or OPC UA command execution fails
- **THEN** CommandService SHALL return a unified command result or application error shape
- **AND** Renderer SHALL NOT receive raw Modbus exception objects, socket errors, OPC UA status objects, session ids, or subscription ids

### Requirement: Protocol-Neutral Command Verification
Command verification SHALL distinguish write acceptance from verified device state for both polling and subscription protocols.

#### Scenario: Modbus read-back remains supported
- **WHEN** a Modbus setpoint command is accepted by the protocol adapter
- **THEN** CommandService SHALL verify the result through the existing read-back or feedback strategy
- **AND** write acceptance alone SHALL NOT be reported as verified success

#### Scenario: OPC UA read-back is supported
- **WHEN** an OPC UA Setpoint write is accepted
- **THEN** CommandService SHALL verify the target value through an OPC UA read-back or protocol-neutral Tag feedback wait
- **AND** the verification SHALL use engineering values after TagService normalization

#### Scenario: Subscription feedback can verify state
- **WHEN** an OPC UA command waits for a feedback value that is delivered through subscription
- **THEN** CommandService SHALL wait through a protocol-neutral feedback abstraction or TagCache observation
- **AND** it SHALL NOT directly manage OPC UA monitored item objects

#### Scenario: Verification timeout cleans up waiters
- **WHEN** Modbus read-back or OPC UA feedback verification times out
- **THEN** CommandService SHALL return a timeout result
- **AND** pending timers, listeners, and feedback waiters SHALL be released

### Requirement: Protocol Switch Does Not Bypass Protection
Protocol switching SHALL NOT weaken Main Process command protection.

#### Scenario: Permission is enforced for both protocols
- **WHEN** a user without the required permission attempts a command against a Modbus or OPC UA device
- **THEN** Main Process SHALL reject the command before calling any concrete protocol adapter

#### Scenario: Audit applies to both protocols
- **WHEN** a protected command against a Modbus or OPC UA device succeeds, fails, times out, or is rejected
- **THEN** AuditService SHALL record the action result according to the existing audit rules
- **AND** the audit record SHALL identify protocol kind only as metadata, not as the source of authority

#### Scenario: Reconnecting rejects commands for both protocols
- **WHEN** a Modbus or OPC UA device is `Disconnected`, `Reconnecting`, or `Fault`
- **THEN** CommandService SHALL reject new commands before protocol write
- **AND** Renderer SHALL remain responsive with a structured command state
