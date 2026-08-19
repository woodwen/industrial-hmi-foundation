## ADDED Requirements

### Requirement: Juejin Promotion Article
项目 SHALL 提供一篇面向掘金发布的中文推广文章，用于介绍 Industrial HMI Foundation 的学习价值、工程架构和当前可演示能力。

#### Scenario: 掘金文章草稿存在
- **WHEN** 读者查看项目文档
- **THEN** 项目 SHALL 提供 `docs/articles/juejin-industrial-hmi-foundation.md`
- **AND** 文章 SHALL 使用中文 Markdown 编写
- **AND** 文章 SHALL 使用 `用 Electron + React 做一个工业 HMI 学习项目：从 Modbus/OPC UA 到报警、趋势和配方` 作为主标题
- **AND** 文章 SHALL 可以脱离应用运行环境阅读

#### Scenario: 掘金文章覆盖项目核心价值
- **WHEN** 读者阅读掘金文章
- **THEN** 文章 SHALL 说明本项目是基于 Electron、React、TypeScript、MobX 和 MVVM 的工业 HMI 学习、模拟和工程实践项目
- **AND** 文章 SHALL 说明当前业务场景是自动化恒温混料设备监控与控制系统
- **AND** 文章 SHALL 介绍 Main / Preload / Renderer 进程边界和 typed IPC
- **AND** 文章 SHALL 介绍 Modbus TCP polling / batching、OPC UA subscription、ProtocolAdapter、Tag、Quality、timestamp 和 TagCache
- **AND** 文章 SHALL 介绍 Device State、CommandService、Alarm、Historian、Trend、Recipe、Permission 和 Audit 的工程意义

#### Scenario: 掘金文章提供运行和演示路径
- **WHEN** 读者希望本地运行项目
- **THEN** 文章 SHALL 提供最小运行步骤
- **AND** 文章 SHALL 说明普通演示路径是启动应用、在 Settings 中启动 Simulator、再到 Device 页面 Connect
- **AND** 文章 SHALL 保留维护者脚本路径，例如 `yarn simulator:start` 和 `yarn simulator:opcua:start`
- **AND** 文章 SHALL 提供 Dashboard、Device、Alarm、Trend、Recipe 和 Audit 的建议演示顺序

#### Scenario: 掘金文章使用仓库内截图素材
- **WHEN** 文章引用用户提供的界面截图
- **THEN** 截图素材 SHALL 存放在 `docs/assets/juejin/`
- **AND** 图片文件名 SHALL 使用稳定 ASCII 名称，包括 `dashboard-logged-out.png`、`dashboard-logged-in.png`、`device-disconnected.png`、`device-connected.png`、`alarm-history.png`、`trend-realtime.png`、`recipe-management.png`、`audit-log.png`、`user-management.png`、`tag-management.png` 和 `settings-simulator.png`
- **AND** 文章 SHALL 使用仓库相对路径引用图片
- **AND** 文章、README 和使用手册 SHALL NOT 引用 `/Users/mac/Downloads` 或其他用户本机绝对截图路径

#### Scenario: 掘金文章保持真实边界
- **WHEN** 文章描述工业 HMI、协议、控制、报警、趋势、配方、权限或审计能力
- **THEN** 文章 SHALL 明确当前项目面向本地 Simulator、学习、模拟、测试和面试展示
- **AND** 文章 SHALL NOT 暗示系统已经应用于真实生产现场
- **AND** 文章 SHALL NOT 声称提供 Safety PLC、安全继电器、硬件联锁、急停、SIL、生产认证、现场网络安全合规或生产 OPC UA security profile
- **AND** 文章 SHALL NOT 把 Modbus RTU runtime 描述为当前已实现能力
- **AND** 文章 SHALL NOT 写入未经脚本或实际报告验证的固定性能数字、客户案例、下载量或项目 Star 数

## MODIFIED Requirements

### Requirement: Repository README
项目 SHALL 在根目录提供 `README.md`，使新读者可以理解、运行、验证、演示和继续阅读当前工业 HMI 模拟应用。

#### Scenario: 读者查看 README
- **WHEN** 读者打开根目录 `README.md`
- **THEN** README SHALL 至少包含项目介绍、Architecture、Technology Stack、工业通信架构、Modbus Mapping、Tag Model、Polling Architecture、Device State Machine、Alarm Lifecycle、Historian、Recipe、OPC UA、如何运行 Simulator、Demo 步骤、Testing 和 Known Limitations
- **AND** README SHALL 描述当前项目的主要运行命令、测试命令、目录结构、架构边界、帮助入口、更新检查和打包发布流程
- **AND** README SHALL 提供 `docs/project-manual.md` 项目说明书入口
- **AND** README SHALL 说明项目说明书也可以从应用 Help 入口离线查看
- **AND** README SHALL 提供 `docs/articles/juejin-industrial-hmi-foundation.md` 掘金推广文章草稿入口

