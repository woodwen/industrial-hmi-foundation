## Context

当前项目已经在 `product-readiness` capability 中定义了 `CHANGELOG.md`、GitHub Release workflow、release notes 提取、更新检查和发布验证能力。实现层面也已经存在：

- `scripts/check-release-version.mjs`
- `scripts/extract-changelog-release-notes.mjs`
- `scripts/prepare-next-dev-version.mjs`
- `.github/workflows/release.yml`
- `tests/release-scripts.test.mjs`
- `tests/package-build-config.test.mjs`

需要补强的问题是“版本号策略”还没有明确成为项目规则。当前 `package.json` version 为 `0.1.1`，但 `CHANGELOG.md` 顶部仍是 `## Unreleased / 0.1.0`，这会破坏 release notes 提取、应用内版本说明和 release workflow 的一致性。

参考 StockMonitor 的稳定做法：

- `package.json` 使用稳定 SemVer `X.Y.Z`。
- GitHub Release tag 使用 `vX.Y.Z`。
- `CHANGELOG.md` 顶部使用 `## Unreleased / <current package version>`。
- 发版前检查当前版本是否高于 GitHub 最新稳定 release。
- GitHub Release notes 从匹配版本的 changelog 区块提取。
- 发版后在开发分支准备下一开发版本，并把刚发布的 Unreleased 区块归档为 `## vX.Y.Z - YYYY-MM-DD`。

本项目应复用这些策略，但命令、分支和包管理器必须适配 HMI 项目：使用 npm，不引入 StockMonitor 的 Yarn、股票领域文案、GitHub Packages 或 Ant Design 相关假设。

## Goals / Non-Goals

**Goals:**

- 明确 HMI 项目的版本号策略和版本生命周期。
- 让 `package.json` version、`CHANGELOG.md` 顶部 Unreleased 区块、Git tag 和 GitHub Release version 保持一致。
- 明确发版后开发分支如何准备下一开发版本。
- 补齐版本一致性、下一开发版本计算和 release workflow 行为的测试要求。
- 修复当前 `package.json` 与 `CHANGELOG.md` 的版本不一致问题。
- 保持 OpenSpec、release workflow、应用内版本更新说明和 GitHub Release notes 的来源一致。

**Non-Goals:**

- 不改变应用自动更新协议。
- 不改变 Electron Builder artifact 种类和命名策略，除非发现现有配置与版本策略冲突。
- 不引入 GitHub Packages 发布。
- 不实现 prerelease、alpha、beta 或 nightly 版本流。
- 不引入 conventional commits 自动推导版本。
- 不修改工业通信、Tag、Alarm、Historian、Recipe 或 Renderer 业务页面行为。

## Decisions

### 1. 版本源与格式

`package.json` 的 `version` 是项目唯一 release version 源。格式只接受稳定 SemVer：

```text
X.Y.Z
```

不接受 `vX.Y.Z`、`X.Y.Z-beta.1`、`X.Y.Z+build` 或任意非稳定版本作为发布版本。

GitHub Release tag 固定为：

```text
v<package.json version>
```

GitHub Release title 默认与 tag 一致，也使用 `v<package.json version>`。这样 GitHub Release 页面、tag、release notes 和 artifact 文件中的 `${version}` 能保持清晰对应。

备选方案是引入 prerelease/channel 体系。当前项目还处于学习和工程展示阶段，发布目标是稳定安装包与可追溯 release notes，暂不增加多 channel 复杂度。

### 2. Changelog 与版本一致性

`CHANGELOG.md` 顶部版本区块必须匹配当前 `package.json` version：

```text
## Unreleased / <package.json version>
```

该区块同时服务：

- 应用内“版本更新说明”。
- GitHub Release notes 提取。
- release 前非空说明校验。

当前项目应在实施阶段修正 `CHANGELOG.md`：把顶部 `Unreleased / 0.1.0` 更新为与当前 `package.json` version `0.1.1` 一致。本 change 默认不额外提升 package version，只修正 changelog 为 `Unreleased / 0.1.1`。

### 3. 发版前校验

发版前校验沿用 StockMonitor 思路：

- 读取 `package.json` version。
- 读取 GitHub Releases 中所有稳定 release。
- 忽略 draft、prerelease 和非 `vX.Y.Z` tag。
- 只有当前 package version 大于最新稳定 release version 时才继续发布。
- 当前版本小于或等于最新稳定 release 时跳过发布或失败，避免重复发布。
- 发布前验证 changelog 能为当前版本提取非空 release notes。

本项目继续使用 npm：

```text
npm ci
npm run typecheck
npm run lint
npm run test
node scripts/extract-changelog-release-notes.mjs --check
npm run build
```

