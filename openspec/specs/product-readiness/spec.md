# product-readiness Specification

## Purpose
TBD - created by archiving change add-localized-help-release-readiness. Update Purpose after archive.
## Requirements
### Requirement: Bilingual Application Text
系统 SHALL 支持中文和英文用户界面文案，并默认使用中文。

#### Scenario: 应用首次启动使用中文
- **WHEN** 用户首次启动应用且没有已保存语言偏好
- **THEN** Renderer SHALL 使用中文展示导航、基础页面、帮助入口和更新状态文案

#### Scenario: 用户切换英文
- **WHEN** 用户将语言切换为英文
- **THEN** Renderer SHALL 使用英文展示已覆盖的导航、基础页面、帮助入口和更新状态文案
- **AND** 该语言选择 SHALL 在应用内后续交互中保持一致

#### Scenario: 英文翻译缺失时回退中文
- **WHEN** 当前语言为英文且某个翻译 key 缺失
- **THEN** 系统 SHALL 回退展示对应中文文案
- **AND** UI SHALL NOT 展示空白、`undefined` 或原始调试 key

### Requirement: Repository Agent Guide
项目 SHALL 在根目录提供 `AGENTS.md`，指导 Codex/agent 和人工协作者在本仓库内工作。

#### Scenario: 协作者阅读 AGENTS
- **WHEN** 协作者打开根目录 `AGENTS.md`
- **THEN** 文档 SHALL 说明项目定位、主要技术栈、目录边界、Renderer 安全限制、OpenSpec workflow、常用验证命令和非目标工业业务范围

#### Scenario: AGENTS 约束 Renderer 边界
- **WHEN** 文档描述 Renderer 开发规则
- **THEN** 文档 SHALL 明确 Renderer 不直接访问 Node.js、TCP、Modbus、OPC UA、SQLite 或 Electron Main-only API

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

### Requirement: Help Update Check Entry
系统 SHALL 在应用 Help 入口中提供检查更新能力。

#### Scenario: 用户手动检查更新
- **WHEN** 用户选择 `帮助 -> 检查更新` 或等价 Help 入口
- **THEN** Renderer SHALL 通过 typed `window.hmi` API 请求 Main 执行更新检查
- **AND** Renderer SHALL 展示 checking、available、not-available、manual-download 或 error 状态

#### Scenario: 启动时不默认自动检查
- **WHEN** 应用启动且没有显式启用启动检查更新设置
- **THEN** 系统 SHALL NOT 自动发起更新检查
- **AND** 用户 SHALL 仍可通过 Help 入口手动检查更新

#### Scenario: 开发环境检查更新
- **WHEN** 应用运行在开发环境且用户检查更新
- **THEN** 系统 SHALL NOT 发起真实远端更新检查
- **AND** 系统 SHALL 返回确定性的用户可见状态，说明当前环境不执行真实更新下载

#### Scenario: macOS 未签名包检查到更新
- **WHEN** packaged macOS 构建未启用签名自动更新且检查到新版本
- **THEN** 系统 SHALL 提供打开 GitHub Releases 下载页的手动更新路径
- **AND** 系统 SHALL NOT 承诺应用内自动安装

### Requirement: Typed Update Bridge
系统 SHALL 通过 Main / Preload / Renderer 的 typed bridge 暴露更新相关能力，不向 Renderer 暴露 raw IPC。

#### Scenario: Renderer 使用更新 API
- **WHEN** Renderer 需要检查、下载、取消或安装更新
- **THEN** Renderer SHALL 调用 `window.hmi` 下的 typed 更新 API
- **AND** Renderer SHALL NOT 直接访问 `ipcRenderer`、任意 IPC channel 或 `electron-updater`

#### Scenario: Renderer 订阅更新事件
- **WHEN** Renderer 订阅更新状态事件
- **THEN** Preload API SHALL 返回可调用的 unsubscribe 函数
- **AND** 取消订阅后 Renderer SHALL 不再收到该 listener 的更新事件

### Requirement: GitHub Release Packaging
项目 SHALL 提供参考 StockMonitor 但适配本项目 Yarn 工具链的 GitHub 自动打包发布流程。

#### Scenario: 发布 workflow 触发
- **WHEN** 维护者向 `master` 分支推送版本变更
- **THEN** GitHub Actions SHALL 检查当前 `package.json` version 是否高于最新稳定 GitHub Release
- **AND** 只有需要发布时才继续验证、打包和创建 release

