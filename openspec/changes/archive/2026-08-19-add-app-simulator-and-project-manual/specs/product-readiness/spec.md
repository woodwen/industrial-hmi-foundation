## ADDED Requirements

### Requirement: In-App Simulator Lifecycle
系统 SHALL 在应用内提供本地 Simulator 生命周期控制，使用户无需离开 App 到调试或终端流程中启动模拟设备。

#### Scenario: 用户从应用内启动 Modbus TCP Simulator
- **WHEN** 用户在应用内选择启动 Modbus TCP Simulator
- **THEN** Main Process SHALL 启动与 `yarn simulator:start` 对应的本地 Modbus TCP Simulator runtime
- **AND** Simulator SHALL 使用默认 `127.0.0.1:1502` 和 unit id `1`，除非后续配置显式覆盖
- **AND** Renderer SHALL 展示 simulator 状态、endpoint 摘要和启动结果
- **AND** 用户 SHALL NOT 需要先打开终端、调试任务或运行 `yarn simulator:start`

#### Scenario: 用户从应用内启动 OPC UA Simulator
- **WHEN** 用户在应用内选择启动 OPC UA Simulator
- **THEN** Main Process SHALL 启动与 `yarn simulator:opcua:start` 对应的本地 OPC UA Simulator runtime
- **AND** Simulator SHALL 使用默认 endpoint `opc.tcp://127.0.0.1:4840/industrial-hmi-simulator`，除非后续配置显式覆盖
- **AND** Renderer SHALL 展示 simulator 状态、endpoint 摘要和启动结果
- **AND** 用户 SHALL NOT 需要先打开终端、调试任务或运行 `yarn simulator:opcua:start`

#### Scenario: Simulator lifecycle 保持进程边界
- **WHEN** Renderer 请求启动、停止或查询 Simulator
- **THEN** Renderer SHALL 通过 typed `window.hmi` simulator API 请求 Main Process
- **AND** Preload SHALL NOT 暴露 raw `ipcRenderer`、Node.js API、`child_process`、任意 shell 命令或底层 Simulator 对象
- **AND** Main Process SHALL 只接受固定 simulator kind 和固定 lifecycle 操作

#### Scenario: Simulator 状态显式可见
- **WHEN** 应用展示 Simulator 控制区域
- **THEN** UI SHALL 至少区分 `Stopped`、`Starting`、`Running`、`Stopping` 和 `Fault`
- **AND** UI SHALL 展示协议类型、endpoint 摘要、是否由当前 App 托管和可读错误摘要
- **AND** UI SHALL NOT 只用多个互不关联的 boolean 表示复杂 lifecycle

#### Scenario: Simulator 控制入口在 Settings
- **WHEN** 用户打开 Settings 页面
- **THEN** 系统 SHALL 展示 Simulator 控制区域
- **AND** 该区域 SHALL 分别提供 Modbus TCP 和 OPC UA Simulator 的状态、endpoint、Start 和 Stop 控制
- **AND** Device 页面 MAY 展示当前协议相关的 Simulator 状态摘要或连接引导
- **AND** Device 页面 SHALL NOT 绕过 DeviceManager 连接流程或成为 Simulator 进程管理主入口

#### Scenario: 重复启动不创建重复托管进程
- **WHEN** 某一类 Simulator 已经由当前 App 托管并处于 `Starting` 或 `Running`
- **THEN** 再次启动同类 Simulator SHALL 返回当前状态
- **AND** 系统 SHALL NOT 创建第二个同 endpoint 的 managed simulator process

#### Scenario: 外部 Simulator 或端口占用不被强行接管
- **WHEN** 应用内启动 Simulator 时默认 endpoint 已被外部进程占用
- **THEN** Main Process SHALL 返回可读的启动失败状态
- **AND** Stop 操作 SHALL NOT kill 或接管不是当前 App 创建的外部进程
- **AND** Renderer SHALL 展示可诊断提示，而不是只展示低层 Node.js 异常文本

#### Scenario: 应用退出清理托管 Simulator
- **WHEN** 应用退出或 Main runtime dispose
- **THEN** Main Process SHALL 停止当前 App 托管的 Simulator runtime
- **AND** 相关 timer、listener、process handle 和 IPC subscription SHALL 被释放
- **AND** 清理失败 SHALL 被记录为 error log，而不导致 Renderer 崩溃

