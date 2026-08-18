## ADDED Requirements

### Requirement: Alarm Domain Model
The system SHALL define an industrial alarm domain model for simulated mixer abnormal conditions.

#### Scenario: Alarm definitions contain required fields
- **WHEN** alarm definitions are loaded
- **THEN** each AlarmDefinition SHALL include `id`, `code`, `tagId`, `condition`, `threshold`, `delay`, `level`, `message`, and `enabled`
- **AND** the system SHALL use the same definition shape for analog threshold alarms and Boolean State alarms

#### Scenario: Alarm conditions are explicit
- **WHEN** an alarm condition is configured
- **THEN** it SHALL use one of `High`, `HighHigh`, `Low`, `LowLow`, or `BooleanState`
- **AND** the first-phase alarm system SHALL NOT require a general expression engine

#### Scenario: Alarm levels are explicit
- **WHEN** an alarm level is configured or displayed
- **THEN** it SHALL use one of `Info`, `Warning`, `High`, or `Critical`

#### Scenario: Alarm statuses are explicit
- **WHEN** an alarm occurrence lifecycle is represented
- **THEN** it SHALL use explicit statuses `Inactive`, `Active`, `Acknowledged`, and `Recovered`
- **AND** `Acknowledged` SHALL NOT be treated as equivalent to `Recovered`

### Requirement: Default Mixer Alarm Definitions
The system SHALL provide default test alarms for the simulated constant-temperature mixing equipment.

#### Scenario: Temperature high alarm exists
- **WHEN** the default alarm definitions are inspected
- **THEN** an enabled alarm with code `TEMP_HIGH` SHALL exist for the current temperature tag
- **AND** it SHALL use condition `High`, threshold `80.0°C`, delay `3000ms`, level `High`, and message `Temperature is too high`

#### Scenario: Level low alarm exists
- **WHEN** the default alarm definitions are inspected
- **THEN** an enabled alarm with code `LEVEL_LOW` SHALL exist for the current level tag
- **AND** it SHALL use condition `Low`, threshold `15.0%`, delay `3000ms`, level `Warning`, and message `Level is too low`

#### Scenario: Pressure high alarm exists
- **WHEN** the default alarm definitions are inspected
- **THEN** an enabled alarm with code `PRESSURE_HIGH` SHALL exist for the current pressure tag
- **AND** it SHALL use condition `High`, threshold `0.30MPa`, delay `2000ms`, level `High`, and message `Pressure is too high`

#### Scenario: Motor abnormal alarm exists
- **WHEN** the default alarm definitions are inspected
- **THEN** an enabled alarm with code `MOTOR_ABNORMAL` SHALL exist
- **AND** it SHALL use condition `BooleanState`, threshold `true`, delay `5000ms`, level `Critical`, message `Motor feedback is abnormal`, and a named motor abnormal alarm signal

#### Scenario: PLC disconnect alarm exists
- **WHEN** the default alarm definitions are inspected
- **THEN** an enabled alarm with code `PLC_DISCONNECTED` SHALL exist
- **AND** it SHALL use condition `BooleanState`, threshold `true`, delay `1000ms`, level `Critical`, message `PLC communication is lost`, and a named device communication alarm signal

### Requirement: Alarm Engine Evaluation
The Main Process SHALL evaluate alarms from TagCache batches and device state events.

#### Scenario: Renderer does not evaluate alarms
- **WHEN** Tag values or device states change
- **THEN** AlarmEngine SHALL evaluate matching enabled alarm definitions in the Main Process
- **AND** Renderer SHALL NOT compute alarm conditions from raw Modbus, TCP, SQLite, or Node.js data

#### Scenario: Analog alarm requires good quality
- **WHEN** a threshold alarm receives a TagValue whose quality is not `Good`
- **THEN** AlarmEngine SHALL NOT trigger that analog threshold alarm solely from the stale or uncertain value
- **AND** device communication loss SHALL be handled by the configured PLC disconnect alarm

#### Scenario: High and HighHigh trigger above threshold
- **WHEN** a numeric TagValue remains greater than a `High` or `HighHigh` threshold for the configured delay
- **THEN** AlarmEngine SHALL create or update one active alarm occurrence for that definition
- **AND** the occurrence SHALL include the triggering value and trigger time

#### Scenario: Low and LowLow trigger below threshold
- **WHEN** a numeric TagValue remains less than a `Low` or `LowLow` threshold for the configured delay
- **THEN** AlarmEngine SHALL create or update one active alarm occurrence for that definition
- **AND** the occurrence SHALL include the triggering value and trigger time

#### Scenario: BooleanState triggers on expected state
- **WHEN** a boolean alarm signal remains equal to its configured threshold for the configured delay
- **THEN** AlarmEngine SHALL create or update one active alarm occurrence for that definition

### Requirement: Alarm Delay Debounce and Duplicate Suppression
The system SHALL suppress transient and repeated alarm noise using delay, recovery debounce, and one open occurrence per definition.

#### Scenario: Transient abnormal value does not create occurrence
- **WHEN** an alarm condition becomes true and then clears before its configured delay elapses
- **THEN** AlarmEngine SHALL discard the pending activation
- **AND** no alarm history row SHALL be created for that transient condition

#### Scenario: Sustained abnormal value creates one occurrence
- **WHEN** an alarm condition remains true beyond its configured delay
- **THEN** AlarmEngine SHALL create exactly one open occurrence for that alarm definition
- **AND** continued true evaluations SHALL NOT create duplicate active occurrences

