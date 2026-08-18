# Alarm Historian Trend

本文档记录 `add-alarm-historian-trend` change 引入的报警、历史数据和趋势能力。

本项目仍是基于 PLC Simulator 的学习和工程实践项目。以下报警、历史库和趋势逻辑用于 HMI 架构验证，不表示系统已经应用于真实生产环境。

## Architecture

运行链路：

```text
PLC / PLC Simulator
  ↓ PollingScheduler
TagService
  ↓
TagCache
  ├─ AlarmEngine
  ├─ HistorianService
  └─ TrendService
      ↓ typed IPC / Preload
Renderer ViewModel
      ↓
Alarm / Trend pages
```

Renderer 只通过 `window.hmi.alarms` 和 `window.hmi.trends` 使用 typed Preload API。Renderer 不访问 SQLite、Node.js、Modbus、协议适配器或 AlarmEngine / HistorianService 实例。

## Alarm Lifecycle

报警定义使用统一 `AlarmDefinition`，包含 `id`、`code`、`tagId`、`condition`、`threshold`、`delay`、`level`、`message`、`enabled`。`delay` 单位为毫秒。

支持条件：

| Condition | 触发语义 |
| --- | --- |
| `High` | 数值大于阈值 |
| `HighHigh` | 数值大于阈值 |
| `Low` | 数值小于阈值 |
| `LowLow` | 数值小于阈值 |
| `BooleanState` | boolean 信号等于阈值 |

生命周期：

```text
Inactive
  ↓ condition true after delay
Active
  ↓ acknowledge while still abnormal
Acknowledged
  ↓ condition recovered after recovery delay
Recovered
```

`Acknowledged` 表示操作员已经确认报警；`Recovered` 表示报警条件已经物理恢复且报警已确认。两者不是同一概念。

如果报警先恢复但尚未确认，系统会记录 `recoverTime` / `recoverValue`，但可见状态保持 `Active`，直到操作员 acknowledge 后才进入 `Recovered`。

第一期没有权限系统，未传入用户时 acknowledge user 固定为 `operator`，不会读取操作系统用户名。

## Default Alarms

| Code | Tag / Signal | Condition | Threshold | Delay | Level | Message |
| --- | --- | --- | ---: | ---: | --- | --- |
| `TEMP_HIGH` | `currentTemperature` | `High` | `80.0°C` | `3000ms` | `High` | `Temperature is too high` |
| `LEVEL_LOW` | `currentLevel` | `Low` | `15.0%` | `3000ms` | `Warning` | `Level is too low` |
| `PRESSURE_HIGH` | `currentPressure` | `High` | `0.30MPa` | `2000ms` | `High` | `Pressure is too high` |
| `MOTOR_ABNORMAL` | `mixer.motorAbnormal` | `BooleanState` | `true` | `5000ms` | `Critical` | `Motor feedback is abnormal` |
| `PLC_DISCONNECTED` | `device.simulated-plc.connectionLost` | `BooleanState` | `true` | `1000ms` | `Critical` | `PLC communication is lost` |

`mixer.motorAbnormal` 由 Main Process 根据 `deviceRunningStatus == true` 且 `mixerMotorRunningStatus == false` 合成。`device.simulated-plc.connectionLost` 由 DeviceManager 状态合成，`Reconnecting` 和 `Fault` 视为通信丢失。

默认恢复 deadband：

| Tag | Deadband |
| --- | ---: |
| `currentTemperature` | `0.5°C` |
| `currentLevel` | `1.0%` |
| `currentPressure` | `0.02MPa` |
| `motorRpm` | `20 rpm` |

恢复延迟默认等于报警激活 `delay`。

## SQLite Schema

SQLite 只在 Main Process 中使用，由 repository 封装，业务模块不直接拼写 SQL。

数据库位置：

- 正常运行：Electron `userData/industrial-hmi.sqlite`
- 测试：可通过 runtime option 或 repository 测试使用临时路径 / `:memory:`