#### Scenario: 独立脚本继续可用
- **WHEN** 维护者运行 `yarn simulator:start` 或 `yarn simulator:opcua:start`
- **THEN** 对应 Simulator SHALL 仍可在不启动 Electron HMI 的情况下独立运行
- **AND** 应用内 Simulator 控制 SHALL NOT 让业务层对 Simulator 产生特殊依赖

#### Scenario: 应用构建包含 Simulator runtime
- **WHEN** 维护者运行 dev/build/package 流程
- **THEN** 应用内 Simulator 控制 SHALL 能解析到 Modbus TCP 和 OPC UA Simulator runtime
- **AND** packaged app SHALL 包含启动本地 Simulator 所需的 runtime entry
- **AND** 缺少 runtime entry 时 SHALL 返回可读错误，应用 SHALL NOT 崩溃

### Requirement: In-App Project Manual
系统 SHALL 在应用内提供离线项目说明书入口，使用户可以在 App 中阅读 `docs/project-manual.md` 对应内容。

#### Scenario: 用户打开项目说明书
- **WHEN** 用户选择 `帮助 -> 项目说明书`、`Help -> Project Manual` 或等价 Help 入口
- **THEN** 系统 SHALL 在当前应用窗口中展示项目说明书
- **AND** 展示过程 SHALL 不要求外部网络请求
- **AND** 用户 SHALL NOT 必须打开项目目录、README 链接或外部编辑器才能阅读项目说明书

#### Scenario: 项目说明书内容来源明确
- **WHEN** 应用内项目说明书内容被构建或读取
- **THEN** `docs/project-manual.md` SHALL 作为项目说明书内容来源或生成来源
- **AND** 实施 SHALL 提供测试或脚本验证应用内展示内容没有遗漏项目定位、协议映射、关键工程问答和真实生产 Safety System 非目标声明

#### Scenario: 项目说明书 UI 文案跟随语言
- **WHEN** 用户在中文和英文之间切换语言
- **THEN** 项目说明书入口标签、标题、关闭按钮、空状态和错误提示 SHALL 跟随应用语言
- **AND** 项目说明书正文 MAY 使用 `docs/project-manual.md` 的中文源内容，除非后续需求提供英文项目说明书来源

#### Scenario: 项目说明书渲染失败可恢复
- **WHEN** 项目说明书内容为空、缺失或解析失败
- **THEN** 系统 SHALL 展示可读空状态或错误提示
- **AND** 应用 SHALL NOT 崩溃

## MODIFIED Requirements

### Requirement: Repository README
项目 SHALL 在根目录提供 `README.md`，使新读者可以理解、运行、验证和演示当前工业 HMI 模拟应用。

#### Scenario: 读者查看 README
- **WHEN** 读者打开根目录 `README.md`
- **THEN** README SHALL 至少包含项目介绍、Architecture、Technology Stack、工业通信架构、Modbus Mapping、Tag Model、Polling Architecture、Device State Machine、Alarm Lifecycle、Historian、Recipe、OPC UA、如何运行 Simulator、Demo 步骤、Testing 和 Known Limitations
- **AND** README SHALL 描述当前项目的主要运行命令、测试命令、目录结构、架构边界、帮助入口、更新检查和打包发布流程
- **AND** README SHALL 提供 `docs/project-manual.md` 项目说明书入口
- **AND** README SHALL 说明项目说明书也可以从应用 Help 入口离线查看

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

### Requirement: Changelog As Release Notes Source
项目 SHALL 在根目录维护 `CHANGELOG.md`，并将其作为应用内版本更新说明和 GitHub Release notes 的来源。

#### Scenario: 当前版本有未发布说明
- **WHEN** 维护者查看 `CHANGELOG.md`
- **THEN** 文件 SHALL 包含匹配 `package.json` version 的 `## Unreleased / <version>` 区块
- **AND** 该区块 SHALL 包含用户可见变更的简洁条目
- **AND** 该区块 SHALL 记录本 change 的应用内 Simulator 控制和项目说明书 Help 入口
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

### Requirement: Product Readiness Verification
项目 SHALL 为多语言、帮助、更新检查、版本号策略、图标资产、项目说明书、应用内 Simulator 控制和发布打包提供自动化验证。

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
