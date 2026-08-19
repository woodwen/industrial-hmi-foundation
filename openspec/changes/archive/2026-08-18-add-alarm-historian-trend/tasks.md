## 1. Architecture and Setup

- [x] 1.1 Review current TagCache, DeviceManager, runtime, IPC, Alarm page, Trend page, and ViewModel boundaries before implementation.
- [x] 1.2 Add `better-sqlite3` as the default SQLite production dependency and verify Electron native module compatibility.
- [x] 1.3 Define shared Alarm, Historian, Trend, query, and IPC DTO types without exposing SQLite or protocol implementation details to Renderer.
- [x] 1.4 Add typed IPC channel names for alarm snapshot/update/acknowledge/history and trend snapshot/update/history query.
- [x] 1.5 Wire Main Process service initialization order so SQLite repositories start before AlarmEngine, HistorianService, and TrendService subscribe to data.
- [x] 1.6 Configure Electron packaging/rebuild handling for `better-sqlite3`, including `asarUnpack` if packaged runtime verification requires it.
- [x] 1.7 Add deterministic dispose/shutdown hooks for AlarmEngine, HistorianService, TrendService, repositories, timers, and subscriptions.

## 2. SQLite Historian and Alarm Repositories

- [x] 2.1 Implement idempotent SQLite schema initialization for `schema_meta`, `tag_history`, and `alarm_history`.
- [x] 2.2 Add indexes for tag id/time range queries and alarm history time/status/level filters.
- [x] 2.3 Implement TagHistoryRepository batch insert, raw time-range query, count query, and aggregate bucket query.
- [x] 2.4 Implement AlarmHistoryRepository create occurrence, update acknowledge, update recovery, and filtered history query.
- [x] 2.5 Support configurable database path overrides for tests while using Electron `userData` for normal runtime.
- [x] 2.6 Ensure repository errors are logged and converted to the unified application error model at IPC boundaries.

## 3. Alarm Engine

- [x] 3.1 Implement alarm domain types for definition, condition, level, occurrence, runtime state, and acknowledge command.
- [x] 3.2 Add default alarm definitions with confirmed thresholds and delays: `TEMP_HIGH` > `80.0°C` for `3000ms`, `LEVEL_LOW` < `15.0%` for `3000ms`, `PRESSURE_HIGH` > `0.30MPa` for `2000ms`, `MOTOR_ABNORMAL` true for `5000ms`, and `PLC_DISCONNECTED` true for `1000ms`.
- [x] 3.3 Implement alarm signal resolution from TagCache values and named Main Process synthetic signals for motor abnormal and PLC disconnect.
- [x] 3.4 Implement condition evaluation for `High`, `HighHigh`, `Low`, `LowLow`, and `BooleanState`.
- [x] 3.5 Implement activation delay so transient abnormal values do not create alarm occurrences.
- [x] 3.6 Implement recovery deadband/debounce with defaults: temperature `0.5°C`, level `1.0%`, pressure `0.02MPa`, RPM `20 rpm`, and recovery delay equal to activation delay unless configured.
- [x] 3.7 Implement lifecycle transitions for `Inactive`, `Active`, `Acknowledged`, and `Recovered`.
- [x] 3.8 Implement acknowledge handling with `acknowledgeTime` and fixed first-phase `acknowledgeUser` value `operator`, without reading the OS username.
- [x] 3.9 Persist alarm trigger, acknowledge, and recovery updates through AlarmHistoryRepository.
- [x] 3.10 Publish alarm updates to Main Process subscribers without one event per internal evaluation tick.

## 4. Historian and Trend Services

- [x] 4.1 Implement HistorianService subscription to TagCache batches without adding extra PLC reads.
- [x] 4.2 Configure Temperature, Level, Pressure, and RPM as default tracked history/trend tags.
- [x] 4.3 Implement Tag History recording rules using first-sample, `5000ms` fixed interval, quality change, and default deadbands: temperature `0.2°C`, level `0.5%`, pressure `0.01MPa`, RPM `10 rpm`.
- [x] 4.4 Batch historian writes into SQLite transactions and flush pending writes on shutdown.
- [x] 4.5 Implement a generic bounded RingBuffer for trend points.
- [x] 4.6 Implement TrendService downsampling from TagCache updates into per-tag real-time Ring Buffers with `1000ms` default sample interval and `1800` maximum points per tag.
- [x] 4.7 Implement TrendQueryService presets for last 1 hour, last 8 hours, today, and custom start/end time.
- [x] 4.8 Implement historical trend result caps with `1000` default points per tag and SQL aggregation before returning large-range query results to Renderer.
- [x] 4.9 Preserve point quality in real-time and historical trend DTOs, including degraded quality summaries for aggregated buckets.
- [x] 4.10 Leave historical data retention cleanup out of scope; do not add automatic age-based delete/archive behavior in this change.

