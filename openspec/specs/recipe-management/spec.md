# recipe-management Specification

## Purpose
TBD - created by archiving change add-recipe-auth-audit. Update Purpose after archive.
## Requirements
### Requirement: Recipe Domain Model
系统 SHALL 定义工业配方领域模型，用于描述自动化恒温混料设备的可下载工艺参数。

#### Scenario: Recipe contains required fields
- **WHEN** Recipe 被创建、持久化或通过 API 返回
- **THEN** Recipe SHALL 包含 `id`、`name`、`description`、`version`、`parameters`、`createdAt` 和 `updatedAt`
- **AND** `id` SHALL 是稳定唯一标识，不能依赖列表索引

#### Scenario: Recipe parameters contain required process keys
- **WHEN** 默认混料设备 Recipe 参数定义被检查
- **THEN** 参数 SHALL 至少支持 `Target Temperature`、`RPM Setpoint`、`Mix Duration` 和 `Feed Duration`
- **AND** 每个参数 SHALL 有稳定 key、工程单位、数据类型、是否必填和允许范围

#### Scenario: Recipe version changes on edit
- **WHEN** Recipe 的名称、描述或参数被成功编辑
- **THEN** Recipe `version` SHALL 按整数递增
- **AND** `updatedAt` SHALL 更新为本次保存时间

#### Scenario: Recipe starts with version one
- **WHEN** 新 Recipe 被创建
- **THEN** Recipe `version` SHALL 为 `1`
- **AND** 后续编辑 SHALL 在当前整数版本基础上递增

#### Scenario: Recipe model does not imply production deployment
- **WHEN** Recipe 相关文档、UI 文案或测试数据描述系统用途
- **THEN** 系统 SHALL 保持 PLC Simulator/学习项目语境
- **AND** SHALL NOT 暗示该 Recipe 已用于真实生产环境

### Requirement: Recipe CRUD and Load
系统 SHALL 支持 Recipe 新建、编辑、删除、复制、加载和列表查询。

#### Scenario: Engineer creates recipe
- **WHEN** 拥有 Recipe 修改权限的用户提交合法 Recipe 草稿
- **THEN** RecipeService SHALL 创建 Recipe 并持久化
- **AND** 返回包含新 `id`、`version`、`createdAt` 和 `updatedAt` 的 Recipe DTO

#### Scenario: Engineer edits recipe
- **WHEN** 拥有 Recipe 修改权限的用户编辑已存在 Recipe 且参数合法
- **THEN** RecipeService SHALL 保存变更
- **AND** 不得修改其他 Recipe 的参数

#### Scenario: Recipe can be copied
- **WHEN** 用户复制一个已存在 Recipe
- **THEN** 系统 SHALL 创建一个新的 Recipe `id`
- **AND** 新 Recipe SHALL 保留源 Recipe 参数快照并将 `version` 初始化为 `1`
- **AND** 新 Recipe SHALL 记录源 Recipe 的 `sourceRecipeId` 和 `sourceVersion` 或等价 metadata

#### Scenario: Recipe can be deleted
- **WHEN** 拥有 Recipe 修改权限的用户删除未被下载事务占用的 Recipe
- **THEN** RecipeService SHALL 软删除该 Recipe 并记录删除时间
- **AND** 后续列表查询 SHALL 不再把它作为可用 Recipe 返回
- **AND** 历史审计或下载结果仍 SHALL 能引用该 Recipe 的历史标识和摘要

#### Scenario: Recipe can be loaded for review
- **WHEN** 用户加载一个 Recipe
- **THEN** Renderer SHALL 显示该 Recipe 的名称、描述、版本和参数
- **AND** 加载 Recipe SHALL NOT 自动写入设备

### Requirement: Recipe Parameter Validation
系统 SHALL 在保存和下载 Recipe 前执行参数校验。

#### Scenario: Required recipe parameter cannot be missing
- **WHEN** Recipe 缺少 `Target Temperature`、`RPM Setpoint`、`Mix Duration` 或 `Feed Duration`
- **THEN** RecipeService SHALL 拒绝保存或下载
- **AND** 结果 SHALL 指明缺失参数

#### Scenario: Target temperature range is enforced
- **WHEN** Recipe 的 `Target Temperature` 低于 `20.0°C` 或高于 `90.0°C`
- **THEN** RecipeService SHALL 判定参数非法
- **AND** Recipe 下载 SHALL 在调用 CommandService 或协议适配器前被拒绝

#### Scenario: RPM setpoint range is enforced
- **WHEN** Recipe 的 `RPM Setpoint` 低于 `0` 或高于 `1800 rpm`
- **THEN** RecipeService SHALL 判定参数非法
- **AND** Recipe 下载 SHALL 在调用 CommandService 或协议适配器前被拒绝

#### Scenario: Duration ranges are enforced
- **WHEN** Recipe 的 `Mix Duration` 小于 `1s` 或大于 `3600s`，或 `Feed Duration` 小于 `1s` 或大于 `1800s`
- **THEN** RecipeService SHALL 判定参数非法
- **AND** 结果 SHALL 指明具体非法参数和允许范围

