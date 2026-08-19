## Context

当前系统已经具备 Main Process 侧的 DeviceManager、TagService、PollingScheduler、TagCache、CommandService、AlarmEngine、Historian/SQLite，以及 Renderer 侧基于 ViewModel 的监控、控制、报警、趋势页面。现有控制链路已经要求所有写设备操作经过 CommandService，并区分写入接受和 read-back/feedback 验证。

本期在此基础上增加三个横向能力：Recipe、Local User/Permission、Audit Log。它们会同时影响 Main Process 服务、typed Preload API、Renderer ViewModel 和 SQLite schema。设计必须保持 Electron 边界：Renderer 只负责交互和展示，不直接访问 SQLite、协议库、CommandService、AlarmEngine 或 Node.js API。

本项目仍以 PLC Simulator 作为测试设备。本期权限和审计是 HMI/学习项目层面的工程保护与追溯能力，不声明具备真实生产安全系统或 Safety PLC 能力。

## Goals / Non-Goals

**Goals:**

- 建立 Recipe 领域模型，支持配方 CRUD、复制、加载和下载到设备。
- 将 Recipe 下载实现为受控命令事务：参数校验、Tag Command 转换、顺序/批量写入、read-back、结果汇总。
- 建立本地用户、角色和权限矩阵，覆盖 Operator、Engineer、Admin。
- 在 Main Process 对关键写操作做权威权限校验，Renderer 权限状态只用于体验优化。
- 建立 SQLite 持久化 Audit Log，覆盖 Start、Stop、Setpoint 修改、Valve 操作、Recipe Download、Alarm Acknowledge、用户/配置修改。
- 新增 Recipe Management、User Management、Audit Log 页面，并通过 ViewModel + typed Preload API 与 Main Process 交互。
- 保持现有 CommandService、AlarmEngine、Historian/SQLite、IPC 和 MVVM 边界一致。

**Non-Goals:**

- 不接入企业级身份系统、OAuth、LDAP、AD 或远程权限中心。
- 不实现真实工业安全联锁、Safety PLC、急停链路或生产环境合规审计声明。
- 不提前实现 OPC UA 权限模型、电子签名、双人复核或审批流。
- 不将 Recipe 下载设计成跨 PLC 的分布式事务，也不承诺 PLC 侧自动回滚。
- 不为了本期功能替换现有包管理器、测试框架、SQLite 驱动或 Electron 架构。

## Decisions

### 1. Recipe 领域归 Main Process 管理

RecipeService 运行在 Main Process，负责 Recipe 模型、参数定义、校验、持久化和下载编排。Renderer 只拿 Recipe DTO、校验结果和下载结果，不理解 Modbus 地址、寄存器类型、Function Code 或协议库异常。

Recipe 至少包含 `id`、`name`、`description`、`version`、`parameters`、`createdAt`、`updatedAt`。参数使用稳定 key 表达工艺含义，例如 `targetTemperature`、`rpmSetpoint`、`mixDuration`、`feedDuration`，并由 Main Process 的参数定义绑定到可写 Tag 或命令模板。

第一阶段 Recipe 持久化采用 `recipes.parametersJson` 保存参数快照，外部 API 仍返回强类型 DTO，由 Main Process 负责解析和校验。这样避免为少量固定参数过早拆分复杂表结构，同时保留后续迁移到 `recipe_parameters` 表的空间。

本期只有 `targetTemperature` 和 `rpmSetpoint` 已存在可写 Tag/CommandService 映射。`mixDuration` 与 `feedDuration` 仍作为 Recipe 领域参数进行持久化和范围校验，但不生成下载命令步骤；后续需要 PLC Simulator 增加对应可写点和反馈语义后，再通过新的 OpenSpec change 接入下载计划。

Recipe `version` 使用整数递增：创建为 `1`，每次编辑成功后加 `1`；复制 Recipe 时新 Recipe 从 `1` 开始，并记录源 Recipe 的 `sourceRecipeId` 和 `sourceVersion` 作为 metadata。删除 Recipe 默认采用软删除 `deletedAt`，避免 Audit Log 或历史 Recipe Download 记录引用失效。

备选方案：

- Renderer 本地保存并直接拼写 Tag：拒绝。这样会让 UI 理解设备写入细节，并绕过 Main Process 权限和审计。
- Recipe 直接依赖 ModbusAdapter：拒绝。配方是业务对象，应通过 CommandService 和协议抽象完成写入。

