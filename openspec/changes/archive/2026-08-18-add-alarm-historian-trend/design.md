## Context

`industrial-hmi-foundation` 已经具备 Electron Main / Preload / Renderer 分层、MobX MVVM、PLC Simulator、Modbus TCP Adapter、DeviceManager、TagService、TagCache、PollingScheduler、CommandService、自动重连、Tag Quality 和 Dashboard/Device 实时监控能力。当前缺口是：异常工况只停留在实时值和设备状态层，没有工业报警生命周期、报警确认、报警历史、过程数据持久化和趋势分析。

本 change 在既有 TagCache 和 DeviceManager 之上增加 Alarm、Historian 和 Trend 能力。核心数据流保持：

```text
PLC Simulator / DeviceManager
        ↓
TagService / TagCache
        ↓
AlarmEngine / HistorianService / TrendService
        ↓
Typed IPC
        ↓
Renderer ViewModel
        ↓
React View
```

Renderer 不直接访问 SQLite、Node.js、Modbus、OPC UA、TCP Socket 或 raw IPC。所有 SQLite 读写、报警计算、历史查询和趋势降采样都在 Main Process 完成。

## Goals / Non-Goals

**Goals:**

- 实现 Alarm Engine，支持 `High`、`HighHigh`、`Low`、`LowLow`、`BooleanState` 五类第一期报警条件。
- 定义 `Info`、`Warning`、`High`、`Critical` 报警等级。
- 建模 `Inactive`、`Active`、`Acknowledged`、`Recovered` 生命周期，并明确 `Acknowledged` 与 `Recovered` 不等价。
- 提供默认测试报警：温度过高、液位过低、压力过高、电机异常、PLC 断线。
- 支持报警 delay/debounce，避免瞬时抖动产生大量报警。
- 支持报警确认，并持久化 trigger、acknowledge、recover、trigger value 和 user。
- 使用 `better-sqlite3` 保存 Tag History 和 Alarm History，并通过 Main Process repository 封装。
- 通过 fixed interval、change based 和 deadband 组合策略记录历史数据，避免保存每次 Polling 更新。
- 为 Temperature、Level、Pressure、RPM 提供有最大点数的实时趋势 Ring Buffer。
- 为最近 1 小时、最近 8 小时、今天、自定义时间范围提供历史趋势查询。
- 对大时间范围趋势查询进行 SQL 聚合/降采样，限制 IPC 和 Renderer 点数。
- 保证重启程序后仍能查询已持久化的报警历史和历史趋势。

**Non-Goals:**

- 不实现 Recipe。
- 不实现权限系统；acknowledge user 第一阶段使用明确传入或默认操作员标识，后续权限 change 再接入真实用户。
- 不实现 OPC UA。
- 不实现复杂表达式引擎、脚本化规则或任意组合条件。
- 不实现报警通知推送、声音、短信、邮件或外部告警系统。
- 不实现长期归档、远程数据库、云同步或多站点 historian。
- 不实现历史数据自动清理或保留期配置；本期通过查询限流、索引和聚合控制运行风险。
- 不新增第三方图表库；本期趋势图使用本地 SVG/canvas 实现。

## Decisions

### 1. Alarm Engine 属于 Main Process Domain Service

AlarmEngine 订阅 TagCache 批量更新和 DeviceManager 状态事件，在 Main Process 内评估报警。Renderer 只能通过 typed Preload API 获取实时报警、查询历史报警、提交 acknowledge。

不采用 Renderer 计算报警的方案，因为 Renderer 可能被刷新、窗口关闭或节流，不能作为工业报警状态的事实来源；也不能让 Renderer 接触底层 TagCache、设备状态机或 SQLite。

### 2. AlarmDefinition 保持简单，复杂输入用标准化 Alarm Signal 解决

报警定义至少包含：

```text
id
code
tagId
condition
threshold
delay
level
message
enabled
```

`tagId` 指向 AlarmEngine 可读取的报警输入。大多数输入来自真实 TagValue；PLC 断线和电机异常这类非单一模拟量输入由 Main Process 生成合成 Alarm Signal，例如：

```text
device.simulated-plc.connectionLost
mixer.motorAbnormal
```

这样默认测试报警仍可使用同一套 `AlarmDefinition` 和 `BooleanState` 条件，不引入通用表达式引擎。合成信号属于 AlarmEngine/Domain 层，不写入 Modbus 映射，也不让业务代码依赖 PLC Simulator 私有故障控制。

