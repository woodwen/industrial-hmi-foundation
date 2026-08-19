## ADDED Requirements

### Requirement: SQLite Historian Storage
The Main Process SHALL provide SQLite-backed Historian storage for tag history and trend queries.

#### Scenario: Tag history schema contains required fields
- **WHEN** the Historian database schema is initialized
- **THEN** Tag History storage SHALL support `tagId`, `timestamp`, `value`, and `quality`
- **AND** timestamps SHALL be stored in a format that can be queried by time range

#### Scenario: SQLite access stays in Main Process
- **WHEN** Renderer requests historical data
- **THEN** Main Process SHALL query SQLite through Historian or repository services
- **AND** Renderer SHALL NOT access SQLite, Node.js APIs, file paths, or raw database handles

#### Scenario: Default SQLite driver is better-sqlite3
- **WHEN** Historian persistence dependencies are inspected
- **THEN** the implementation SHALL use `better-sqlite3` as the default SQLite driver
- **AND** it SHALL keep direct driver usage behind Main Process repository interfaces

#### Scenario: Historical data survives restart
- **WHEN** tag history has been persisted and the application restarts
- **THEN** historical trend queries SHALL return the previously persisted SQLite data

#### Scenario: Database initialization is idempotent
- **WHEN** the application starts multiple times with the same local database
- **THEN** schema initialization SHALL be safe to run repeatedly
- **AND** existing tag history and alarm history rows SHALL NOT be dropped by normal startup

### Requirement: Tag History Write Strategy
The system SHALL record selected Tag History points using bounded historian rules instead of saving every polling update.

#### Scenario: Historian consumes TagCache batches
- **WHEN** TagCache publishes a batch of TagValue updates
- **THEN** HistorianService SHALL evaluate the batch for persistence in Main Process
- **AND** it SHALL NOT trigger additional PLC reads for historical collection

#### Scenario: Default trend tags are tracked
- **WHEN** HistorianService is configured for the default simulated mixer device
- **THEN** it SHALL track Temperature, Level, Pressure, and RPM for tag history and trend use

#### Scenario: First sample is recorded
- **WHEN** HistorianService receives the first eligible sample for a tracked tag
- **THEN** it SHALL persist that Tag History point with value, quality, and timestamp

#### Scenario: Fixed interval records stable values
- **WHEN** a tracked tag remains within its deadband but the configured fixed interval has elapsed
- **THEN** HistorianService SHALL persist a Tag History point
- **AND** the default fixed interval SHALL be `5000ms`
- **AND** it SHALL avoid requiring a value change for long-running stable trends

#### Scenario: Deadband records meaningful value changes
- **WHEN** a tracked numeric tag changes by at least its configured deadband since the last persisted point
- **THEN** HistorianService SHALL persist a new Tag History point
- **AND** it SHALL suppress smaller changes until another recording rule is met

#### Scenario: Default historian deadbands are configured
- **WHEN** HistorianService is configured for default trend tags
- **THEN** current temperature SHALL use a history deadband of `0.2°C`
- **AND** current level SHALL use a history deadband of `0.5%`
- **AND** current pressure SHALL use a history deadband of `0.01MPa`
- **AND** RPM SHALL use a history deadband of `10 rpm`

#### Scenario: Quality changes are recorded
- **WHEN** a tracked tag quality changes between `Good`, `Bad`, and `Uncertain`
- **THEN** HistorianService SHALL persist a Tag History point even if the engineering value did not materially change

#### Scenario: Polling updates are not blindly persisted
- **WHEN** polling produces repeated updates faster than the historian strategy requires
- **THEN** HistorianService SHALL NOT write every polling result to SQLite
- **AND** the write rate SHALL remain bounded by the configured interval, deadband, and quality-change rules

### Requirement: Real-Time Trend Ring Buffer
The system SHALL maintain bounded in-memory Ring Buffers for real-time trend data.

#### Scenario: Required real-time trend tags are available
- **WHEN** the Trend page requests real-time trend data
- **THEN** the system SHALL support Temperature, Level, Pressure, and RPM trend series

#### Scenario: Ring buffer has maximum points
- **WHEN** a real-time trend buffer reaches its configured maximum point count
- **THEN** adding a new point SHALL evict the oldest point for that tag
- **AND** memory usage for that tag's real-time trend SHALL remain bounded

#### Scenario: Default ring buffer limit is 1800 points
- **WHEN** real-time trend buffers are configured for default trend tags
- **THEN** each tag SHALL retain at most `1800` real-time trend points by default

#### Scenario: Trend sampling is separated from polling
- **WHEN** TagCache receives updates faster than the configured real-time trend sample interval
- **THEN** TrendService SHALL downsample updates before appending real-time trend points
- **AND** the real-time trend buffer SHALL NOT grow at raw polling frequency

