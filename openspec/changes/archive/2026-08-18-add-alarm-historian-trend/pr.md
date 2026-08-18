# M-10(feat): 新增报警历史与趋势分析

OpenSpec Change: add-alarm-historian-trend

背景:
- 前置版本已经具备 PLC Simulator、Modbus TCP、Tag 周期采集、TagCache、设备状态机、自动重连、CommandService 和写入验证。
- 当前 HMI 仍缺少工业现场常见的报警管理、历史数据记录、实时趋势和历史趋势能力，无法验证高温报警、报警确认、恢复、历史查询和长时间运行数据边界。

方案概述:
- 在 Main Process 新增 AlarmEngine，支持 `High`、`HighHigh`、`Low`、`LowLow`、`BooleanState` 条件，明确 `Inactive`、`Active`、`Acknowledged`、`Recovered` 生命周期。
- 新增默认测试报警：温度过高、液位过低、压力过高、电机异常、PLC 断线，并通过 delay、recovery debounce 和 deadband 抑制瞬时抖动。
- 使用 `better-sqlite3` 在 Main Process 持久化 `tag_history` 和 `alarm_history`，通过 repository 封装数据库访问。
- Historian 采用 first sample、`5000ms` fixed interval、deadband 和 quality change 组合策略，避免每次 polling 都写入 SQLite。
- 实时趋势使用每 Tag 有界 Ring Buffer，历史趋势从 SQLite 查询并在大范围场景下用 SQL bucket 聚合后再返回 Renderer。
- Renderer 通过 typed Preload API、ApplicationService 和 ViewModel 使用 Alarm / Trend 能力，页面不直接访问 SQLite、Node.js、协议或 Main Process service。

实现改动:
- 新增 `src/shared/alarm.ts`、`src/shared/trend.ts`，扩展 `src/shared/hmi-api.ts` 和 `src/shared/ipc-channels.ts`，定义报警、趋势、查询和 IPC DTO。
- 新增 `src/main/alarm/` 下的 AlarmEngine、条件评估、默认报警定义和 AlarmHistoryRepository。
- 新增 `src/main/historian/` 下的 HistorianDatabase、TagHistoryRepository、HistorianService、TrendService、TrendQueryService、RingBuffer 和持久化 value codec。
- 扩展 `src/main/runtime.ts`、`src/main/index.ts`、`src/main/ipc/register.ts`、`src/main/ipc/input-validation.ts`，完成服务初始化、资源释放、输入校验和 IPC handler 注册。
- 新增 `src/main/ipc/alarm-publisher.ts` 和 `src/main/ipc/trend-publisher.ts`，支持报警和实时趋势 subscription 清理。
- 扩展 `src/preload/index.ts`、Renderer API client、RootViewModel、AlarmViewModel、TrendViewModel、Alarm 页面和 Trend 页面。
- 将 `mixerMotorRunningStatus` 纳入默认 Tag 定义，使默认电机异常报警具备真实 Tag 信号来源。
- 新增 `better-sqlite3` 和 `@types/better-sqlite3`，并配置 Electron Builder `asarUnpack` 处理原生模块。
- 更新 `CHANGELOG.md`、`docs/alarm-historian-trend.md`、Tag polling 文档、Alarm/Historian README 和 OpenSpec archive/spec。

测试计划(UT):
- `openspec validate add-alarm-historian-trend --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

影响范围(建议手动测试范围):
- 启动 `npm run simulator:start` 和 Electron HMI，连接默认模拟 PLC。
- 模拟温度高于 `80.0°C` 并保持超过 `3000ms`，确认 Real-time Alarm 出现 `TEMP_HIGH`。
- 点击 acknowledge，确认报警记录 `operator`，温度恢复后进入 `Recovered`。
- 在 History Alarm 查询 level、status、time、tag、acknowledge user 过滤结果。
- 打开 Trend 页面，确认 Temperature、Level、Pressure、RPM 可以显示实时趋势。
- 重启应用后查询 Historical Trend，确认 SQLite 中的历史趋势点仍可读取。

风险与后续:
- 本期不实现 Recipe、权限系统、OPC UA 或自动历史数据保留清理。
- 第一阶段 acknowledge user 固定为 `operator`，后续权限系统接入后再替换为真实用户身份。
- 趋势图使用本地 SVG 基础展示，后续如果需要游标、缩放、数据导出或多轴，应在独立 change 中设计。