### 3. Alarm 条件语义

第一期条件定义：

| Condition | Trigger | Recover |
| --- | --- | --- |
| `High` | numeric value `>` threshold | value `<= threshold - deadband` |
| `HighHigh` | numeric value `>` threshold | value `<= threshold - deadband` |
| `Low` | numeric value `<` threshold | value `>= threshold + deadband` |
| `LowLow` | numeric value `<` threshold | value `>= threshold + deadband` |
| `BooleanState` | boolean value equals threshold/expected state | boolean value no longer equals threshold/expected state |

Analog recovery uses hysteresis/deadband so values around the threshold do not flap. Deadband may be defined per alarm, with the following first-phase defaults:

| Tag | Deadband |
| --- | --- |
| Temperature | `0.5°C` |
| Level | `1.0%` |
| Pressure | `0.02MPa` |
| RPM | `20 rpm` |

AlarmEngine SHALL evaluate only enabled alarms. Normal tag alarms require `TagQuality.Good`; non-Good quality does not trigger analog threshold alarms by itself. PLC disconnect is represented by a separate device-state alarm signal.

### 4. Alarm delay/debounce state machine

Each definition has one runtime evaluation state:

```text
normal
pendingActive(condition first became true at t1)
activeOccurrence
pendingRecover(condition first became false at t2)
```

Rules:

- If condition becomes true, AlarmEngine enters `pendingActive`.
- If condition remains true for `delay` milliseconds, an occurrence becomes `Active`.
- If condition clears before `delay`, the pending state is discarded and no history row is created.
- While an occurrence is `Active` or `Acknowledged`, continued true evaluations do not create duplicate occurrences.
- If condition becomes false after activation, recovery must remain stable for `recoveryDelay`; default `recoveryDelay = delay` unless explicitly configured.
- After a stable recovery, AlarmEngine records `recoverTime` and `recoverValue`.
- A recovered-but-unacknowledged occurrence remains user-visible until acknowledged; when acknowledged, it immediately becomes `Recovered`.
- Acknowledged-but-still-active occurrence stays `Acknowledged` until the condition recovers.
- A `Recovered` occurrence is closed and the definition may re-arm after the condition has remained clear.

This keeps the visible lifecycle compatible with:

```text
Inactive -> Active -> Acknowledged -> Recovered
```

It also handles the real-world case where the process value recovers before the operator acknowledges the alarm without adding extra first-phase states such as `ReturnedUnacked`.

### 5. Alarm lifecycle and persistence

Runtime status meaning:

| Status | Meaning |
| --- | --- |
| `Inactive` | No current occurrence exists for the definition. |
| `Active` | An occurrence exists and still requires operator acknowledgement. The triggering condition may or may not still be physically true. |
| `Acknowledged` | Operator acknowledged the occurrence, but the triggering condition has not yet recovered. |
| `Recovered` | The occurrence has both been acknowledged and physically recovered. |

AlarmHistory is written when an occurrence activates, then updated on acknowledge and recovery. Alarm history is the durable source for History Alarm queries. The in-memory active map is rebuilt from definitions and current Tag/Device state at startup; historical rows remain queryable after restart.

Because the permission system is out of scope, acknowledge uses a fixed first-phase user value:

```text
operator
```

The implementation should not read the OS username for this value. That keeps test data deterministic and avoids implying a real permission/audit system before that capability exists.

### 6. Default test alarms

Default alarms are fixed as:

| Code | Source | Condition | Threshold | Delay | Level | Message |
| --- | --- | --- | --- | --- | --- | --- |
| `TEMP_HIGH` | current temperature | `High` | `80.0°C` | `3000ms` | `High` | Temperature is too high |
| `LEVEL_LOW` | current level | `Low` | `15.0%` | `3000ms` | `Warning` | Level is too low |
| `PRESSURE_HIGH` | current pressure | `High` | `0.30MPa` | `2000ms` | `High` | Pressure is too high |
| `MOTOR_ABNORMAL` | `mixer.motorAbnormal` | `BooleanState` | `true` | `5000ms` | `Critical` | Motor feedback is abnormal |
| `PLC_DISCONNECTED` | `device.simulated-plc.connectionLost` | `BooleanState` | `true` | `1000ms` | `Critical` | PLC communication is lost |

`mixer.motorAbnormal` is generated by Main Process domain logic from known command/feedback state, for example motor expected running but feedback remains false after delay. It is intentionally a named domain signal, not a general expression rule.

