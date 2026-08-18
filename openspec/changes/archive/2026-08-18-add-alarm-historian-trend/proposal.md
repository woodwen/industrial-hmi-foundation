## Why

The HMI currently shows live PLC Simulator tags and supports control/reconnect behavior, but it does not yet turn abnormal equipment states into an auditable industrial alarm lifecycle or persist process data for trend analysis. This change adds the next operational layer: alarms, alarm history, tag history, and bounded real-time/historical trend views for the simulated constant-temperature mixing equipment.

## What Changes

- Add an Alarm Engine in the Main Process that evaluates configured alarm definitions from TagCache and device state events.
- Support first-phase alarm conditions: `High`, `HighHigh`, `Low`, `LowLow`, and `BooleanState`.
- Define alarm levels `Info`, `Warning`, `High`, and `Critical`.
- Model alarm lifecycle explicitly as `Inactive`, `Active`, `Acknowledged`, and `Recovered`, with `Acknowledged` and `Recovered` represented as different concepts.
- Add default test alarms for high temperature, low level, high pressure, motor abnormal state, and PLC disconnect.
- Add delay/debounce behavior so transient tag noise does not create repeated alarm records.
- Add typed alarm IPC APIs and Renderer ViewModels/pages for Real-time Alarm and History Alarm views, including level, status, time, tag, and acknowledge user fields.
- Add `better-sqlite3` backed Historian storage for tag history and alarm history, with Main Process repository encapsulation.
- Add a bounded tag history write strategy using fixed interval, change-based recording, and deadband rules instead of storing every polling update.
- Add real-time trend support for Temperature, Level, Pressure, and RPM using in-memory Ring Buffers with maximum point limits.
- Add historical trend queries for last 1 hour, last 8 hours, today, and custom time ranges from SQLite.
- Add trend query sampling/aggregation strategy to keep large-range reads bounded.
- Render first-phase trend charts with local SVG/canvas code rather than adding a charting dependency.
- Do not implement Recipe, permission system, or OPC UA in this change.

## Capabilities

### New Capabilities

- `alarm-management`: Alarm definitions, condition evaluation, delay/debounce, lifecycle transitions, acknowledge flow, default simulated mixer alarms, alarm IPC, alarm pages, and persisted alarm history requirements.
- `historian-trend`: SQLite tag history persistence, bounded write strategy, real-time trend Ring Buffers, historical trend queries, query aggregation, trend IPC, and trend pages.

### Modified Capabilities

- None.

## Impact

- Main Process: add AlarmEngine, AlarmRepository, HistorianService, TagHistoryRepository, TrendQueryService, real-time trend buffer management, and alarm/trend IPC handlers.
- Preload: expose minimal typed alarm, historian, and trend APIs without exposing raw IPC, SQLite, Node.js, Modbus, or OPC UA.
- Renderer: add Alarm and Trend ViewModels and page implementations while preserving MVVM boundaries.
- Dependencies/packaging: add `better-sqlite3` as a production dependency and configure Electron native module packaging/rebuild handling as needed.
- Data: add a local SQLite schema for tag history and alarm history; database access remains in Main Process infrastructure.
- Tests: add unit tests for alarm condition evaluation, lifecycle transitions, delay/debounce, historian write strategy, ring buffer bounds, and trend aggregation/query behavior; add integration coverage for SQLite persistence and restart-readable historical trends.