schema：

```text
schema_meta(key, value)

tag_history(
  id,
  tag_id,
  timestamp_ms,
  value_type,
  value_numeric,
  value_text,
  value_bool,
  quality,
  created_at_ms
)

alarm_history(
  id,
  definition_id,
  code,
  tag_id,
  level,
  message,
  status,
  trigger_time_ms,
  acknowledge_time_ms,
  recover_time_ms,
  trigger_value_*,
  recover_value_*,
  acknowledge_user,
  condition_active,
  created_at_ms,
  updated_at_ms
)
```

关键索引：

- `tag_history(tag_id, timestamp_ms)`
- `alarm_history(trigger_time_ms)`
- `alarm_history(status, level, trigger_time_ms)`

打包配置启用 `asar`，并将 `node_modules/better-sqlite3/**` 加入 `asarUnpack`，避免原生模块在打包后无法加载。

## Historian Write Strategy

HistorianService 订阅 TagCache batch，不增加额外 PLC 读取。

默认保存趋势 Tag：

- `currentTemperature`
- `currentLevel`
- `currentPressure`
- `motorRpm`

记录策略：

| Rule | 说明 |
| --- | --- |
| first sample | 每个 Tag 首次有效样本保存 |
| fixed interval | 同一 Tag 距上次保存达到 `5000ms` 保存 |
| change based | 数值变化超过 deadband 保存 |
| quality change | `Good` / `Bad` / `Uncertain` 变化立即保存 |

默认 historian deadband：

| Tag | Deadband |
| --- | ---: |
| `currentTemperature` | `0.2°C` |
| `currentLevel` | `0.5%` |
| `currentPressure` | `0.01MPa` |
| `motorRpm` | `10 rpm` |

重复 polling 值如果没有超过 fixed interval、deadband 或 quality change，不写入 SQLite。

本期不做自动历史数据保留清理，不按时间删除或归档历史库。

## Trend

实时趋势和历史趋势分开：

| 类型 | 数据源 | 上限策略 |
| --- | --- | --- |
| real-time trend | Main Process per-tag Ring Buffer | 默认每 Tag 最多 `1800` 点 |
| historical trend | SQLite `tag_history` | 默认每 Tag 返回最多 `1000` 点，超限走 SQL 聚合 |

TrendService 默认每 `1000ms` 从 TagCache 当前值采样一次，只采样数值型点，并保留 point quality。Ring Buffer 到达容量后丢弃最旧点，避免长期运行无限增长。

历史趋势支持：

- 最近 1 小时
- 最近 8 小时
- 今天
- 自定义开始/结束时间

大范围查询策略：

1. 先用索引按 `tag_id + timestamp_ms` 计算每个 Tag 的点数。
2. 任一 Tag 超过 `maxPointsPerTag` 时，按查询跨度计算 bucket size。
3. 在 SQLite 中按 bucket 聚合，返回 `avg` 作为 `value`，同时返回 `min`、`max`、`last`。
4. 聚合 quality 使用降级汇总：bucket 内有 `Bad` 则为 `Bad`，否则有 `Uncertain` 则为 `Uncertain`，否则为 `Good`。
5. Renderer 只接收压缩后的点集，不长期持有全部历史数据。

## Manual Verification

1. 启动 Simulator：`npm run simulator:start`。
2. 启动 HMI 并连接设备。
3. 模拟或写入温度超过 `80.0°C` 并保持超过 `3000ms`。
4. Real-time Alarm 应出现 `TEMP_HIGH`。
5. 点击 acknowledge 后，报警显示 acknowledge user `operator`。
6. 温度恢复到低于阈值和 deadband 后，报警进入 `Recovered`。
7. History Alarm 可查询触发、确认和恢复记录。
8. Trend 页面可显示 Temperature、Level、Pressure、RPM 的实时趋势。
9. 重启应用后，Historical Trend 仍能查询 SQLite 中的历史点。