#### Scenario: 稳定版本判断
- **WHEN** release workflow 检查 GitHub Releases
- **THEN** workflow SHALL 只把非 draft、非 prerelease 且 tag 匹配 `vX.Y.Z` 的 release 作为稳定 release
- **AND** 非规范 tag SHALL NOT 影响最新稳定版本判断

#### Scenario: 发布前验证
- **WHEN** release workflow 准备构建 artifacts
- **THEN** workflow SHALL 运行 `yarn install --frozen-lockfile`、`yarn typecheck`、`yarn lint`、`yarn test`、`node scripts/extract-changelog-release-notes.mjs --check` 和 `yarn build`
- **AND** workflow SHALL 验证 `package.json` version 与 `CHANGELOG.md` 顶部 Unreleased 版本一致

#### Scenario: 跨平台 artifacts
- **WHEN** release workflow 执行打包
- **THEN** workflow SHALL 为 macOS、Windows 和 Linux 生成桌面安装 artifacts
- **AND** macOS artifacts SHALL 包含 `dmg` 和 `zip`
- **AND** workflow SHALL 上传更新 metadata，例如 `yml`、`yaml` 或 `blockmap`

#### Scenario: GitHub Release 创建
- **WHEN** 所有平台打包成功
- **THEN** workflow SHALL 从 `CHANGELOG.md` 提取 release notes
- **AND** workflow SHALL 创建 `v<version>` GitHub Release 并附加所有 release artifacts
- **AND** GitHub Release title SHALL 使用 `v<version>`
- **AND** workflow SHALL NOT 默认发布 GitHub Packages

#### Scenario: 发版后准备下一开发版本
- **WHEN** GitHub Release 创建成功
- **THEN** workflow SHALL 在 `dev` 分支准备下一开发版本
- **AND** workflow SHALL 将 released changelog 区块归档为 `v<version> - YYYY-MM-DD`
- **AND** workflow SHALL 创建匹配下一开发版本的顶部 `Unreleased / <next version>` 区块
- **AND** workflow SHALL 使用 `[skip release] [skip ci]` 避免下一开发版本提交触发发布循环

#### Scenario: 缺少 dev 分支时不静默成功
- **WHEN** release workflow 无法 checkout `dev` 分支
- **THEN** workflow SHALL 明确失败或输出可诊断原因
- **AND** workflow SHALL NOT 自动创建 `dev` 分支

#### Scenario: 项目身份配置
- **WHEN** Electron Builder publish 配置被实现
- **THEN** `appId` SHALL be `com.industrialhmi.foundation`
- **AND** `productName` SHALL be `Industrial HMI Foundation`
- **AND** artifact 名称 SHALL be `Industrial-HMI-Foundation-${version}-${arch}.${ext}`
- **AND** Linux executable name SHALL be `industrial-hmi-foundation`
- **AND** GitHub owner/repo SHALL 使用本项目 remote 或显式项目配置
- **AND** 配置 SHALL NOT 泄漏 StockMonitor 的包名、owner/repo、产品名或股票领域文案

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

### Requirement: Industrial Business Scope Remains Deferred
系统 SHALL 明确区分已实现的模拟工业业务能力和仍然不属于本项目的真实生产现场能力。

#### Scenario: Product readiness 能力实施完成
- **WHEN** 维护者查看产品就绪基础能力
- **THEN** 项目 SHALL 保留多语言、帮助、更新检查、changelog 和发布打包能力
- **AND** 工业业务模拟能力 SHALL 以当前各业务 capability spec 为准，不再由本 requirement 统一声明延期

#### Scenario: Product hardening 能力实施完成
- **WHEN** 本 change 实施完成
- **THEN** 项目 MAY 包含 Modbus、OPC UA、PLC Simulator、Tag Polling、Alarm processing、Historian storage、Trend、Recipe、Permission 和 Audit 的模拟实现
- **AND** 文档、UI 和测试数据 SHALL 继续保持 PLC Simulator/学习项目语境

#### Scenario: 真实生产安全能力仍不声明
- **WHEN** 文档、Help、Demo、README 或 UI 文案描述项目用途
- **THEN** 系统 SHALL NOT 暗示已经部署于真实生产环境
- **AND** SHALL NOT 声称提供 Safety PLC、安全继电器、硬件联锁、急停、SIL、生产认证或现场网络安全合规能力

