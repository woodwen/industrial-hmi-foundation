## ADDED Requirements

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

## MODIFIED Requirements

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
