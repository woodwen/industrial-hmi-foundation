## ADDED Requirements

### Requirement: Large-Scale Tag Simulator
The system SHALL provide a configurable simulator mode for large-scale Tag performance testing.

#### Scenario: Required Tag counts are supported
- **WHEN** the performance simulator is started for a large-scale test
- **THEN** it SHALL support configurations for at least 100, 500, and 1000 Tags
- **AND** the selected Tag count SHALL be recorded in the performance report

#### Scenario: Simulator remains external to HMI business code
- **WHEN** large-scale Tag simulation is enabled
- **THEN** it SHALL run as simulator or test infrastructure
- **AND** production HMI services SHALL NOT contain special branches that depend on fake performance-only business behavior

#### Scenario: Tag definitions are generated deterministically
- **WHEN** the simulator generates a large Tag set
- **THEN** Tag ids, names, data types, scan rates, and protocol bindings SHALL be deterministic for the selected seed or configuration
- **AND** repeated runs SHALL be comparable without manually editing source code

### Requirement: Performance Metrics Collection
The system SHALL collect real performance metrics for Tag acquisition, Main Process, IPC, Renderer, Historian, Trend, and logging.

#### Scenario: Required metrics are collected
- **WHEN** a performance profile runs
- **THEN** the report SHALL include request count or notification count, polling or subscription processing duration, CPU usage, memory usage, IPC message rate, Renderer update rate, TagCache batch size, Historian write rate, Trend point count, and log growth

#### Scenario: Metrics are protocol-aware
- **WHEN** a performance profile runs against Modbus TCP or OPC UA
- **THEN** the report SHALL identify the protocol kind and acquisition mode
- **AND** Modbus request count and OPC UA subscription notification count SHALL NOT be mislabeled as the same metric

#### Scenario: Report includes environment and window
- **WHEN** a performance report is written
- **THEN** it SHALL include run timestamp, command, duration, host platform summary, application version or git identifier when available, protocol kind, Tag count, scan or sampling configuration, and known limitations

#### Scenario: Reports use default output directory
- **WHEN** a performance profile writes report artifacts
- **THEN** it SHALL write them under `reports/performance/` by default
- **AND** the implementation SHALL document whether raw reports are gitignored or whether curated sample reports are intentionally tracked

#### Scenario: Performance data is not fabricated
- **WHEN** README, docs, or reports describe performance
- **THEN** they SHALL use values produced by the profiling script or state that no measured value is available
- **AND** they SHALL NOT hard-code invented benchmark results to make the project appear faster

### Requirement: Long-Running Resource Audit
The system SHALL provide a long-running check plan for communication, subscription, trend, database, logging, and cleanup resources.

#### Scenario: Timer cleanup is checked
- **WHEN** a device disconnects, reconnects, faults, or runtime disposes during a long-run profile
- **THEN** the profile SHALL check that polling, reconnect, command timeout, trend, historian, and acquisition timers do not keep growing without bound

#### Scenario: Smoke and extended profiles have default windows
- **WHEN** long-running profiles are documented or implemented
- **THEN** the smoke profile SHALL default to a 5-10 minute local verification window
- **AND** the extended profile SHALL default to a 30-120 minute manual verification window
- **AND** the extended profile SHALL NOT be required in ordinary CI unless a later change explicitly enables it

#### Scenario: Listener cleanup is checked
- **WHEN** Renderer subscriptions, Main Process listeners, alarm listeners, tag listeners, trend listeners, and device state listeners are created and removed
- **THEN** the long-run profile SHALL check listener counts or equivalent observable cleanup evidence
- **AND** limitations of listener measurement SHALL be reported

#### Scenario: OPC UA resources are checked
- **WHEN** an OPC UA device disconnects or reconnects repeatedly
- **THEN** active sessions, subscriptions, monitored items, and related listeners SHALL be released before or during the next successful connection lifecycle