#### Scenario: Known limitations are explicit
- **WHEN** README 或 Help 文档描述 Known Limitations
- **THEN** 它 SHALL 明确列出 Simulator-only、OPC UA security/certificate 未作为生产配置实现、性能测试为本机采样、长期运行检查窗口有限、以及真实设备接入需要额外工程验证

### Requirement: Version Number Strategy
项目 SHALL 使用明确的稳定版本号策略管理 package version、changelog、Git tag、GitHub Release 和发版后的下一开发版本。

#### Scenario: package version 是发布版本源
- **WHEN** 发布流程读取当前应用版本
- **THEN** `package.json` version SHALL 作为唯一 release version 来源
- **AND** version SHALL 使用稳定 SemVer `X.Y.Z` 格式
- **AND** version SHALL NOT 包含 `v` 前缀、prerelease 后缀或 build metadata

#### Scenario: Release tag 由 package version 派生
- **WHEN** GitHub Release 被创建
- **THEN** release tag SHALL 使用 `v<package.json version>` 格式
- **AND** release title SHALL 使用同一个 `v<package.json version>` 格式

#### Scenario: package 和 changelog 当前版本一致
- **WHEN** 维护者运行版本一致性验证
- **THEN** `CHANGELOG.md` 顶部 SHALL 包含 `## Unreleased / <package.json version>`
- **AND** 顶部 Unreleased 版本 SHALL 与 `package.json` version 完全一致

#### Scenario: 当前项目版本被修正
- **WHEN** 本 change 实施完成
- **THEN** `CHANGELOG.md` 顶部 Unreleased 区块 SHALL 与当前 `package.json` version `0.1.1` 保持一致

#### Scenario: 下一开发版本默认递增
- **WHEN** release version finalized 且 development branch 需要准备下一版本
- **THEN** 下一开发版本 SHALL 默认递增 patch
- **AND** minor 和 patch 上限 SHALL 为 `100`
- **AND** 当 patch 达到 `100` 时 SHALL 进位 minor
- **AND** 当 minor 达到 `100` 时 SHALL 进位 major

#### Scenario: 发版后 changelog 被归档
- **WHEN** release version finalized
- **THEN** `CHANGELOG.md` SHALL 将已发布的 `Unreleased / <released version>` 区块归档为 `## v<released version> - YYYY-MM-DD`
- **AND** `CHANGELOG.md` 顶部 SHALL 新建 `## Unreleased / <next version>` 区块
- **AND** 发布日期 SHALL 使用 UTC release finalized 日期

#### Scenario: master 和 dev 版本职责分离
- **WHEN** release workflow 完成稳定版本发布
- **THEN** `master` SHALL 保持刚发布的稳定版本
- **AND** `dev` SHALL 作为 development branch 准备下一开发版本

#### Scenario: dev 分支不自动创建
- **WHEN** release workflow 需要准备下一开发版本但 `dev` 分支不存在
- **THEN** workflow SHALL 明确失败或输出可诊断原因
- **AND** workflow SHALL NOT 自动创建 `dev` 分支

#### Scenario: 自动版本推导保持禁用
- **WHEN** 维护者提交 change 或创建 release
- **THEN** 系统 SHALL NOT 通过 conventional commits 自动推导 package version
- **AND** version bump SHALL 由维护者或 release 脚本显式执行

### Requirement: Interview Demo Documentation
项目 SHALL 提供面试演示场景文档，使读者可以按步骤展示核心工业 HMI 能力。

#### Scenario: Demo index exists
- **WHEN** 读者在 README 或文档入口查找 Demo
- **THEN** 文档 SHALL 列出设备启动及实时监控、PLC 断线到 Bad Quality 到自动重连、高温报警确认恢复、历史趋势、Recipe Download、Modbus / OPC UA 协议切换六个 Demo

#### Scenario: Demo steps include prerequisites
- **WHEN** 某个 Demo 需要 Simulator、登录用户、权限、历史采集时间或协议配置
- **THEN** 文档 SHALL 在步骤开始前列出前置条件
- **AND** 不满足前置条件时 SHALL 提供可诊断的提示或回退说明

#### Scenario: Demo language stays simulator-scoped
- **WHEN** Demo 文档描述设备、报警、历史趋势、配方或协议切换
- **THEN** 文档 SHALL 使用模拟设备或 PLC Simulator 语境
- **AND** SHALL NOT 暗示该流程已经验证真实生产现场安全要求

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