#### Scenario: Analog recovery uses deadband
- **WHEN** an analog threshold alarm is active
- **THEN** the condition SHALL be considered recovered only after the value crosses the configured recovery deadband in the normal direction
- **AND** values oscillating around the threshold SHALL NOT repeatedly close and reopen alarm occurrences

#### Scenario: Default analog recovery deadbands exist
- **WHEN** default analog alarm recovery behavior is inspected
- **THEN** current temperature alarms SHALL default to `0.5°C` recovery deadband
- **AND** current level alarms SHALL default to `1.0%` recovery deadband
- **AND** current pressure alarms SHALL default to `0.02MPa` recovery deadband
- **AND** RPM alarms SHALL default to `20 rpm` recovery deadband

#### Scenario: Recovery requires stable clear state
- **WHEN** an active or acknowledged alarm condition becomes false
- **THEN** AlarmEngine SHALL wait for the configured recovery delay or debounce interval before recording recovery
- **AND** the recovery SHALL be cancelled if the condition becomes true again before the interval elapses

#### Scenario: Recovery delay defaults to activation delay
- **WHEN** an alarm definition does not configure a separate recovery delay
- **THEN** AlarmEngine SHALL use the definition's activation delay as the recovery delay

### Requirement: Alarm Lifecycle and Acknowledge
The system SHALL support acknowledging alarm occurrences while preserving the distinction between operator acknowledgement and physical recovery.

#### Scenario: Active alarm can be acknowledged
- **WHEN** an operator acknowledges an `Active` alarm occurrence
- **THEN** the occurrence SHALL record `acknowledgeTime` and `acknowledgeUser`
- **AND** if the triggering condition is still true, the occurrence status SHALL become `Acknowledged`

#### Scenario: Default acknowledge user is operator
- **WHEN** an alarm acknowledge request does not provide a future permission-system user identity
- **THEN** the occurrence SHALL use `operator` as the first-phase acknowledge user
- **AND** the system SHALL NOT infer the acknowledge user from the operating system username

#### Scenario: Acknowledged alarm recovers after condition clears
- **WHEN** an `Acknowledged` alarm condition has remained recovered for the configured recovery delay
- **THEN** the occurrence status SHALL become `Recovered`
- **AND** the occurrence SHALL record `recoverTime`

#### Scenario: Recovered before acknowledgement remains visible
- **WHEN** an `Active` alarm condition recovers before operator acknowledgement
- **THEN** the occurrence SHALL record recovery information
- **AND** its visible status SHALL remain `Active` until an operator acknowledges it

#### Scenario: Acknowledge after recovery closes occurrence
- **WHEN** an `Active` alarm has already recorded recovery information and is later acknowledged
- **THEN** the occurrence status SHALL become `Recovered`
- **AND** it SHALL record `acknowledgeTime` and `acknowledgeUser`

#### Scenario: Recovered alarm closes occurrence
- **WHEN** an alarm occurrence is both acknowledged and recovered
- **THEN** its status SHALL be `Recovered`
- **AND** the alarm definition SHALL be eligible to create a new occurrence only after it has re-armed from a stable normal condition

#### Scenario: Inactive definition has no open occurrence
- **WHEN** an alarm definition has no active, acknowledged, or unacknowledged recovered occurrence
- **THEN** its runtime status SHALL be `Inactive`

### Requirement: Alarm History Persistence
The system SHALL persist alarm occurrences to SQLite-backed Alarm History.

#### Scenario: Trigger is persisted
- **WHEN** AlarmEngine creates an alarm occurrence
- **THEN** Alarm History SHALL persist `triggerTime`, `triggerValue`, alarm `code`, `level`, `message`, `tagId`, and current `status`

#### Scenario: Acknowledge is persisted
- **WHEN** an alarm occurrence is acknowledged
- **THEN** Alarm History SHALL persist `acknowledgeTime` and `acknowledgeUser`
- **AND** a later History Alarm query SHALL return those values

#### Scenario: Recovery is persisted
- **WHEN** an alarm occurrence recovers
- **THEN** Alarm History SHALL persist `recoverTime`
- **AND** a later History Alarm query SHALL return that value

#### Scenario: Alarm history survives restart
- **WHEN** the application restarts after alarm history has been written
- **THEN** History Alarm queries SHALL still return the persisted alarm occurrence records from SQLite

### Requirement: Alarm IPC and Renderer Pages
The system SHALL expose alarm operations to Renderer through typed Preload APIs and MVVM page state.

#### Scenario: Renderer retrieves real-time alarms
- **WHEN** the Alarm page initializes the Real-time Alarm view
- **THEN** it SHALL retrieve current alarm occurrences through a typed Preload API
- **AND** returned rows SHALL include level, status, time, tag, message, and acknowledge user when available

#### Scenario: Renderer subscribes to alarm updates
- **WHEN** alarm occurrences activate, are acknowledged, recover, or close
- **THEN** Renderer SHALL receive updates through a typed subscription API that returns an unsubscribe function
- **AND** Main Process SHALL clean up listeners when Renderer unsubscribes or its window is destroyed

#### Scenario: Renderer acknowledges through typed API
- **WHEN** the user acknowledges an alarm in Renderer
- **THEN** the request SHALL flow View -> ViewModel -> typed Preload API -> Main IPC -> AlarmEngine
- **AND** Renderer SHALL NOT mutate AlarmEngine state directly

#### Scenario: Renderer queries history alarms
- **WHEN** the History Alarm view queries persisted alarms
- **THEN** the query SHALL support filters for level, status, time range, tag, and acknowledge user
- **AND** the result SHALL include level, status, trigger time, acknowledge time, recover time, tag, trigger value, and acknowledge user