#### Scenario: README 说明 Simulator 使用入口
- **WHEN** README 描述如何运行 Simulator
- **THEN** README SHALL 将应用内启动 Modbus TCP / OPC UA Simulator 作为普通演示路径
- **AND** README SHALL 保留 `yarn simulator:start` 和 `yarn simulator:opcua:start` 作为维护者、自动化测试和独立协议验证路径
- **AND** README SHALL 明确启动 Simulator 不等于连接设备，设备连接仍由应用内 DeviceManager 流程完成

#### Scenario: README 说明业务边界
- **WHEN** README 描述工业 HMI 能力
- **THEN** README SHALL 明确当前项目是工业自动化学习、模拟和工程实践项目
- **AND** README SHALL 明确它不代表真实生产现场 Safety System，不替代 Safety PLC、硬件联锁、急停、工业网络安全或现场认证流程

#### Scenario: README 描述协议能力
- **WHEN** README 描述工业通信架构
- **THEN** README SHALL 说明 Modbus TCP 使用 polling 和地址批量读取
- **AND** README SHALL 说明 OPC UA 优先使用 subscription 和 monitored item notification
- **AND** README SHALL 说明 Modbus TCP 是默认协议，OPC UA 是可选协议配置
- **AND** README SHALL 说明 OPC UA Simulator 默认 endpoint 为 `opc.tcp://127.0.0.1:4840/industrial-hmi-simulator`
- **AND** README SHALL 说明 Modbus RTU 是真实工业串口协议形态，但当前项目未实现 RTU runtime
- **AND** README SHALL 说明本期 OPC UA Simulator 默认 anonymous / no-security 仅用于本地模拟，不代表生产安全配置
- **AND** README SHALL 明确 Dashboard/ViewModel 通过 Tag 和 ViewModel 状态消费数据，不依赖底层协议类型

#### Scenario: README 描述性能验证边界
- **WHEN** README 描述性能测试
- **THEN** README SHALL 提供 100、500、1000 Tag profile 的运行方式和报告字段说明
- **AND** README SHALL 说明性能报告默认输出到 `reports/performance/`
- **AND** README SHALL 说明 long-run smoke profile 默认为 5-10 分钟，extended profile 默认为 30-120 分钟手工验收
- **AND** README SHALL NOT 写入未经脚本生成的固定性能数字

#### Scenario: README 提供推广文章入口
- **WHEN** 读者打开根目录 `README.md`
- **THEN** README SHALL 提供 `docs/articles/juejin-industrial-hmi-foundation.md` 的入口
- **AND** README SHALL 用简洁摘要说明该文章适合掘金发布和外部项目展示
- **AND** README SHALL 保留 `docs/project-manual.md` 项目说明书入口
- **AND** README SHALL NOT 复制完整掘金文章正文

#### Scenario: README 展示项目亮点和当前页面
- **WHEN** 读者希望快速了解当前 UI 和可演示能力
- **THEN** README SHALL 概述 Dashboard、Device、Alarm、Trend、Recipe、Audit、User Management、Tag Management 和 Settings 页面
- **AND** README SHALL 概述 Electron 进程边界、协议抽象、Tag Quality、报警、趋势、配方、权限和审计等项目亮点
- **AND** README SHALL 继续说明当前项目是工业自动化学习、模拟和工程实践项目
- **AND** README SHALL 继续说明它不代表真实生产现场 Safety System

### Requirement: Help Manual
系统 SHALL 在应用 Help 入口中提供离线使用说明书。

#### Scenario: 用户打开使用说明书
- **WHEN** 用户选择 `帮助 -> 使用说明书` 或等价 Help 入口
- **THEN** 系统 SHALL 在当前应用窗口中展示随应用打包的使用说明书
- **AND** 说明书 SHALL 不依赖外部网络请求