### 2. Recipe 下载采用命令事务编排

RecipeDownloadService 负责把 Recipe 转换为命令计划。计划执行顺序为：

1. 读取 Recipe 和参数定义。
2. 校验类型、范围、必填项和可写 Tag/命令映射。
3. 创建 `downloadId`/correlationId，并预创建审计记录。
4. 生成 Tag Command 步骤。
5. 第一阶段默认按步骤顺序写入，不启用批量写入。
6. 每一步通过 CommandService 执行写入和 read-back/feedback 验证。
7. 汇总每一步结果和整体状态。

整体结果使用明确状态：`Succeeded`、`Rejected`、`PartialFailed`、`Failed`、`TimedOut`、`Cancelled`。步骤结果至少区分 `Skipped`、`Rejected`、`WriteAccepted`、`WriteFailed`、`VerifyFailed`、`Verified`。只要有任一步失败，不得返回整体成功。

本期不做 PLC 侧回滚。原因是已写入 PLC 的参数可能已经产生设备状态变化，HMI 不能假设旧值回写就能恢复业务状态。失败时必须把已成功、已失败、未执行步骤明确返回并写入审计。

备选方案：

- 使用单次多寄存器写入追求速度：本期拒绝。它会弱化每个参数的校验、错误归因和 read-back 结果。后续可在 ProtocolAdapter capability 明确支持时作为受控优化重新设计。
- 实现全量自动回滚：本期拒绝。没有 PLC 配方确认/回滚协议时，自动回写旧值可能制造新的不确定状态。

### 3. 权限校验以 Main Process 为准

UserService 管理本地用户、密码凭据、角色和启用状态。PermissionService 管理角色到权限的映射，并提供统一 `authorize(user, permission, target)` 方法。当前用户会话由 Main Process 维护，Renderer 不能通过请求体伪造角色或权限。

权限矩阵第一期采用静态角色权限：

- Operator：查看设备、执行被标记为允许的 Start/Stop、确认报警、只读查看 Recipe；不允许 Setpoint、Valve、Recipe Download、Tag 配置、用户管理或系统配置。
- Engineer：继承 Operator，允许编辑和下载 Recipe、修改 Setpoint 等允许的工艺参数、执行 Valve 等高级控制、修改 Tag 配置，并可查询 Audit Log。
- Admin：继承 Engineer，允许用户管理和系统配置。

Renderer 可以根据当前用户权限隐藏或禁用按钮，但所有 mutating IPC 都必须在 Main Process 再次校验。未授权请求在调用协议适配器或修改数据库前返回 `Unauthorized`/`Forbidden` 类型结果，并写入审计。

首次启动且用户表为空时，系统进入本地初始化流程，由用户创建第一个 Admin；不内置固定默认密码。密码凭据使用 Node.js 内置 `crypto.scrypt` 或 `crypto.pbkdf2` 加 salt 存储，hash 和 salt 不返回 Renderer。当前登录会话保存在 Main Process 运行期内存中，应用重启后需要重新登录。

备选方案：

- 只在 UI 隐藏按钮：拒绝。用户可以通过 DevTools、恶意 IPC 或未来页面缺陷绕过。
- 把角色判断散落在各服务中：拒绝。应集中到 PermissionService，避免权限规则漂移。

### 4. AuditService 提供统一、持久、追加式审计

AuditService 运行在 Main Process，使用 SQLite repository 写入审计日志。审计记录至少包含 `timestamp`、`user`、`action`、`target`、`oldValue`、`newValue`、`result`。实现可以增加 `id`、`correlationId`、`role`、`durationMs`、`errorSummary`、`metadata` 等字段，但不得记录密码、token 或底层敏感信息。

关键操作执行前先创建 pending 审计记录或确认审计存储可用。若审计预写失败，非紧急 HMI 控制操作应拒绝，不允许产生不可追溯的设备写入。操作完成后更新审计结果；若最终更新失败，业务结果需要包含 audit finalize failure，并写 Application/Error 日志，保留 pending 记录用于后续排查。

`oldValue` 和 `newValue` 由 Main Process 服务生成。Setpoint/Valve 的旧值来自 TagCache 快照或 read-back，用户/Recipe 变更的旧值来自 repository，Renderer 不提供最终审计旧值。

