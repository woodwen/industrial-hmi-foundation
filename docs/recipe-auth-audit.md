# Recipe、权限与审计

本功能面向本地开发和 PLC Simulator 场景，不表示系统已经用于真实生产环境。

## 本地用户

- 首次启动如果 `users` 表为空，Renderer 通过 Topbar 初始化本地 Admin。
- 系统不内置固定默认密码，Admin 密码由初始化时输入。
- 密码只在 Main Process 使用 Node.js 内置 `crypto.scryptSync` 加盐哈希保存，不返回 Renderer。
- 当前用户会话只保存在 Main Process 内存中，应用重启后需要重新登录。

角色权限矩阵：

- `Operator`：查看设备、执行 Start/Stop、确认报警、查看 Recipe。
- `Engineer`：包含 Operator 权限，并可修改 Recipe、下载 Recipe、修改 Setpoint、操作阀门、修改 Tag 配置、读取 Audit Log。
- `Admin`：包含 Engineer 权限，并可管理用户和系统配置。

Renderer 可以根据权限隐藏导航或禁用按钮，但这不是安全边界。Main Process 的 `PermissionService`、`CommandService`、`RecipeService`、用户管理和审计查询入口仍必须重新校验当前会话。

## Recipe

Recipe 是 Main Process 的领域对象，字段包括：

- `id`
- `name`
- `description`
- `version`
- `parameters`
- `createdAt`
- `updatedAt`

本期参数固定为：

- `targetTemperature`：20-90 °C
- `rpmSetpoint`：0-1800 rpm
- `mixDuration`：1-3600 s
- `feedDuration`：1-1800 s

Recipe 使用 SQLite 持久化，参数保存为 `parameters_json`，版本使用整数递增，删除使用软删除。复制 Recipe 时记录来源 `source_recipe_id` 和 `source_version`。

Recipe Download 流程：

```text
Recipe
↓
Validate
↓
Generate Commands
↓
Sequential CommandService writes
↓
Read-back / feedback verification
↓
Result summary
```

本期默认顺序写入 `targetTemperature` 和 `rpmSetpoint`，`mixDuration` 与 `feedDuration` 先作为持久化和校验参数保留。下载失败时返回整体状态和步骤明细，可能出现 `Succeeded`、`Rejected`、`PartialFailed`、`Failed`、`TimedOut`、`Cancelled`。部分失败不会静默标记成功，也不做无 PLC 支持依据的自动回滚。

## Audit Log

Audit Log 持久化到 SQLite `audit_logs` 表，应用重启后仍可查询。本期不做自动清理。

记录字段包括：

- `timestamp`
- `user`
- `action`
- `target`
- `oldValue`
- `newValue`
- `result`

关键操作需要审计：

- Start / Stop
- Setpoint 修改
- Valve 操作
- Recipe Download
- Alarm Acknowledge
- 用户和配置修改

关键 HMI 写设备操作采用 pending 审计：如果创建 pending 审计失败，CommandService 拒绝继续写设备。审计值会过滤 `password`、`credentialHash`、`credentialSalt`、`salt`、`token` 等敏感字段。