#### Scenario: 使用说明书覆盖当前功能
- **WHEN** 用户阅读使用说明书
- **THEN** 说明书 SHALL 覆盖应用定位、基础页面、导航方式、语言切换、日志和错误基础、更新检查、版本说明、运行/演示边界和常见问题
- **AND** 说明书 SHALL 覆盖设备连接、Tag Quality、断线重连、报警确认、历史趋势、配方下载、权限区分和审计日志
- **AND** 说明书 SHALL 明确可以在应用内启动/停止 Modbus TCP 和 OPC UA Simulator
- **AND** 说明书 SHALL 将 `yarn simulator:start` 和 `yarn simulator:opcua:start` 描述为维护者或独立验证路径，而不是普通用户唯一启动方式
- **AND** 说明书 SHALL 明确 Modbus TCP 和 OPC UA 均为本项目 Simulator / 测试端点语境下的模拟通信能力
- **AND** 说明书 SHALL 明确 Modbus RTU 当前未实现 runtime

#### Scenario: 使用说明书跟随语言
- **WHEN** 用户在中文和英文之间切换语言
- **THEN** 使用说明书 SHALL 展示对应语言内容
- **AND** 默认 SHALL 展示中文内容
- **AND** 英文说明书 SHALL NOT 保留与当前实现不一致的过期表述

#### Scenario: 使用说明书覆盖当前页面操作
- **WHEN** 用户阅读应用内使用说明书
- **THEN** 说明书 SHALL 覆盖 Dashboard、Device、Alarm、Trend、Recipe、Audit、User Management、Tag Management 和 Settings 页面用途
- **AND** 说明书 SHALL 说明普通演示路径是先在 Settings 中启动 Simulator，再到 Device 页面 Connect
- **AND** 说明书 SHALL 说明 Device 页面连接状态、Tag Monitor、Tag Quality 和 timestamp 的含义
- **AND** 说明书 SHALL 说明报警确认不等于工况恢复
- **AND** 说明书 SHALL 说明实时趋势使用有界缓存、历史趋势来自 SQLite
- **AND** 说明书 SHALL 说明配方下载需要校验、写入和 read-back / verify
- **AND** 说明书 SHALL 说明权限区分和 Audit Log 的用途

#### Scenario: 使用说明书保持操作导向和边界一致
- **WHEN** 用户阅读应用内使用说明书
- **THEN** 说明书 SHALL 保持离线操作说明定位
- **AND** 说明书 SHALL NOT 变成长篇推广文章
- **AND** 说明书 SHALL 可以链接 README、项目说明书或掘金文章草稿
- **AND** 说明书 SHALL 继续明确当前项目面向 Simulator、学习和工程实践，不代表真实生产现场 Safety System
- **AND** 英文说明书 SHALL NOT 保留与中文默认说明或当前实现不一致的过期表述

### Requirement: Changelog As Release Notes Source
项目 SHALL 在根目录维护 `CHANGELOG.md`，并将其作为应用内版本更新说明和 GitHub Release notes 的来源。

#### Scenario: 当前版本有未发布说明
- **WHEN** 维护者查看 `CHANGELOG.md`
- **THEN** 文件 SHALL 包含匹配 `package.json` version 的 `## Unreleased / <version>` 区块
- **AND** 该区块 SHALL 包含用户可见变更的简洁条目
- **AND** 该区块 SHALL 记录当前版本的应用内 Simulator 控制、项目说明书 Help 入口、掘金推广文章、README 展示入口和使用说明书更新
- **AND** 本 change SHALL NOT 默认提升 `package.json` version

#### Scenario: Changelog 顶部版本匹配 package
- **WHEN** 维护者准备发布或运行版本一致性验证
- **THEN** `CHANGELOG.md` 顶部第一个版本区块 SHALL 是 `## Unreleased / <package.json version>`
- **AND** package version 与 changelog 顶部版本不一致时 SHALL 失败

#### Scenario: Release notes 被提取
- **WHEN** release 脚本为某个稳定版本提取说明
- **THEN** 脚本 SHALL 能从 `CHANGELOG.md` 的 `Unreleased / <version>` 或 `v<version> - YYYY-MM-DD` 区块提取非空 release notes

#### Scenario: 已发布版本日期格式
- **WHEN** changelog 记录已发布版本
- **THEN** 已发布版本标题 SHALL 使用 `## v<version> - YYYY-MM-DD`
- **AND** 日期 SHALL 使用 UTC release finalized 日期

#### Scenario: 当前版本记录推广文档变化
- **WHEN** 维护者查看 `CHANGELOG.md`
- **THEN** 文件 SHALL 包含匹配 `package.json` version 的 `## Unreleased / <version>` 区块
- **AND** 该区块 SHALL 记录掘金推广文章、README 展示入口和使用说明书更新
- **AND** 本 change SHALL NOT 默认提升 `package.json` version