#### Scenario: Trend memory is bounded
- **WHEN** Trend page or TrendService remains active during a long-running session
- **THEN** real-time trend buffers SHALL remain within their configured maximum points per Tag
- **AND** Renderer ViewModel SHALL NOT accumulate unbounded trend points

#### Scenario: SQLite and log growth are observable
- **WHEN** Historian, Alarm History, Audit Log, and file logging run for an extended profile
- **THEN** the report SHALL include SQLite write counts or size deltas and log file size deltas
- **AND** repeated high-frequency polling SHALL NOT produce uncontrolled INFO log growth

### Requirement: Required Test Matrix
The system SHALL maintain unit and integration coverage for core industrial behavior affected by this change.

#### Scenario: Required unit tests exist
- **WHEN** unit tests run
- **THEN** they SHALL cover Tag decode, Alarm condition evaluation, Device state transitions, Recipe validation, and Permission checks

#### Scenario: Required integration tests exist
- **WHEN** integration tests run
- **THEN** they SHALL cover Simulator plus ModbusAdapter, disconnect and reconnect, CommandService command execution, and Historian persistence or query behavior

#### Scenario: OPC UA integration is covered
- **WHEN** OPC UA support is implemented
- **THEN** integration tests SHALL cover OPC UA Simulator plus OpcUaAdapter connect, subscription update, write, disconnect, and cleanup behavior

#### Scenario: Architecture boundary tests remain active
- **WHEN** architecture boundary tests run
- **THEN** Renderer source SHALL be checked for prohibited imports from Node.js, SQLite, Modbus libraries, OPC UA libraries, Main Process protocol adapters, DeviceManager, CommandService, PollingScheduler, TagService, or TagCache

### Requirement: Interview Demo Scenarios
The system SHALL provide documented demo scenarios for interview and project walkthrough use.

#### Scenario: Demo 1 covers startup and monitoring
- **WHEN** a reader follows Demo 1
- **THEN** they SHALL be able to start a simulator, connect HMI, start the simulated device, and observe real-time monitoring values

#### Scenario: Demo 2 covers communication loss
- **WHEN** a reader follows Demo 2
- **THEN** they SHALL be able to trigger PLC or simulator disconnect, observe Tag Quality becoming `Bad`, observe DeviceManager automatic reconnect, and observe values returning to `Good` after recovery

#### Scenario: Demo 3 covers alarm lifecycle
- **WHEN** a reader follows Demo 3
- **THEN** they SHALL be able to trigger high temperature, see an Alarm become Active, acknowledge it, and observe Recovery after the condition clears

#### Scenario: Demo 4 covers historical trend
- **WHEN** a reader follows Demo 4
- **THEN** they SHALL be able to collect history and view historical trend data through the HMI

#### Scenario: Demo 5 covers recipe download
- **WHEN** a reader follows Demo 5
- **THEN** they SHALL be able to validate and download a Recipe through the controlled CommandService flow
- **AND** partial failure or verification failure SHALL NOT be described as overall success

#### Scenario: Demo 6 covers protocol switching
- **WHEN** a reader follows Demo 6
- **THEN** they SHALL be able to run the simulated device through Modbus TCP and OPC UA configurations
- **AND** Dashboard behavior SHALL remain driven by Tag/ViewModel state rather than protocol-specific UI logic
- **AND** Modbus TCP SHALL be shown as the default protocol and OPC UA as an optional switch

### Requirement: Simulation Safety Boundary
The system SHALL describe all hardening and demo behavior as simulator-backed engineering practice rather than a real production Safety System.

#### Scenario: Safety boundary appears in docs
- **WHEN** README, Demo steps, Help text, or Known Limitations describe the system
- **THEN** they SHALL state that this is an industrial automation learning and simulation project
- **AND** they SHALL NOT claim real production deployment, Safety PLC replacement, certified safety interlock, or emergency-stop capability

#### Scenario: Test success does not imply production certification
- **WHEN** performance, long-run, or integration tests pass
- **THEN** documentation SHALL treat the result as simulator validation only
- **AND** it SHALL NOT imply suitability for real plant operation without additional engineering, hardware, security, and certification work
