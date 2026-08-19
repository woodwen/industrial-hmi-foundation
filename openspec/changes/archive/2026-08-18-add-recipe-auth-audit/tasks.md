## 1. 基础梳理与数据存储

- [x] 1.1 梳理现有 CommandService、AlarmEngine、Historian/SQLite、Preload API、Renderer ViewModel 和页面结构，确认接入点和边界测试位置
- [x] 1.2 设计并实现 SQLite 幂等 schema 初始化，新增 `recipes`、`users`、`audit_logs` 及必要索引；Recipe 使用 `parametersJson`、整数版本、软删除和复制来源 metadata，不删除既有历史和报警数据
- [x] 1.3 为 Recipe、User、Permission、Audit 定义 Main Process 领域类型、DTO 和 repository 接口，避免 Renderer 依赖 SQLite 或 Node.js API
- [x] 1.4 为新增 repository 增加临时数据库测试，覆盖初始化重复执行和重启后数据仍可查询

## 2. 本地用户与权限

- [x] 2.1 实现 UserService，支持本地用户创建、查询、更新角色、禁用和凭据校验；凭据使用 Node.js 内置 salted hash，不返回 Renderer
- [x] 2.2 实现首次启动本地 Admin 初始化流程，不内置固定默认密码，并在开发文档中说明其仅用于本地开发和 PLC Simulator 场景
- [x] 2.3 实现 PermissionService，定义 `Operator`、`Engineer`、`Admin` 的权限矩阵和 `authorize(user, permission, target)` 入口；Engineer/Admin 可读 Audit Log
- [x] 2.4 实现 Main Process 运行期当前用户会话解析，应用重启后要求重新登录，且受保护 IPC 不信任 Renderer 传入的角色或权限
- [x] 2.5 实现 User Management 相关 Main API，强制 Admin-only 用户管理权限
- [x] 2.6 增加用户和权限单元测试，覆盖 Operator 不能修改受限配置、Engineer 可管理 Recipe、Admin 可管理用户、禁用用户不可操作

## 3. 审计服务

- [x] 3.1 实现 AuditService 和 AuditRepository，支持创建 pending 审计、最终结果更新、追加记录和分页查询
- [x] 3.2 定义审计 action、target、result、oldValue/newValue 序列化规则，过滤密码、哈希、salt、token 等敏感值
- [x] 3.3 实现审计预写失败处理，关键 HMI 写设备操作在无法创建审计记录时应拒绝执行
- [x] 3.4 实现 Audit Log 查询 API，支持时间范围、用户、动作、目标和结果筛选，并通过索引、分页和单次返回上限控制查询成本；本期不做自动清理
- [x] 3.5 增加审计持久化测试，覆盖关键操作写入后应用重启仍可查询

## 4. CommandService 与 AlarmEngine 接入

- [x] 4.1 扩展 CommandService 命令入口，接收或解析当前用户上下文，并在命令校验前执行权限校验
- [x] 4.2 为 Start、Stop、Setpoint 修改、RPM Setpoint 修改、Inlet Valve、Outlet Valve 定义所需权限和 Operator 可执行命令范围
- [x] 4.3 在 CommandService 中接入 AuditService，记录授权成功、权限拒绝、验证失败、通信失败、超时和成功结果
- [x] 4.4 扩展命令结果 DTO，使 Renderer 能区分权限拒绝、参数校验失败、通信失败、read-back 失败、超时和审计失败
- [x] 4.5 扩展 Alarm Acknowledge 入口，使用当前本地用户执行权限校验，并将 `acknowledgeUser` 写为当前用户
- [x] 4.6 为 Alarm Acknowledge 写入 Audit Log，覆盖成功和权限拒绝场景
- [x] 4.7 增加 CommandService 和 AlarmEngine 测试，覆盖未授权不写协议、关键 Command 都有审计、报警确认未授权不改变生命周期

## 5. Recipe 领域与下载事务

- [x] 5.1 实现 Recipe 参数定义，覆盖 `Target Temperature`、`RPM Setpoint`、`Mix Duration`、`Feed Duration` 的类型、单位、必填和范围
- [x] 5.2 实现 RecipeService CRUD、复制、加载、整数版本递增、软删除和复制来源 metadata，并在修改类操作中执行权限校验和审计
- [x] 5.3 实现 Recipe 参数保存前和下载前校验，非法参数应返回字段级错误且不得调用 CommandService
- [x] 5.4 实现 RecipeDownloadService，将具备命令映射的 Recipe 参数转换为顺序 Tag Command 步骤并复用 CommandService 执行写入和 read-back/feedback 验证，本期不默认启用批量写入
- [x] 5.5 实现 Recipe 下载整体结果和步骤结果汇总，覆盖 `Succeeded`、`Rejected`、`PartialFailed`、`Failed`、`TimedOut`、`Cancelled`
- [x] 5.6 确保 Recipe 下载失败时明确列出已成功、已失败和未执行步骤，不做静默成功或无依据自动回滚
- [x] 5.7 增加 Recipe 单元和集成测试，覆盖 Engineer 可编辑下载、Operator 不能下载、非法参数无法下载、read-back 失败产生明确结果、部分失败有步骤明细

## 6. Preload、IPC 与 Renderer 页面

- [x] 6.1 新增 typed Preload API 和 Main IPC handler，覆盖当前用户/权限、Recipe、User Management、Audit Log，并保持最小 API 暴露
- [x] 6.2 扩展现有 command 和 alarm typed API，使请求走 Main Process 当前用户会话和结构化结果，不暴露通用 IPC 或底层服务
- [x] 6.3 实现 Recipe Management ViewModel 和页面，支持列表、新建、编辑、删除、复制、加载、下载和下载结果明细展示
- [x] 6.4 实现 User Management ViewModel 和页面，仅 Admin 可访问用户创建、角色修改、禁用等入口
- [x] 6.5 实现 Audit Log ViewModel 和页面，支持筛选、分页、空状态和 Recipe Download 步骤摘要展示
- [x] 6.6 在 Renderer 根据权限快照控制导航和按钮状态，同时确保无权限 API 调用仍由 Main Process 拒绝
- [x] 6.7 增加 Renderer/MVVM 边界测试或静态检查，确认页面不导入 Main Process、SQLite、Node.js API、CommandService、AlarmEngine 或协议适配器

## 7. 文档、验证与收尾

- [x] 7.1 更新相关开发文档，说明本地用户初始化无固定密码、运行期会话、权限矩阵、Recipe 下载结果语义、软删除和 Audit Log 持久化边界
- [x] 7.2 执行 TypeScript 类型检查，修复新增 DTO、IPC 和服务类型问题
- [x] 7.3 执行 lint，修复格式、未使用代码和边界导入问题
- [x] 7.4 执行测试，覆盖新增用户权限、Recipe、Command、Alarm、Audit 和 Renderer 状态用例
- [x] 7.5 执行构建，确认 Electron Main/Preload/Renderer 均可打包通过
- [x] 7.6 执行 `openspec validate add-recipe-auth-audit --strict` 和 `openspec validate --all --strict`
- [x] 7.7 执行 `git diff --check`，确认无空白错误