### 7. Historian write strategy

HistorianService subscribes to TagCache batch updates and records only configured historical Tags. First-phase defaults:

- Temperature
- Level
- Pressure
- RPM

Each tracked Tag is recorded when any of these conditions is true:

- First valid sample for the tag.
- Fixed interval elapsed since the last persisted point; default `5000ms`.
- Numeric value changed by at least the configured deadband since the last persisted point.
- Quality changed, even if value did not change.

Default history deadbands:

| Tag | Deadband |
| --- | --- |
| Temperature | `0.2°C` |
| Level | `0.5%` |
| Pressure | `0.01MPa` |
| RPM | `10 rpm` |

This strategy preserves trend shape and quality transitions without writing every `500ms` polling event. Writes should be batched into short transactions to reduce SQLite overhead. On application shutdown, pending history writes should be flushed and the database closed.

### 8. SQLite driver, packaging, and schema

SQLite is accessed only in Main Process through repository interfaces. The default driver is `better-sqlite3`, added as a production dependency because packaged Electron builds include production dependencies only. Repository interfaces isolate `better-sqlite3` so a later driver change does not leak into AlarmEngine, HistorianService, TrendQueryService, Preload, or Renderer.

Electron packaging defaults:

- Keep `better-sqlite3` in `dependencies`, not `devDependencies`.
- Rely on electron-builder native dependency rebuild during packaging.
- Add `asarUnpack` for `node_modules/better-sqlite3/**` if packaged runtime testing shows the native module cannot load from ASAR.
- Validate with `npm run build`; run `npm run dist` only when packaging verification is required by the implementation pass.

Database path:

```text
app.getPath("userData")/industrial-hmi.sqlite
```

Tests may override the path to a temporary directory.

Schema versioning:

```sql
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Tag History:

```sql
CREATE TABLE IF NOT EXISTS tag_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_id TEXT NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  value_type TEXT NOT NULL,
  value_numeric REAL,
  value_text TEXT,
  value_bool INTEGER,
  quality TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tag_history_tag_time
  ON tag_history (tag_id, timestamp_ms);
