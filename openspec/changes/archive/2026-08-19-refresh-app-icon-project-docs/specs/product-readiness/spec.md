## ADDED Requirements

### Requirement: Application Icon Branding
项目 SHALL 使用用户提供的工业 HMI 图标素材作为桌面应用图标，并为 Electron 打包提供跨平台图标资产。

#### Scenario: 图标源素材被纳入项目资产
- **WHEN** 本 change 实施完成
- **THEN** 项目 SHALL 从用户提供的 `tb2.png` 生成项目内图标资产
- **AND** 运行时代码或打包配置 SHALL NOT 依赖 `/Users/mac/Downloads` 这类用户本地下载目录路径

#### Scenario: Electron Builder 使用项目图标
- **WHEN** Electron Builder 配置被读取
- **THEN** 配置 SHALL 显式引用项目图标资产
- **AND** macOS、Windows 和 Linux 打包 SHALL 分别有可用的 `.icns`、`.ico` 和 `.png` 图标资产
- **AND** 项目现有 `appId`、`productName`、artifact 命名、Linux executable name 和 GitHub Releases publish 配置 SHALL 保持不变，除非后续需求明确要求修改

#### Scenario: 图标资产可验证
- **WHEN** 维护者运行项目测试
- **THEN** 测试 SHALL 验证项目图标文件存在
- **AND** 测试 SHALL 验证 Electron Builder 配置引用的是项目图标而不是默认 Electron 图标

### Requirement: Project Manual
项目 SHALL 提供详细的项目说明书，解释项目开发目的、解决的问题、模拟协议与真实协议关系，以及关键工业 HMI 工程问题。

#### Scenario: 项目说明书存在
- **WHEN** 读者打开项目文档
- **THEN** 项目 SHALL 提供 `docs/project-manual.md`
- **AND** README SHALL 提供到该项目说明书的入口
- **AND** README SHALL 保持为项目入口和摘要，不承载全部问答正文

#### Scenario: 项目说明书说明项目目的和问题域
- **WHEN** 读者阅读项目说明书
- **THEN** 文档 SHALL 说明本项目用于工业 HMI 学习、模拟、工程实践和面试展示
- **AND** 文档 SHALL 说明本项目解决的工程问题，包括 Electron 进程隔离、MVVM、协议抽象、实时 Tag 数据、设备状态、控制命令、报警、Historian、Trend、Recipe、权限和 Audit

#### Scenario: 项目说明书说明模拟协议和真实协议
- **WHEN** 读者阅读协议说明
- **THEN** 文档 SHALL 列出本项目已模拟的 Modbus TCP Simulator 和 OPC UA Simulator
- **AND** 文档 SHALL 说明它们分别对应真实 Modbus TCP PLC/远程 IO/网关和真实 OPC UA Server/PLC/SCADA/网关
- **AND** 文档 SHALL 解释 Modbus RTU 是基于串口的真实现场协议形态
- **AND** 文档 SHALL 明确当前项目未实现 Modbus RTU runtime，避免把 RTU 写成已支持模拟协议

#### Scenario: 项目说明书回答 PLC 通信问题
- **WHEN** 读者查看项目说明书的问答章节
- **THEN** 文档 SHALL 回答“怎么和 PLC / 设备通信？”
- **AND** 文档 SHALL 回答“Modbus TCP / RTU 是什么？”
- **AND** 文档 SHALL 回答“OPC UA 是什么？”
- **AND** 文档 SHALL 回答“怎么做周期采集？”
- **AND** 文档 SHALL 回答“1000 个点位怎么处理？”
- **AND** 文档 SHALL 回答“设备断线怎么办？”
- **AND** 文档 SHALL 回答“怎么避免 UI 被通信阻塞？”
- **AND** 文档 SHALL 回答“实时数据怎么刷新？”
- **AND** 文档 SHALL 回答“怎么做报警？”
- **AND** 文档 SHALL 回答“历史趋势怎么保存？”
- **AND** 文档 SHALL 回答“如何控制 PLC？”
- **AND** 文档 SHALL 回答“怎么防止重复下发命令？”
- **AND** 文档 SHALL 回答“PLC 通信线程和 UI 怎么隔离？”
- **AND** 文档 SHALL 回答“如何处理设备异常、超时、重连？”
- **AND** 文档 SHALL 回答“配方是什么？”
- **AND** 文档 SHALL 回答“点位 Tag 是怎么管理的？”
- **AND** 文档 SHALL 回答“操作员、工程师权限怎么区分？”
- **AND** 文档 SHALL 回答“怎么记录操作日志？”

