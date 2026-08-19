## ADDED Requirements

### Requirement: Local User Domain Model
系统 SHALL 提供本地用户领域模型，用于标识 HMI 操作者和授权关键操作。

#### Scenario: User contains required fields
- **WHEN** 用户被创建、持久化或通过 Main Process 服务读取
- **THEN** User SHALL 至少包含 `id`、`username`、`displayName`、`role`、`enabled`、`createdAt` 和 `updatedAt`
- **AND** `role` SHALL 只能是 `Operator`、`Engineer` 或 `Admin`

#### Scenario: Password credential is not exposed to Renderer
- **WHEN** Renderer 查询当前用户、用户列表或用户详情
- **THEN** 返回 DTO SHALL NOT 包含密码、密码哈希、salt 或等价凭据
- **AND** 凭据校验 SHALL 保持在 Main Process

#### Scenario: Password credential is stored as salted hash
- **WHEN** 本地用户凭据被创建或更新
- **THEN** UserService SHALL 使用 Node.js 内置 `crypto.scrypt`、`crypto.pbkdf2` 或等价 salted hash 机制保存凭据
- **AND** SHALL NOT 以明文形式持久化密码

#### Scenario: Disabled user cannot operate
- **WHEN** `enabled` 为 `false` 的用户尝试登录或执行受保护操作
- **THEN** UserService 或 PermissionService SHALL 拒绝该请求
- **AND** 受保护操作 SHALL NOT 修改设备、Recipe、报警、用户或配置状态

### Requirement: Local Authentication and Session
系统 SHALL 在 Main Process 管理本地登录会话和当前用户身份。

#### Scenario: User logs in locally
- **WHEN** 用户提交本地用户名和密码
- **THEN** UserService SHALL 在 Main Process 校验凭据
- **AND** 成功后 SHALL 建立当前用户会话并返回不含凭据的用户 DTO

#### Scenario: Current user is resolved in Main Process
- **WHEN** Renderer 调用受保护 typed Preload API
- **THEN** Main Process SHALL 从受控会话解析当前用户
- **AND** SHALL NOT 信任 Renderer 请求体中自称的角色或权限

#### Scenario: First run initializes admin without fixed password
- **WHEN** 应用启动且本地用户表为空
- **THEN** 系统 SHALL 进入本地初始化流程，由用户创建第一个 Admin
- **AND** SHALL NOT 内置固定默认 Admin 密码
- **AND** 该流程 SHALL 明确属于本地开发和 PLC Simulator 场景

#### Scenario: Session is runtime local
- **WHEN** 用户成功登录
- **THEN** 当前用户会话 SHALL 保存在 Main Process 运行期会话状态
- **AND** 应用重启后 SHALL 要求用户重新登录

#### Scenario: OS username is not used as authorization
- **WHEN** 系统需要判断当前 HMI 用户权限
- **THEN** SHALL 使用本地用户会话
- **AND** SHALL NOT 仅根据操作系统用户名授予角色或权限

### Requirement: Role Permission Matrix
系统 SHALL 定义 Operator、Engineer、Admin 的角色权限矩阵。

#### Scenario: Operator permissions are limited
- **WHEN** 用户角色为 `Operator`
- **THEN** 该用户 SHALL 可以查看设备、执行被标记为 Operator 允许的启停命令、确认报警和只读查看 Recipe
- **AND** SHALL NOT 修改 Recipe、下载 Recipe、修改受限参数、修改 Tag 配置、管理用户或修改系统配置

#### Scenario: Engineer inherits operator permissions
- **WHEN** 用户角色为 `Engineer`
- **THEN** 该用户 SHALL 拥有 Operator 权限
- **AND** SHALL 可以修改 Recipe、下载 Recipe、修改允许的工艺参数、执行高级控制、修改 Tag 配置和查询 Audit Log

#### Scenario: Admin inherits engineer permissions
- **WHEN** 用户角色为 `Admin`
- **THEN** 该用户 SHALL 拥有 Engineer 权限
- **AND** SHALL 可以管理用户和修改系统配置