## 5. IPC and Preload APIs

- [x] 5.1 Register Main Process alarm IPC handlers for current alarm snapshot, alarm subscription, acknowledge, and history query.
- [x] 5.2 Register Main Process trend IPC handlers for real-time trend snapshot, real-time trend subscription, and historical trend query.
- [x] 5.3 Expose minimal typed alarm and trend APIs from Preload under `window.hmi`.
- [x] 5.4 Update Renderer API client abstractions to consume the new typed Preload APIs.
- [x] 5.5 Ensure every subscription returns an unsubscribe function and removes IPC/EventEmitter listeners on cleanup.
- [x] 5.6 Validate IPC inputs for time ranges, tag ids, occurrence ids, and acknowledge user strings before calling Main services.

## 6. Renderer MVVM and UI

- [x] 6.1 Implement AlarmViewModel for real-time alarm rows, history query filters, loading/error state, and acknowledge action.
- [x] 6.2 Implement Alarm page Real-time Alarm and History Alarm views with level, status, time, tag, message, and acknowledge user fields.
- [x] 6.3 Implement TrendViewModel for real-time series, historical series, range presets, custom time range, loading/error/empty state, and bounded point arrays.
- [x] 6.4 Implement Trend page controls for Temperature, Level, Pressure, RPM, real-time mode, historical mode, and supported time ranges.
- [x] 6.5 Add a local SVG/canvas trend visualization that can display multiple numeric series and degraded quality states without storing unbounded data or adding a charting dependency.
- [x] 6.6 Keep React Views dependent on ViewModels only; do not import SQLite, Node.js, Modbus, protocol adapters, or raw IPC in Renderer views.

## 7. Tests and Acceptance Coverage

- [x] 7.1 Add unit tests for all alarm condition types and threshold comparison semantics.
- [x] 7.2 Add unit tests for alarm activation delay, recovery debounce, analog deadband, duplicate suppression, acknowledge, and recovered transitions.
- [x] 7.3 Add unit tests for default alarm definitions, including exact threshold/delay/level/message values plus motor abnormal and PLC disconnect BooleanState definitions.
- [x] 7.4 Add SQLite integration tests for Alarm History trigger, acknowledge, recover, filter query, and restart-readable persistence.
- [x] 7.5 Add unit tests for Historian write strategy: first sample, fixed interval, deadband change, quality change, and suppression of repeated polling updates.
- [x] 7.6 Add SQLite integration tests for Tag History persistence and historical trend query after service/repository restart.
- [x] 7.7 Add unit tests for RingBuffer maximum point eviction and TrendService downsampling.
- [x] 7.8 Add tests for historical trend aggregation caps, bucket values, and quality summary behavior.
- [x] 7.9 Add Renderer ViewModel tests for alarm acknowledge flow, history filters, trend range selection, and bounded point arrays.
- [x] 7.10 Add a smoke or integration verification path showing high temperature alarm activation, acknowledge, recovery, alarm history query, SQLite trend persistence, real-time trend display, and restart-readable historical trend query.

## 8. Documentation and Validation

- [x] 8.1 Update relevant architecture, alarm, historian, trend, and development documentation so lifecycle, `better-sqlite3` packaging, SQLite schema, fixed `operator` acknowledge user, write strategy, Ring Buffer limits, query aggregation, and no-retention-cleanup scope match the implementation.
- [x] 8.2 Run `npm run typecheck`.
- [x] 8.3 Run `npm run lint`.
- [x] 8.4 Run `npm run test`.
- [x] 8.5 Run `npm run build`.
- [x] 8.6 Run `openspec validate add-alarm-historian-trend --strict`.
- [x] 8.7 Run `openspec validate --all --strict`.
- [x] 8.8 Run `git diff --check`.