```

Alarm History:

```sql
CREATE TABLE IF NOT EXISTS alarm_history (
  id TEXT PRIMARY KEY,
  definition_id TEXT NOT NULL,
  code TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  trigger_time_ms INTEGER NOT NULL,
  acknowledge_time_ms INTEGER,
  recover_time_ms INTEGER,
  trigger_value_type TEXT,
  trigger_value_numeric REAL,
  trigger_value_text TEXT,
  trigger_value_bool INTEGER,
  recover_value_type TEXT,
  recover_value_numeric REAL,
  recover_value_text TEXT,
  recover_value_bool INTEGER,
  acknowledge_user TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alarm_history_time
  ON alarm_history (trigger_time_ms);

CREATE INDEX IF NOT EXISTS idx_alarm_history_status_level
  ON alarm_history (status, level, trigger_time_ms);
```

Timestamps are stored as UTC epoch milliseconds. Numeric trend queries use `value_numeric`; non-numeric rows remain available for history/audit style views but are not plotted as numeric trends.

### 9. Real-time trend Ring Buffer

TrendService maintains a per-tag Ring Buffer for real-time trend tags:

```text
Map<tagId, RingBuffer<TrendPoint>>
```

`TrendPoint` contains:

```text
tagId
timestamp
value
quality
```

First-phase defaults:

- sample interval: `1000ms`
- maximum points per tag: `1800`
- supported tags: Temperature, Level, Pressure, RPM

The Ring Buffer accepts downsampled points, not every raw polling update. If TagCache updates faster than the trend sample interval, the latest value in that interval wins. Renderer ViewModels also keep bounded arrays so a long-running Trend page cannot accumulate unlimited points even if the page stays open all day.

### 10. Real-time trend IPC

Renderer obtains real-time trend data through typed APIs:

```text
getRealtimeTrendSnapshot(tagIds)
subscribeRealtimeTrend(tagIds, listener)
```

Main Process sends batched, throttled trend updates. IPC payloads include no raw SQLite handles, no Node objects, and no protocol details. Renderer applies updates in a MobX action and trims to its configured maximum point count.

### 11. Historical trend query strategy

TrendQueryService reads SQLite through repository methods. Supported ranges:

- last 1 hour
- last 8 hours
- today
- custom start/end time

The query API takes:

```text
tagIds
startTime
endTime
maxPointsPerTag
```

Default `maxPointsPerTag = 1000`.

If the raw point count is within the cap, return ordered raw rows. If the range would exceed the cap, aggregate in SQLite before returning:

```text
bucketMs = ceil((endTime - startTime) / maxPointsPerTag)
```

For each tag and bucket, return:

```text
timestamp
avg
min
max
last
quality
```

`avg` is used for the trend line; `min/max` may be used for an envelope later; `last` preserves the latest bucket value; `quality` is the worst quality present in that bucket using `Bad > Uncertain > Good`. Aggregation happens before IPC, so Renderer never receives unbounded historical rows.

### 12. Alarm and Trend Renderer design

Alarm page uses ViewModels and typed APIs:

- Real-time Alarm tab: current `Active`, `Acknowledged`, and recently `Recovered` occurrences.
- History Alarm tab: filter/query persisted alarm history by level, status, time range, tag, and acknowledge user.
- Acknowledge action flows View -> ViewModel -> Preload API -> Main IPC -> AlarmEngine/AlarmRepository.

Trend page uses ViewModels and typed APIs:

- Real-time tab or mode for Temperature, Level, Pressure, RPM.
- Historical mode with presets: last 1 hour, last 8 hours, today, custom time.
- UI state includes loading/error/empty states and never stores unbounded point arrays.
- Chart rendering uses local SVG/canvas code in this change, not a new charting dependency.

React views remain display-only and do not know SQLite SQL, polling scan rates, Modbus addresses, or alarm condition internals.

### 13. Historical data retention

This change does not delete or archive historical rows automatically. Disk retention is deferred to a later hardening change. Runtime safety for this phase comes from:

- historian write suppression by fixed interval/deadband/quality change;
- indexed SQLite time-range access;
- per-tag historical query caps;
- SQL aggregation before IPC for large ranges;
- bounded Renderer series state.

### 14. Verification strategy

Core domain logic gets unit tests:

- Alarm condition evaluation for all five condition types.
- Alarm delay, recovery delay, deadband/hysteresis, duplicate suppression, acknowledge, and recovered transitions.
- Default alarm definitions are valid and enabled as expected.
- Historian write strategy records first sample, fixed interval, deadband changes, and quality changes while suppressing unchanged high-frequency updates.
- Ring Buffer drops old points after reaching maximum size.
- Historical trend aggregation caps result size and preserves quality degradation.

Integration tests use a temporary SQLite database:

- Tag history persists and can be queried after repository/service restart.
- Alarm history persists trigger, acknowledge, recover, trigger value, and user.
- Historical trend query returns data after recreating the service.

Renderer/ViewModel tests verify the UI layer consumes typed API clients and keeps bounded collections.

## Risks / Trade-offs

- [Risk] `better-sqlite3` may require native Electron rebuild or ASAR unpacking. -> Keep it behind repository interfaces, configure native packaging only where needed, and include build/package verification in implementation tasks.
- [Risk] Acknowledgement without a real permission system can be mistaken for audited operator identity. -> Store the fixed first-phase acknowledge user string `operator`, avoid OS username lookup, and document that true permissions are deferred.
- [Risk] Alarm lifecycle with only four states cannot fully express returned-unacknowledged industrial states. -> Keep first-phase semantics explicit: recovered physical condition is recorded, but visible `Recovered` requires acknowledgement and recovery.
- [Risk] Historical trend queries over large time ranges can overload Renderer if raw rows are returned. -> Enforce `maxPointsPerTag` and perform SQL aggregation before IPC.
- [Risk] Synchronous SQLite writes can interfere with polling if performed per update. -> Batch writes and keep Historian write policy coarse enough to avoid per-poll persistence.
- [Risk] Synthetic alarm signals can become hidden business logic. -> Keep each synthetic signal named, documented, and tested; do not introduce a generic expression engine in this change.

## Migration Plan

1. Add SQLite schema initialization with idempotent table/index creation and schema version metadata.
2. Start with an empty local database for existing installations; no historical backfill is required.
3. On application startup, initialize repositories before AlarmEngine/Historian/Trend subscriptions begin.
4. On application shutdown, flush pending history writes and close the database connection.
5. Rollback is safe by stopping the new services and leaving the SQLite file unused; no existing project data is mutated.

## Open Questions

- None for this change's default implementation plan.