Audit Log 第一阶段不做自动保留期清理或归档，依靠索引、筛选、分页和单次查询上限控制性能与 IPC 负载。

备选方案：

- 只写应用日志文件：拒绝。审计需要结构化查询和重启后持久存在。
- 由 Renderer 写审计：拒绝。Renderer 无法作为可信审计边界。

### 5. CommandService 和 AlarmEngine 接入权限与审计

CommandService 的入口需要接收当前用户上下文或从 Main Process 会话解析当前用户。执行流程调整为：

1. 解析当前用户。
2. 权限校验。
3. 命令定义和值校验。
4. 创建审计记录。
5. 执行协议写入与验证。
6. 更新审计和结构化命令结果。

AlarmEngine 的 acknowledge 入口同样需要当前用户和权限校验。确认成功后，报警 occurrence 的 `acknowledgeUser` 使用当前本地用户，而不是继续使用早期默认 `operator`。未授权确认不得改变报警生命周期状态。

### 6. Renderer 保持 ViewModel 职责

Recipe Management、User Management、Audit Log 页面均采用 View -> ViewModel -> typed Preload API 的方向。ViewModel 负责页面状态、表单草稿、加载/错误状态和结果展示，不负责协议映射、SQLite 查询或权限判定的最终结论。

权限体验分两层：

- Renderer 根据权限 snapshot 控制按钮可见性、禁用状态和导航入口。
- Main Process 对每个 mutating API 做权威校验，并返回结构化拒绝结果。

Audit Log 页面支持筛选和分页，避免一次性通过 IPC 返回无界日志。Recipe 下载结果在页面中以整体状态和步骤明细展示，特别是部分失败、read-back 失败和未执行步骤。

### 7. SQLite schema 幂等迁移

本期沿用现有 SQLite 能力和 repository 边界，不新增生产依赖。新增 schema 初始化必须幂等：

- `recipes`：包含参数 JSON 快照、整数版本、软删除时间和可选复制来源 metadata
- `users`：包含本地用户资料、角色、启用状态、salted credential hash
- `audit_logs`

正常启动不得删除既有 tag history、alarm history、recipes、users 或 audit logs。测试可使用隔离临时数据库。

## Risks / Trade-offs

- [Recipe 部分下载失败导致设备处于中间参数状态] -> 不做静默成功和自动回滚，返回每一步结果，审计已写入/失败/未执行步骤，由操作者决定后续处理。
- [审计预写成功但最终更新失败] -> 保留 pending 记录，业务结果暴露审计完成失败摘要，并写系统错误日志。
- [本地用户系统安全强度有限] -> 明确为本地学习项目能力，使用 Main Process 存储和校验，避免 Renderer 伪造权限；不声明企业级身份安全。
- [权限矩阵后续扩展变复杂] -> 使用 PermissionService 集中维护权限字符串和角色映射，避免散落在页面和服务中。
- [Recipe 参数和 Tag 映射漂移] -> 参数定义集中在 Main Process，下载前检查 Tag 存在、可写、数据类型和范围，避免 UI 自行维护映射。
- [Audit Log 数据增长] -> 本期提供查询分页和索引，不自动清理；后续如需要再增加保留策略。

## Migration Plan

1. 增加幂等 SQLite schema 初始化和 repository。
2. 首次启动用户表为空时进入本地 Admin 初始化流程，不内置固定默认密码，并要求实现文档明确其仅用于本地开发/Simulator 场景。
3. 接入 UserService、PermissionService、AuditService，再扩展 CommandService 和 AlarmEngine。
4. 增加 RecipeService 和 RecipeDownloadService，复用 CommandService 执行实际设备写入。
5. 增加 Preload/IPC DTO 和 Renderer ViewModel/页面。
6. 通过单元测试、Main Process 集成测试和必要 Renderer 测试验证权限、下载失败、审计持久化。

Rollback 策略：本期 schema 只新增表和索引，不删除旧数据；若需要回退代码，旧版本可忽略新增表。不得在正常启动中清空新增表。

## Open Questions

暂无阻塞性开放问题。Recipe 参数范围本期按现有 CommandService 范围和本方案默认范围实现；如 PLC Simulator 后续扩展工艺边界，再通过新的 OpenSpec change 调整。