### 4. 发版后下一开发版本

发版成功后，开发分支准备下一开发版本。默认分支策略：

- `master`：保持刚发布的稳定版本。
- `dev`：推进到下一开发版本。

下一开发版本默认递增 patch：

```text
0.1.1 -> 0.1.2
```

边界沿用 StockMonitor 脚本策略：minor 和 patch 最大值为 `100`。当 patch 达到上限时进位 minor；当 minor 也达到上限时进位 major。

发布后的 changelog 归档规则：

```text
## Unreleased / <next version>

## v<released version> - <release date>
```

release date 使用 UTC release finalized 日期，格式为 `YYYY-MM-DD`，与 workflow 中 `date -u +%F` 保持一致。

### 5. 自动化与手工流程边界

实施阶段应让 release workflow 明确包含 “prepare next dev version” 行为，默认在 release 成功后针对 `dev` 分支执行：

- checkout `dev`
- 运行 `node scripts/prepare-next-dev-version.mjs --released-version "$RELEASED_VERSION" --release-date "$(date -u +%F)"`
- 如果文件有变化，提交 `chore: prepare next development version ...`
- commit message 包含 `[skip release] [skip ci]`
- push 回 `dev`

如果当前仓库没有 `dev` 分支或权限不足，workflow 应可明确失败或跳过并输出原因；不要静默成功。

本期不自动创建 `dev` 分支。创建或保护分支属于仓库治理动作，应由维护者在仓库层面明确完成；workflow 只负责发现缺失并给出可诊断失败。

### 6. 测试策略

测试应覆盖：

- 稳定 SemVer 解析和非法版本拒绝。
- `vX.Y.Z` GitHub Release tag 解析。
- draft/prerelease/非规范 tag 忽略。
- 当前版本大于最新稳定 release 时才发布。
- `package.json` version 与 `CHANGELOG.md` 顶部 `Unreleased / <version>` 一致。
- release notes 能从 Unreleased 或已归档版本区块提取。
- 下一开发版本 patch 递增、patch 进位 minor、minor 进位 major。
- 发版后 changelog 归档成 `vX.Y.Z - YYYY-MM-DD`，并新建下一版本 Unreleased 区块。
- release workflow 包含 prepare next dev version job，并使用 npm 而不是 yarn。
- release workflow 不包含 GitHub Packages 发布，也不使用 conventional commits 自动推导版本。

## Risks / Trade-offs

- [Risk] 当前 `package.json` 与 `CHANGELOG.md` 已不一致，直接发版会造成 release notes 提取失败或发布错误版本 -> Mitigation：实施阶段先增加一致性测试，再修正 changelog 顶部版本。
- [Risk] 自动向 `dev` 推送下一版本依赖 GitHub Actions 权限和分支存在 -> Mitigation：workflow 明确 `contents: write` 权限、目标分支和失败输出；若仓库暂未启用 `dev`，先记录为手工步骤或创建分支策略。
- [Risk] 照搬 StockMonitor 会引入 Yarn、股票项目名或 GitHub Packages 假设 -> Mitigation：只复用版本策略和脚本思路，命令与文案全部适配 Industrial HMI Foundation。
- [Risk] 固定只支持稳定版本会限制 prerelease 测试 -> Mitigation：当前项目先保证稳定 release 链路，prerelease/nightly 以后用独立 change 设计。
- [Risk] patch 自动递增可能不符合语义化版本严格含义 -> Mitigation：默认按项目学习阶段的小步发布采用 patch；重大变更或破坏性变化由维护者手动提升 minor/major，再由脚本校验格式和一致性。

## Migration Plan

1. 增加 OpenSpec delta，明确版本号策略。
2. 增加或补强 release script 测试和 package/changelog 一致性测试。
3. 修正 `CHANGELOG.md` 顶部版本，使其匹配当前 `package.json` version。
4. 补强 release workflow 中发版后准备下一开发版本的 job。
5. 更新 README 或 release 文档中版本号策略说明。
6. 运行 OpenSpec validation、release script tests、package build config tests、typecheck、lint、test 和 build。

回滚方式：若 workflow 改动不适配当前 GitHub 仓库权限，可以先回滚 workflow 的自动 push 部分，保留脚本和文档化手工步骤；版本一致性测试和 changelog 修正不应回滚。

## Open Questions

无。默认决策已固定为：开发分支使用 `dev`；当前 package version 不额外提升，只把 `CHANGELOG.md` 顶部修正为 `Unreleased / 0.1.1`；不支持 prerelease/nightly/build metadata；不引入 conventional commits 自动版本推导；不启用 GitHub Packages；不自动创建 `dev` 分支。
