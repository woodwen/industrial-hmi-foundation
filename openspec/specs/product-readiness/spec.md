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
项目 SHALL 在根目录提供 `README.md`，使新读者可以理解、运行和验证工业 HMI 基础应用。

#### Scenario: 读者查看 README
- **WHEN** 读者打开根目录 `README.md`
- **THEN** README SHALL 描述项目定位、当前能力、技术栈、运行命令、测试命令、目录结构、架构边界、帮助入口、更新检查和自动打包发布流程

#### Scenario: README 说明业务边界
- **WHEN** README 描述工业 HMI 能力
- **THEN** README SHALL 明确当前项目仍是基础架构和页面骨架
- **AND** README SHALL 明确 Modbus、OPC UA、真实设备连接、实时采集、报警处理、历史趋势存储和配方执行尚未实现

### Requirement: Changelog As Release Notes Source
项目 SHALL 在根目录维护 `CHANGELOG.md`，并将其作为应用内版本更新说明和 GitHub Release notes 的来源。

#### Scenario: 当前版本有未发布说明
- **WHEN** 维护者查看 `CHANGELOG.md`
- **THEN** 文件 SHALL 包含匹配 `package.json` version 的 `## Unreleased / <version>` 区块
- **AND** 该区块 SHALL 包含用户可见变更的简洁条目

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

### Requirement: Help Manual
系统 SHALL 在应用 Help 入口中提供离线使用说明书。

#### Scenario: 用户打开使用说明书
- **WHEN** 用户选择 `帮助 -> 使用说明书` 或等价 Help 入口
- **THEN** 系统 SHALL 在当前应用窗口中展示随应用打包的使用说明书
- **AND** 说明书 SHALL 不依赖外部网络请求

#### Scenario: 使用说明书覆盖当前功能
- **WHEN** 用户阅读使用说明书
- **THEN** 说明书 SHALL 覆盖应用定位、基础页面、导航方式、语言切换、日志和错误基础、更新检查、版本说明、运行/演示边界和常见问题
- **AND** 说明书 SHALL 明确真实工业协议、设备连接、采集、报警、历史趋势和配方执行尚未实现

#### Scenario: 使用说明书跟随语言
- **WHEN** 用户在中文和英文之间切换语言
- **THEN** 使用说明书 SHALL 展示对应语言内容
- **AND** 默认 SHALL 展示中文内容

### Requirement: Version Update Notes
系统 SHALL 在应用 Help 入口中提供离线版本更新说明。

#### Scenario: 用户打开版本更新说明
- **WHEN** 用户选择 `帮助 -> 版本更新说明` 或等价 Help 入口
- **THEN** 系统 SHALL 从当前安装包内置 `CHANGELOG.md` 展示版本更新说明
- **AND** 展示过程 SHALL 不要求网络请求

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
项目 SHALL 提供参考 StockMonitor 但适配本项目 npm 工具链的 GitHub 自动打包发布流程。

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
- **THEN** workflow SHALL 运行 `npm ci`、`npm run typecheck`、`npm run lint`、`npm run test`、`node scripts/extract-changelog-release-notes.mjs --check` 和 `npm run build`
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
项目 SHALL 为多语言、帮助、更新检查、版本号策略和发布打包提供自动化验证。

#### Scenario: 本 change 实施完成
- **WHEN** 维护者运行项目验证
- **THEN** `npm run typecheck`、`npm run lint`、`npm run test` 和 `npm run build` SHALL 通过

#### Scenario: 多语言和帮助测试
- **WHEN** 测试运行
- **THEN** 测试 SHALL 覆盖默认中文、英文切换、中文回退、Help 入口、使用说明书展示和版本更新说明展示

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
- **AND** 测试 SHALL 验证 workflow 使用 npm 命令而不是 StockMonitor 的 Yarn 命令
- **AND** 测试 SHALL 验证 workflow 不启用 GitHub Packages

### Requirement: Industrial Business Scope Remains Deferred
系统 SHALL 在本 change 中继续保持工业业务能力延期实现。

#### Scenario: Product readiness 能力实施完成
- **WHEN** 本 change 实施完成
- **THEN** 项目 SHALL NOT 新增 Modbus、OPC UA、PLC Simulator、Tag Polling、Alarm processing、Historian storage 或 Recipe execution 实现
- **AND** 现有基础页面可以更新文案和帮助说明，但仍 SHALL 保持业务占位状态

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
