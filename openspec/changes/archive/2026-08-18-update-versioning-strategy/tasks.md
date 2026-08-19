## 1. Baseline Review

- [x] 1.1 对比当前 `package.json` version、`CHANGELOG.md` 顶部版本区块、release scripts 和 release workflow。
- [x] 1.2 复核 StockMonitor 的版本策略脚本、release-process spec、CHANGELOG 格式和 workflow，只提取适合本项目的规则。
- [x] 1.3 确认本 change 不改变应用自动更新协议、Electron Builder artifact 种类、工业业务功能或 GitHub Packages 发布策略。

## 2. Version Strategy Rules

- [x] 2.1 明确 `package.json` version 是唯一 release version 来源。
- [x] 2.2 限制 release version 为稳定 SemVer `X.Y.Z`，拒绝 `v` 前缀、prerelease 和 build metadata。
- [x] 2.3 明确 GitHub Release tag 为 `v<package.json version>`。
- [x] 2.4 明确 GitHub Release title 默认与 tag 一致，使用 `v<package.json version>`。
- [x] 2.5 明确 `CHANGELOG.md` 顶部必须是 `## Unreleased / <package.json version>`。
- [x] 2.6 明确已发布版本归档标题为 `## v<version> - YYYY-MM-DD`，日期使用 UTC release finalized 日期。
- [x] 2.7 明确 release finalized 后 `dev` 分支准备下一开发版本，默认 patch 递增，minor/patch 上限为 `100` 并按上限进位。
- [x] 2.8 明确本期不支持 prerelease、nightly、build metadata 或 conventional commits 自动版本推导。

## 3. Changelog and Package Consistency

- [x] 3.1 增加或补强 package/changelog 一致性校验函数。
- [x] 3.2 增加测试覆盖 `package.json` version 与 `CHANGELOG.md` 顶部 Unreleased 版本一致。
- [x] 3.3 修正当前 `CHANGELOG.md` 顶部版本，使其与当前 `package.json` version `0.1.1` 一致，且不额外提升 package version。
- [x] 3.4 确保 release notes 提取脚本在当前版本没有非空 changelog notes 时失败。

## 4. Release Script Hardening

- [x] 4.1 补强稳定 SemVer 解析和非法版本拒绝测试。
- [x] 4.2 补强 `vX.Y.Z` release tag 解析、draft release 忽略、prerelease 忽略和非规范 tag 忽略测试。
- [x] 4.3 补强当前版本大于最新稳定 GitHub Release 时才发布的测试。
- [x] 4.4 补强下一开发版本计算测试，覆盖 patch 递增、patch 进位 minor 和 minor 进位 major。
- [x] 4.5 补强 changelog 发布归档测试，覆盖 `Unreleased / <released version>` 转为 `v<released version> - YYYY-MM-DD` 并新建下一版本区块。

## 5. Release Workflow

- [x] 5.1 更新 release workflow，使发布前验证包含 package/changelog 当前版本一致性检查。
- [x] 5.2 更新 release workflow，使 GitHub Release 成功后在 `dev` 分支准备下一开发版本。
- [x] 5.3 确保下一开发版本提交包含 `[skip release] [skip ci]`，避免触发发布循环。
- [x] 5.4 确保 workflow 使用 npm 命令，不引入 StockMonitor 的 Yarn 命令。
- [x] 5.5 确保 workflow 使用 `dev` 作为 development branch，并且不自动创建 `dev` 分支。
- [x] 5.6 如果当前仓库缺少 `dev` 分支，workflow SHALL 明确失败或输出可诊断原因，不静默成功。
- [x] 5.7 更新 package/release workflow 测试，覆盖下一开发版本 job、`dev` 目标分支、release title、npm 命令和 GitHub Releases-only 策略。

## 6. Documentation

- [x] 6.1 更新 README 或 release 文档，说明版本源、tag 格式、changelog 顶部区块和已发布区块格式。
- [x] 6.2 说明 `master` 保持已发布版本、`dev` 准备下一版本的默认分支策略。
- [x] 6.3 说明当前不支持 prerelease、nightly、build metadata 或 conventional commits 自动版本推导。
- [x] 6.4 确认文档不包含 StockMonitor 包名、股票领域文案或 Yarn 命令。

## 7. Verification

- [x] 7.1 Run `openspec validate update-versioning-strategy --strict`.
- [x] 7.2 Run `openspec validate --all --strict`.
- [x] 7.3 Run `git diff --check`.
- [x] 7.4 Run `npm run typecheck`.
- [x] 7.5 Run `npm run lint`.
- [x] 7.6 Run `npm run test`.
- [x] 7.7 Run `npm run build`.
- [x] 7.8 Report version/changelog status, workflow limitations, failed checks, and remaining release risks before implementation completion.