#### Scenario: Permission names are explicit
- **WHEN** PermissionService 检查权限
- **THEN** SHALL 使用明确权限标识，例如 `device:view`、`device:start-stop`、`device:advanced-control`、`alarm:acknowledge`、`recipe:read`、`recipe:write`、`recipe:download`、`parameter:write`、`tag-config:write`、`audit:read`、`user:manage` 和 `system-config:write`
- **AND** SHALL NOT 使用多个分散 boolean 隐式表达复杂授权规则

### Requirement: Main Process Permission Enforcement
系统 SHALL 在 Main Process 对所有受保护操作执行权威权限校验。

#### Scenario: Unauthorized recipe edit is rejected
- **WHEN** Operator 尝试创建、编辑、删除或复制 Recipe
- **THEN** Main Process SHALL 返回未授权或禁止结果
- **AND** Recipe repository SHALL NOT 被修改

#### Scenario: Unauthorized recipe download is rejected
- **WHEN** Operator 尝试下载 Recipe 到设备
- **THEN** Main Process SHALL 在调用 CommandService 或协议适配器前拒绝请求
- **AND** 结果 SHALL 表明缺少 `recipe:download` 权限

#### Scenario: Unauthorized restricted configuration is rejected
- **WHEN** Operator 尝试修改 Tag 配置、用户配置或系统配置
- **THEN** Main Process SHALL 拒绝请求
- **AND** SHALL NOT 依赖 Renderer 隐藏按钮作为唯一保护

#### Scenario: Authorized engineer can manage recipes
- **WHEN** Engineer 创建、编辑、复制或下载合法 Recipe
- **THEN** PermissionService SHALL 授权该请求
- **AND** 后续业务校验和命令验证仍 SHALL 正常执行

#### Scenario: Admin-only user management is enforced
- **WHEN** 非 Admin 用户尝试创建、禁用、改角色或重置本地用户凭据
- **THEN** UserService SHALL 拒绝请求
- **AND** 用户数据 SHALL NOT 被修改

### Requirement: Renderer Permission Experience
Renderer SHALL 使用权限快照优化界面体验，但不得成为最终授权边界。

#### Scenario: Renderer receives current permission snapshot
- **WHEN** Renderer 初始化或当前用户变化
- **THEN** 它 SHALL 通过 typed Preload API 获取当前用户和权限快照
- **AND** 该快照 SHALL 只用于导航、按钮状态和表单入口展示

#### Scenario: Hidden button is not the only control
- **WHEN** 用户没有某项权限
- **THEN** Renderer MAY 隐藏或禁用相关入口
- **AND** Main Process 仍 SHALL 在 API 调用时独立校验权限

#### Scenario: User management page is admin guarded
- **WHEN** 非 Admin 用户打开或调用 User Management 功能
- **THEN** Renderer SHALL 显示无权限状态或移除入口
- **AND** Main Process SHALL 拒绝对应用户管理 API

#### Scenario: Renderer stays inside MVVM boundaries
- **WHEN** 权限相关 Renderer 代码被检查
- **THEN** React View SHALL 通过 ViewModel 使用 typed Preload API
- **AND** SHALL NOT 导入 Main Process 服务、SQLite、Node.js API、CommandService 或 PermissionService 实例

### Requirement: User Management
系统 SHALL 提供 Admin 管理本地用户的能力。

#### Scenario: Admin creates local user
- **WHEN** Admin 提交合法用户名、显示名、角色和初始凭据
- **THEN** UserService SHALL 创建本地用户
- **AND** 新用户 SHALL 在后续用户列表中可见

#### Scenario: Admin changes user role
- **WHEN** Admin 修改某个用户角色
- **THEN** UserService SHALL 持久化新的 `role`
- **AND** 该用户后续权限 SHALL 按新角色计算

#### Scenario: Admin disables user
- **WHEN** Admin 禁用某个用户
- **THEN** UserService SHALL 将 `enabled` 更新为 `false`
- **AND** 该用户后续 SHALL 无法登录或执行受保护操作

#### Scenario: User changes survive restart
- **WHEN** 本地用户被创建、修改或禁用后应用重启
- **THEN** UserService SHALL 从 SQLite 返回重启前持久化的用户状态