### Requirement: Product Readiness Verification
项目 SHALL 为多语言、帮助、更新检查、版本号策略、图标资产、项目说明书、应用内 Simulator 控制、推广文章和发布打包提供自动化验证。

#### Scenario: 本 change 实施完成
- **WHEN** 维护者运行项目验证
- **THEN** `yarn typecheck`、`yarn lint`、`yarn test` 和 `yarn build` SHALL 通过

#### Scenario: Simulator 控制测试
- **WHEN** 测试运行
- **THEN** 测试 SHALL 覆盖 SimulatorManager start、stop、status、重复 start、异常 exit、dispose 清理和启动失败
- **AND** 测试 SHALL 覆盖 Main / Preload / Renderer 的 typed simulator API contract
- **AND** 测试 SHALL 验证 Renderer 不能通过 simulator API 传入任意 shell 命令

#### Scenario: 多语言和帮助测试
- **WHEN** 测试运行
- **THEN** 测试 SHALL 覆盖默认中文、英文切换、中文回退、Help 入口、使用说明书展示、项目说明书展示和版本更新说明展示
- **AND** 测试 SHALL 覆盖使用说明书中的应用内 Simulator 控制、当前模拟通信、报警、历史趋势、配方、权限和审计说明
- **AND** 测试 SHALL 验证项目说明书覆盖模拟协议映射、关键工程问答和真实生产 Safety System 非目标声明

#### Scenario: 更新和发布测试
- **WHEN** 测试运行
- **THEN** 测试 SHALL 覆盖 update manager 状态、typed update bridge、changelog parser、release notes 脚本、Electron Builder publish 配置、`master` workflow trigger 和 GitHub workflow artifacts

#### Scenario: 版本号策略测试
- **WHEN** 测试运行
- **THEN** 测试 SHALL 覆盖稳定 SemVer 解析、非法版本拒绝、release tag/title 解析、draft/prerelease 忽略、版本比较、下一开发版本计算、package/changelog 一致性和 changelog 发布归档

#### Scenario: Release workflow 下一版本测试
- **WHEN** release workflow 配置测试运行
- **THEN** 测试 SHALL 验证 workflow 包含发版后准备下一开发版本的 job
- **AND** 测试 SHALL 验证 workflow 使用 `dev` 作为 development branch
- **AND** 测试 SHALL 验证 workflow 使用本项目 Yarn 命令
- **AND** 测试 SHALL 验证 workflow 不启用 GitHub Packages

#### Scenario: 图标和项目说明书测试
- **WHEN** 测试运行
- **THEN** 测试 SHALL 验证项目图标资产存在且 Electron Builder 配置引用正确
- **AND** 测试 SHALL 验证 README 提供项目说明书入口
- **AND** 测试 SHALL 验证项目说明书覆盖模拟协议映射、用户列出的关键问答和真实生产 Safety System 非目标声明

#### Scenario: 打包资源测试
- **WHEN** 打包配置或 build script 测试运行
- **THEN** 测试 SHALL 验证 packaged app 包含或可解析 Modbus TCP 和 OPC UA Simulator runtime entry
- **AND** 测试 SHALL 验证项目说明书内容来源被打包或嵌入应用

#### Scenario: 推广文档内容可验证
- **WHEN** 测试或文档检查运行
- **THEN** 检查 SHALL 验证掘金文章文件存在
- **AND** 检查 SHALL 验证 README 提供掘金文章入口和项目说明书入口
- **AND** 检查 SHALL 验证使用说明书覆盖当前主要页面和 Simulator-first 操作路径
- **AND** 检查 SHALL 验证文章、README 和使用说明书不包含 `/Users/mac/Downloads` 或其他用户本机绝对截图路径
- **AND** 检查 SHALL 验证文档不声明真实生产 Safety System、Modbus RTU runtime、生产 OPC UA security profile 或未经验证的固定性能数字

#### Scenario: 本 change 实施完成
- **WHEN** 维护者运行项目验证
- **THEN** `openspec validate add-juejin-promotion-docs --strict` SHALL 通过
- **AND** `openspec validate --all --strict` SHALL 通过
- **AND** `git diff --check` SHALL 通过
- **AND** 如修改 TypeScript 帮助手册或相关测试，`yarn typecheck`、`yarn lint`、`yarn test` 和 `yarn build` SHALL 通过，或明确说明未运行原因
