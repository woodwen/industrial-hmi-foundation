## ADDED Requirements

### Requirement: Audit Log Domain Model
系统 SHALL 定义结构化 Audit Log 领域模型，用于追踪关键工业控制操作和配置修改。

#### Scenario: Audit record contains required fields
- **WHEN** 审计记录被创建、持久化或查询
- **THEN** AuditRecord SHALL 至少包含 `timestamp`、`user`、`action`、`target`、`oldValue`、`newValue` 和 `result`
- **AND** 实现 SHALL 支持稳定 `id` 或等价唯一标识

#### Scenario: Audit user is local user
- **WHEN** 受保护操作产生审计记录
- **THEN** `user` SHALL 来自 Main Process 当前本地用户会话
- **AND** SHALL NOT 由 Renderer 请求体自行声明最终用户身份

#### Scenario: Audit result states are explicit
- **WHEN** 审计记录保存操作结果
- **THEN** `result` SHALL 明确表示 `Succeeded`、`Rejected`、`Failed`、`PartialFailed`、`TimedOut` 或等价结构化状态
- **AND** SHALL NOT 仅用普通文本日志替代结果状态

#### Scenario: Sensitive values are not audited
- **WHEN** 用户凭据、token 或其他敏感值参与操作
- **THEN** AuditService SHALL NOT 将明文密码、密码哈希、salt、token 或底层连接密钥写入 `oldValue`、`newValue` 或 metadata

### Requirement: Audit Persistence
系统 SHALL 将审计日志持久化到 Main Process SQLite 存储。

#### Scenario: Audit schema is initialized idempotently
- **WHEN** 应用启动并初始化 SQLite schema
- **THEN** audit log 表和索引 SHALL 被幂等创建
- **AND** 正常启动 SHALL NOT 删除既有审计记录

#### Scenario: Audit log survives restart
- **WHEN** 关键操作已经写入 Audit Log 且应用重启
- **THEN** AuditService 查询 SHALL 返回重启前持久化的审计记录
- **AND** 记录 SHALL 保留时间、用户、动作、目标和结果信息

#### Scenario: Renderer cannot access audit database directly
- **WHEN** Renderer 查询 Audit Log
- **THEN** Main Process SHALL 通过 AuditService 或 repository 查询 SQLite
- **AND** Renderer SHALL NOT 获得 SQLite handle、文件路径、SQL statement 或 Node.js API

#### Scenario: Audit query uses bounded result set
- **WHEN** Renderer 查询大量审计记录
- **THEN** AuditService SHALL 支持分页或显式数量上限
- **AND** typed IPC SHALL NOT 一次性返回无界审计数据集

#### Scenario: Audit retention cleanup is not automatic in first phase
- **WHEN** Audit Log 持久化运行在本期能力范围内
- **THEN** 系统 SHALL NOT 自动按时间删除或归档审计记录
- **AND** 大量数据风险 SHALL 通过索引、筛选、分页和查询上限控制

### Requirement: Audited Industrial Actions
系统 SHALL 对关键工业控制操作、Recipe 操作、报警确认、用户和配置修改写入审计记录。

#### Scenario: Start and stop are audited
- **WHEN** 用户执行 Start 或 Stop 命令
- **THEN** CommandService SHALL 写入 Audit Log
- **AND** 审计记录 SHALL 包含用户、动作、目标设备或 Tag、旧值、新值和命令结果

#### Scenario: Setpoint changes are audited
- **WHEN** 用户修改 Target Temperature、RPM Setpoint 或其他受控设定值
- **THEN** CommandService SHALL 写入 Audit Log
- **AND** `oldValue` SHALL 来自 Main Process 可用的 TagCache 快照、read-back 或 repository 状态

#### Scenario: Valve operations are audited
- **WHEN** 用户执行 Inlet Valve 或 Outlet Valve 控制命令
- **THEN** CommandService SHALL 写入 Audit Log
- **AND** 审计结果 SHALL 区分权限拒绝、写入失败、验证失败和成功

#### Scenario: Recipe download is audited
- **WHEN** 用户请求下载 Recipe 到设备
- **THEN** RecipeDownloadService SHALL 写入带 correlationId 的 Audit Log
- **AND** 审计记录 SHALL 包含 Recipe `id`、`version`、目标设备和步骤汇总结果

#### Scenario: Alarm acknowledge is audited
- **WHEN** 用户确认报警
- **THEN** AlarmEngine 或其应用服务 SHALL 写入 Audit Log
- **AND** 审计记录 SHALL 包含报警 occurrence、旧状态、新状态和确认结果

#### Scenario: User and configuration changes are audited
- **WHEN** 用户管理、系统配置、Tag 配置或 Recipe 配置被创建、修改或删除
- **THEN** 对应 Main Process 服务 SHALL 写入 Audit Log
- **AND** 审计记录 SHALL 包含变更前后摘要和结果

### Requirement: Audit Preflight and Finalization
系统 SHALL 避免关键 HMI 写操作在无法审计时继续执行。

#### Scenario: Critical operation reserves audit before write
- **WHEN** Start、Stop、Setpoint 修改、Valve 操作或 Recipe Download 即将写设备
- **THEN** Main Process SHALL 在写设备前创建 pending 审计记录或确认 AuditService 可用
- **AND** 无法创建审计记录时 SHALL 拒绝该 HMI 写操作

#### Scenario: Audit finalization stores operation outcome
- **WHEN** 受审计操作完成、失败、超时或被拒绝
- **THEN** AuditService SHALL 将最终结果更新或追加到审计记录
- **AND** 记录 SHALL 能支持后续按结果查询

#### Scenario: Finalization failure is visible
- **WHEN** 设备写入已经完成但审计最终结果更新失败
- **THEN** 业务结果 SHALL 包含审计完成失败摘要
- **AND** 系统 SHALL 写 Application/Error 日志以便排查

#### Scenario: Unauthorized attempts are audited
- **WHEN** 用户尝试执行受保护操作但权限不足
- **THEN** Main Process SHALL 写入 `Rejected` 审计记录
- **AND** SHALL NOT 调用协议适配器或修改受保护 repository 状态

### Requirement: Audit Log Renderer Page
Renderer SHALL 提供 Audit Log 页面，用于查询和查看审计记录。

#### Scenario: Audit page supports filters
- **WHEN** 用户打开 Audit Log 页面
- **THEN** AuditLogViewModel SHALL 支持按时间范围、用户、动作、目标和结果查询
- **AND** 查询 SHALL 通过 typed Preload API 到 Main Process 执行

#### Scenario: Audit page is permission guarded
- **WHEN** 当前用户没有 `audit:read` 权限
- **THEN** Renderer SHALL 隐藏或禁用 Audit Log 入口
- **AND** Main Process SHALL 拒绝 Audit Log 查询 API

#### Scenario: Audit page displays structured values
- **WHEN** Audit Log 查询返回记录
- **THEN** 页面 SHALL 展示时间、用户、动作、目标、旧值、新值和结果
- **AND** 对 Recipe Download SHALL 能展示整体结果和步骤汇总摘要

#### Scenario: Audit page handles empty result
- **WHEN** 查询条件没有匹配审计记录
- **THEN** AuditLogViewModel SHALL 暴露空结果状态
- **AND** View SHALL NOT 把空结果误报为查询失败
