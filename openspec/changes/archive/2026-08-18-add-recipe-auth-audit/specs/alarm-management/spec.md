## ADDED Requirements

### Requirement: Alarm Acknowledge Authorization
The system SHALL authorize alarm acknowledge requests in Main Process using the current local user.

#### Scenario: Authorized user acknowledges alarm
- **WHEN** a current local user with `alarm:acknowledge` permission acknowledges an `Active` or recovered-but-unacknowledged alarm occurrence
- **THEN** AlarmEngine SHALL apply the existing acknowledge lifecycle rules
- **AND** `acknowledgeUser` SHALL be set to the current local user's stable identity or display name

#### Scenario: Unauthorized user cannot acknowledge alarm
- **WHEN** a user without `alarm:acknowledge` permission attempts to acknowledge an alarm occurrence
- **THEN** Main Process SHALL reject the request before mutating AlarmEngine state
- **AND** the occurrence status, `acknowledgeTime`, and `acknowledgeUser` SHALL remain unchanged

#### Scenario: Renderer cannot spoof acknowledge user
- **WHEN** Renderer sends an alarm acknowledge request
- **THEN** Main Process SHALL resolve the acknowledge user from the local session
- **AND** SHALL NOT trust a Renderer-supplied username, role, or permission as authoritative

#### Scenario: Existing acknowledge lifecycle remains intact
- **WHEN** an authorized acknowledge request succeeds
- **THEN** `Acknowledged` and `Recovered` SHALL remain distinct lifecycle states
- **AND** acknowledge SHALL NOT be treated as physical recovery

### Requirement: Alarm Acknowledge Audit
The system SHALL write Audit Log records for alarm acknowledge attempts and results.

#### Scenario: Successful alarm acknowledge is audited
- **WHEN** an authorized user successfully acknowledges an alarm occurrence
- **THEN** AlarmEngine or its application service SHALL write an Audit Log record
- **AND** the record SHALL include user, action `Alarm Acknowledge`, target occurrence, old status, new status, and result `Succeeded`

#### Scenario: Unauthorized alarm acknowledge is audited
- **WHEN** an alarm acknowledge request is rejected due to missing permission
- **THEN** Main Process SHALL write a `Rejected` Audit Log record
- **AND** the alarm occurrence SHALL NOT be modified

#### Scenario: Acknowledge audit survives restart
- **WHEN** an alarm acknowledge audit record has been written and the application restarts
- **THEN** Audit Log query SHALL return the persisted acknowledge audit record
- **AND** Alarm History SHALL still return its own persisted acknowledge fields

#### Scenario: Alarm acknowledge result distinguishes audit failure
- **WHEN** alarm acknowledge lifecycle update succeeds but audit finalization fails
- **THEN** the acknowledge API result SHALL expose an audit failure summary
- **AND** the system SHALL write an Application/Error log entry with alarm occurrence context