#### Scenario: 项目说明书保持模拟项目边界
- **WHEN** 项目说明书描述设备控制、报警、趋势、配方或协议
- **THEN** 文档 SHALL 明确当前能力面向本地 Simulator、学习和工程实践
- **AND** 文档 SHALL NOT 暗示系统已经应用于真实生产现场
- **AND** 文档 SHALL NOT 声称提供 Safety PLC、安全继电器、硬件联锁、急停、SIL、生产认证或现场网络安全合规能力

## MODIFIED Requirements

### Requirement: Repository README
项目 SHALL 在根目录提供 `README.md`，使新读者可以理解、运行、验证和演示当前工业 HMI 模拟应用。

#### Scenario: 读者查看 README
- **WHEN** 读者打开根目录 `README.md`
- **THEN** README SHALL 至少包含项目介绍、Architecture、Technology Stack、工业通信架构、Modbus Mapping、Tag Model、Polling Architecture、Device State Machine、Alarm Lifecycle、Historian、Recipe、OPC UA、如何运行 Simulator、Demo 步骤、Testing 和 Known Limitations
- **AND** README SHALL 描述当前项目的主要运行命令、测试命令、目录结构、架构边界、帮助入口、更新检查和打包发布流程
- **AND** README SHALL 提供 `docs/project-manual.md` 项目说明书入口

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
- **AND** 说明书 SHALL 明确 Modbus TCP 和 OPC UA 均为本项目 Simulator / 测试端点语境下的模拟通信能力
- **AND** 说明书 SHALL 明确 Modbus RTU 当前未实现 runtime

#### Scenario: 使用说明书跟随语言
- **WHEN** 用户在中文和英文之间切换语言
- **THEN** 使用说明书 SHALL 展示对应语言内容
- **AND** 默认 SHALL 展示中文内容
- **AND** 英文说明书 SHALL NOT 保留与当前实现不一致的过期表述

### Requirement: Changelog As Release Notes Source
项目 SHALL 在根目录维护 `CHANGELOG.md`，并将其作为应用内版本更新说明和 GitHub Release notes 的来源。

#### Scenario: 当前版本有未发布说明
- **WHEN** 维护者查看 `CHANGELOG.md`
- **THEN** 文件 SHALL 包含匹配 `package.json` version 的 `## Unreleased / <version>` 区块
- **AND** 该区块 SHALL 包含用户可见变更的简洁条目
- **AND** 该区块 SHALL 记录本 change 的应用图标、项目说明书、README、使用说明书和版本说明更新
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

### Requirement: Version Update Notes
系统 SHALL 在应用 Help 入口中提供离线版本更新说明。

#### Scenario: 用户打开版本更新说明
- **WHEN** 用户选择 `帮助 -> 版本更新说明` 或等价 Help 入口
- **THEN** 系统 SHALL 从当前安装包内置 `CHANGELOG.md` 展示版本更新说明
- **AND** 展示过程 SHALL 不要求网络请求
- **AND** 展示内容 SHALL 包含本 change 记录的图标和文档更新条目

#### Scenario: Changelog 内容为空或格式不可解析
- **WHEN** 内置 `CHANGELOG.md` 没有可展示版本条目或格式不可解析
- **THEN** 系统 SHALL 展示可读空状态或错误提示
- **AND** 应用 SHALL NOT 崩溃

### Requirement: Product Readiness Verification
项目 SHALL 为多语言、帮助、更新检查、版本号策略、图标资产、项目说明书和发布打包提供自动化验证。

#### Scenario: 本 change 实施完成
- **WHEN** 维护者运行项目验证
- **THEN** `yarn typecheck`、`yarn lint`、`yarn test` 和 `yarn build` SHALL 通过

#### Scenario: 多语言和帮助测试
- **WHEN** 测试运行
- **THEN** 测试 SHALL 覆盖默认中文、英文切换、中文回退、Help 入口、使用说明书展示和版本更新说明展示
- **AND** 测试 SHALL 覆盖使用说明书中的当前模拟通信、报警、历史趋势、配方、权限和审计说明

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
