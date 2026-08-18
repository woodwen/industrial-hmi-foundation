# M-12(feat): 新增配方权限审计能力

OpenSpec Change: add-recipe-auth-audit

## 背景:

- 工业 HMI 需要补齐 Recipe、User Permission 和 Audit Log 能力，使关键控制操作不再只依赖 Renderer 按钮显隐。
- Recipe 下载必须明确校验、写入、read-back 和结果汇总，不能在部分写入失败时静默视为成功。
- 本项目仍面向本地开发与 PLC Simulator 场景，不表示已经用于真实生产环境。

## 方案概述:

- 在 Main Process 增加 Recipe、User、Permission、Audit 领域服务和 SQLite repository。
- 扩展 CommandService 与 Alarm Acknowledge，让关键写操作使用当前 Main 会话做权限校验并写入 Audit Log。
- 新增 typed IPC / Preload API 和 Renderer MVVM 页面，Renderer 只按权限快照控制导航和按钮状态，最终授权仍由 Main 执行。
- OpenSpec 已归档到 `openspec/changes/archive/2026-08-18-add-recipe-auth-audit`，并同步主 specs。

## 实现改动:

- 新增 `recipes`、`users`、`audit_logs` SQLite schema，支持 Recipe 软删除、版本递增、复制来源 metadata 和 Audit Log 重启后查询。
- 新增本地用户初始化、登录、用户管理、角色权限矩阵和运行期会话；密码使用 Node.js 内置 salted hash。
- 新增 Recipe CRUD、复制、下载事务，下载时顺序执行 Tag Command、复用 CommandService 验证并返回步骤明细。
- 新增 AuditService pending/finalize/分页查询，并过滤 `password`、`credentialHash`、`credentialSalt`、`salt`、`token` 等敏感字段。
- 新增 Recipe Management、User Management、Audit Log 页面及 ViewModel，并扩展导航权限控制。
- 更新开发文档 `docs/recipe-auth-audit.md` 和 `CHANGELOG.md`。

## 测试计划(UT):

- `yarn typecheck`
- `yarn lint`
- `yarn test`
- `yarn build`
- `openspec validate add-recipe-auth-audit --strict`
- `openspec validate --all --strict`
- `git diff --check`

## 影响范围(建议手动测试范围):

- 首次启动 Admin 初始化、登录、退出和重启后重新登录。
- Operator / Engineer / Admin 三类角色下导航和受限按钮状态。
- Operator 无法修改受限配置，Engineer 可以编辑和下载 Recipe。
- 非法 Recipe 参数下载失败且不写设备。
- Recipe 下载部分失败时步骤明细和 Audit Log 是否清晰。
- Start / Stop / Setpoint / Valve / Alarm Acknowledge / 用户配置修改的 Audit Log 持久化查询。

## 验收标准:

- Operator 不能修改受限配置。
- Engineer 可以编辑和下载 Recipe。
- Recipe 非法参数无法下载。
- Recipe 下载失败有明确结果。
- 关键 Command 都有 Audit Log。
- 重启以后 Audit Log 仍然存在。

## 风险与后续:

- 本期 Recipe Download 默认顺序写入 `targetTemperature` 和 `rpmSetpoint`，`mixDuration` 与 `feedDuration` 先作为配方参数持久化和校验。
- 本期不做自动回滚和 Audit Log 自动清理；后续可根据 PLC 支持增加下载取消、批量写入和保留策略。
