## Why

当前 HMI 已具备设备监控、控制、报警、历史与趋势基础能力，但缺少工业配方、明确的本地用户权限和关键操作审计。随着控制操作从演示级按钮扩展到可配置参数和配方下载，系统需要在 Main Process 侧建立权限校验和可追溯记录，避免仅依赖 Renderer 隐藏按钮来保护关键操作。

## What Changes

- 新增 Recipe 领域能力，支持配方新建、编辑、删除、复制、加载和下载到设备。
- 新增 Recipe 参数模型，至少覆盖 `Target Temperature`、`RPM Setpoint`、`Mix Duration`、`Feed Duration`，并在下载前执行工程范围和类型校验。
- 新增 Recipe 下载事务流程：Recipe -> 参数校验 -> 将已映射参数转换 Tag Commands -> 顺序写入 -> read-back -> 结果汇总；批量写入不作为本期默认路径。
- 新增本地用户系统，支持 `Operator`、`Engineer`、`Admin` 三类角色和权限矩阵；首次启动通过本地初始化流程创建 Admin，不内置固定默认密码。
- 新增 Main Process 权限校验，关键命令、Recipe 修改/下载、报警确认、用户/配置修改不得只依赖 UI 隐藏或禁用。
- 新增 SQLite 持久化 Audit Log，记录关键工业控制操作和配置变更，重启后仍可查询。
- 新增 Renderer 页面：Recipe Management、User Management、Audit Log；页面通过 ViewModel 和 typed Preload API 使用 Main Process 服务。
- 扩展现有 CommandService 行为，使 Start、Stop、Setpoint 修改、Valve 操作等关键 Command 带用户上下文、权限校验和审计结果。
- 扩展现有 Alarm Acknowledge 行为，使报警确认使用当前本地用户、执行权限校验并写入审计记录。

## Capabilities

### New Capabilities
- `recipe-management`: 管理工业配方模型、参数校验、加载状态和配方下载到设备的结果汇总。
- `local-user-permission`: 管理本地用户、角色、权限矩阵、当前用户会话，以及 Main/Renderer 双层权限职责。
- `audit-log`: 记录、持久化和查询关键工业控制操作、Recipe 操作、报警确认、用户与配置修改审计日志。

### Modified Capabilities
- `device-control-resilience`: 关键 Command 增加用户上下文、Main Process 权限校验和审计写入要求。
- `alarm-management`: 报警确认增加当前用户权限校验和审计写入要求。

## Impact

- Main Process：新增 RecipeService、UserService/PermissionService、AuditService、相关 SQLite repository，并扩展 CommandService 与 AlarmEngine 调用链。
- Preload/IPC：新增 Recipe、User、Audit typed API；扩展现有 command/alarm API 请求上下文，避免暴露通用 IPC 或底层基础设施。
- Renderer：新增 Recipe Management、User Management、Audit Log 页面及 ViewModel；已有控制和报警页面根据权限展示可用操作，但不承担最终授权。
- 数据库：在现有 SQLite 数据库中新增 recipes、users、audit_logs 等持久化表；Recipe 参数第一阶段使用受控 JSON 快照存储并支持软删除；初始化必须幂等，不得清空既有历史、报警、Recipe、用户或审计数据。
- 测试：新增 Recipe 校验与下载事务、权限矩阵、Command/Alarm 审计、审计持久化重启查询、Renderer 边界和权限 UI 状态测试。