#### Scenario: Invalid parameter type is rejected
- **WHEN** Recipe 参数值的数据类型与参数定义不一致
- **THEN** RecipeService SHALL 拒绝该 Recipe 保存或下载
- **AND** SHALL NOT 静默转换为可能改变工程含义的值

### Requirement: Recipe Download Planning
系统 SHALL 将合法 Recipe 转换为受控 Tag Command 下载计划。

#### Scenario: Recipe download validates before planning
- **WHEN** 用户请求下载 Recipe 到设备
- **THEN** RecipeDownloadService SHALL 先执行 Recipe 参数校验、用户权限校验和设备状态检查
- **AND** 任一检查失败 SHALL 阻止命令计划执行

#### Scenario: Recipe parameters map to command steps
- **WHEN** Recipe 参数校验通过
- **THEN** RecipeDownloadService SHALL 将具备命令映射的参数转换为明确的 Tag Command 步骤
- **AND** 每一步 SHALL 包含参数 key、目标 Tag 或命令定义、工程值、超时和验证策略
- **AND** `mixDuration` 与 `feedDuration` SHALL 在本期被校验和持久化，但在 PLC Simulator 提供可写点和反馈语义前 SHALL NOT 被静默伪造成下载命令步骤

#### Scenario: Recipe download uses sequential plan by default
- **WHEN** RecipeDownloadService 生成本期下载计划
- **THEN** 命令步骤 SHALL 默认按顺序执行
- **AND** 本期 SHALL NOT 将批量写入作为默认 Recipe 下载执行策略

#### Scenario: Renderer does not build download command plan
- **WHEN** Renderer 发起 Recipe 下载
- **THEN** Renderer SHALL 只提交 Recipe `id` 或受控 DTO
- **AND** SHALL NOT 构造 Modbus 地址、Function Code、协议请求或 CommandService 内部命令计划

#### Scenario: Disconnected device rejects recipe download
- **WHEN** 目标设备处于 `Disconnected`、`Reconnecting` 或 `Fault`
- **THEN** RecipeDownloadService SHALL 拒绝 Recipe 下载
- **AND** 结果 SHALL 标识为设备状态不允许，而不是通信写入失败

### Requirement: Recipe Download Execution and Result
系统 SHALL 执行 Recipe 下载并返回整体和逐步结果。

#### Scenario: Successful recipe download reports verified result
- **WHEN** Recipe 所有命令步骤均写入成功并通过 read-back 或 feedback 验证
- **THEN** Recipe 下载结果 SHALL 为 `Succeeded`
- **AND** 每个步骤 SHALL 返回 `Verified` 状态、目标、请求值、验证值和耗时

#### Scenario: Partial recipe download failure is explicit
- **WHEN** Recipe 下载过程中部分命令步骤失败或验证失败
- **THEN** Recipe 下载结果 SHALL 为 `PartialFailed` 或 `Failed`
- **AND** 结果 SHALL 明确列出已成功、已失败和未执行的步骤
- **AND** 系统 SHALL NOT 把部分成功静默报告为整体成功

#### Scenario: Automatic rollback is not performed
- **WHEN** Recipe 下载出现部分失败
- **THEN** 系统 SHALL NOT 无依据自动回写旧值作为回滚
- **AND** 结果 SHALL 明确提示设备可能处于部分参数已写入状态

#### Scenario: Read-back mismatch is not success
- **WHEN** Recipe 参数写入被协议接受但 read-back 值与请求工程值不匹配
- **THEN** 对应步骤 SHALL 为 `VerifyFailed`
- **AND** 整体 Recipe 下载 SHALL NOT 为 `Succeeded`

#### Scenario: Recipe download respects command concurrency
- **WHEN** Recipe 下载正在对某设备执行命令步骤
- **THEN** 系统 SHALL 遵守该设备现有 CommandService 并发限制
- **AND** SHALL NOT 绕过每设备受控写入和验证边界

#### Scenario: Recipe download resources are cleaned up
- **WHEN** Recipe 下载成功、失败、超时或被设备断开中断
- **THEN** RecipeDownloadService SHALL 释放相关 pending 状态、定时器和监听器
- **AND** 后续下载请求 SHALL 不受遗留事务状态影响

### Requirement: Recipe Management Renderer Experience
Renderer SHALL 提供 Recipe Management 页面，并保持 MVVM 和 typed IPC 边界。

#### Scenario: Recipe page lists recipes
- **WHEN** Recipe Management 页面初始化
- **THEN** RecipeViewModel SHALL 通过 typed Preload API 查询 Recipe 列表
- **AND** React View SHALL NOT 直接访问 SQLite、Node.js API、CommandService 或协议适配器

#### Scenario: Recipe page displays validation errors
- **WHEN** Recipe 保存或下载因参数非法被拒绝
- **THEN** RecipeViewModel SHALL 暴露字段级或步骤级错误状态
- **AND** View SHALL 展示可理解的业务错误，不暴露底层协议异常

#### Scenario: Recipe download result is visible
- **WHEN** Recipe 下载完成且结果为 `Succeeded`、`Rejected`、`PartialFailed`、`Failed` 或 `TimedOut`
- **THEN** Recipe Management 页面 SHALL 显示整体状态和步骤明细
- **AND** 用户 SHALL 能区分参数非法、权限拒绝、通信失败和 read-back 失败

