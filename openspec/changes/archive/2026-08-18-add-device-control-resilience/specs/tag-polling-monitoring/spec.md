## ADDED Requirements

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

## MODIFIED Requirements

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