#### Scenario: Default real-time trend sample interval is one second
- **WHEN** TrendService is configured for default real-time trend tags
- **THEN** it SHALL sample trend points at a default interval of `1000ms`
- **AND** if multiple TagCache updates arrive within one interval, the latest eligible value in that interval SHALL be used

#### Scenario: Renderer trend state is bounded
- **WHEN** the Trend page remains open for a long-running session
- **THEN** its ViewModel SHALL retain no more than the configured maximum real-time points per tag
- **AND** React state SHALL NOT accumulate unlimited trend points

### Requirement: Real-Time Trend IPC and ViewModel
The system SHALL expose real-time trend snapshots and updates through typed Preload APIs.

#### Scenario: Renderer retrieves real-time trend snapshot
- **WHEN** Renderer initializes the real-time trend view
- **THEN** it SHALL request a bounded trend snapshot through a typed Preload API
- **AND** the result SHALL include timestamp, numeric value, quality, and tag id for each point

#### Scenario: Renderer subscribes to trend updates
- **WHEN** new real-time trend points are sampled
- **THEN** Renderer SHALL receive batched trend updates through a typed subscription API
- **AND** the subscription SHALL provide an unsubscribe function

#### Scenario: Trend IPC hides infrastructure
- **WHEN** trend data crosses from Main Process to Renderer
- **THEN** the payload SHALL contain trend DTOs only
- **AND** it SHALL NOT expose SQLite statements, repository instances, Node.js APIs, TagCache internals, or protocol adapter details

#### Scenario: First-phase trend chart avoids new chart dependency
- **WHEN** trend rendering dependencies are inspected for this change
- **THEN** the Trend page SHALL use local SVG or canvas rendering
- **AND** this change SHALL NOT add a third-party charting library solely for trend display

### Requirement: Historical Trend Query
The system SHALL query persisted Tag History for historical trend views.

#### Scenario: Preset time ranges are supported
- **WHEN** the Trend page requests historical trends
- **THEN** it SHALL support time ranges for last 1 hour, last 8 hours, today, and custom start/end time

#### Scenario: Query filters by selected tags and time range
- **WHEN** a historical trend query is executed
- **THEN** SQLite access SHALL filter by selected tag ids and timestamp range
- **AND** results SHALL be ordered by tag and time

#### Scenario: Recent small query can return raw points
- **WHEN** the number of matching historical points is within the configured maximum result size
- **THEN** TrendQueryService SHALL return raw historical points without unnecessary aggregation

#### Scenario: Large query is aggregated before IPC
- **WHEN** the number of matching historical points would exceed the configured maximum result size
- **THEN** TrendQueryService SHALL aggregate or downsample the data before returning it to Renderer
- **AND** Renderer SHALL NOT receive an unbounded historical point set

#### Scenario: Default historical query cap is 1000 points
- **WHEN** a historical trend query does not provide an explicit lower maximum
- **THEN** TrendQueryService SHALL cap returned historical trend data at `1000` points per tag by default

#### Scenario: Aggregated point preserves trend meaning
- **WHEN** TrendQueryService aggregates numeric history rows into time buckets
- **THEN** each returned bucket SHALL include timestamp, average value, minimum value, maximum value, last value, and quality summary
- **AND** the quality summary SHALL preserve whether `Bad` or `Uncertain` values were present in the bucket

### Requirement: Trend Performance Boundaries
The system SHALL bound memory, query, and IPC cost for trend analysis.

#### Scenario: Maximum points are configurable
- **WHEN** real-time or historical trend services are configured
- **THEN** each service SHALL have an explicit maximum points per tag setting
- **AND** the default settings SHALL prevent unbounded growth during long-running sessions

#### Scenario: No automatic retention cleanup in first phase
- **WHEN** Historian storage is running in this change
- **THEN** it SHALL NOT automatically delete or archive historical rows by age
- **AND** large-data safety SHALL rely on bounded write strategy, indexed queries, query caps, and aggregation

#### Scenario: Historical query result size is capped per tag
- **WHEN** Renderer queries a large custom time range
- **THEN** TrendQueryService SHALL cap returned points per tag to the configured maximum through aggregation or sampling

#### Scenario: Trend query uses indexed time access
- **WHEN** SQLite schema is initialized for Tag History
- **THEN** it SHALL include an index that supports tag id and time range lookup

#### Scenario: Trend page handles empty and degraded data
- **WHEN** a selected historical range has no points or contains non-Good quality points
- **THEN** the Trend ViewModel SHALL expose an empty or degraded-data state for the View
- **AND** the View SHALL NOT present stale or non-Good values as normal fresh data
