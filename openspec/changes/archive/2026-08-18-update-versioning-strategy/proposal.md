## Why

当前项目已经具备 GitHub Release、changelog release notes 和下一开发版本脚本的基础，但版本号策略还没有被明确固化为可验收规则；当前 `package.json` version 与 `CHANGELOG.md` 的 `Unreleased / <version>` 区块也存在不一致风险。需要参考 StockMonitor 已验证的做法，把版本号递增、release 校验、changelog 归档和发版后开发版本准备收敛为本项目自己的规范。

## What Changes

- 明确项目仅使用稳定 SemVer `X.Y.Z` 作为 `package.json` version、Git tag 和 GitHub Release 的版本源。
- 明确 release tag 统一为 `v<package.json version>`。
- 明确 GitHub Release title 默认与 tag 一致，使用 `v<package.json version>`。
- 明确 `CHANGELOG.md` 顶部必须是匹配当前 `package.json` version 的 `## Unreleased / <version>` 区块。
- 明确发版前必须校验当前版本高于最新稳定 GitHub Release，且 changelog 能提取当前版本非空 release notes。
- 明确发版完成后，在 `dev` 分支准备下一开发版本：默认递增 patch；minor 和 patch 上限为 `100`，达到上限后按规则进位。
- 明确已发布版本区块格式为 `## v<version> - YYYY-MM-DD`，日期使用 UTC release finalized 日期。
- 明确 `master` 保持已发布版本，`dev` 持有下一开发版本。
- 明确本期不自动创建 `dev` 分支；如果 `dev` 不存在，workflow 应明确失败或输出可诊断原因。
- 明确本期不支持 prerelease、nightly、build metadata 或 conventional commits 自动版本推导。
- 补齐测试要求，覆盖版本解析、版本比较、下一开发版本计算、changelog 区块归档、package/changelog 一致性和 release workflow 中下一开发版本准备。
- 修正当前 `package.json` version 与 `CHANGELOG.md` 顶部 `Unreleased / <version>` 的一致性问题；默认不额外升版，只把 changelog 修正为 `Unreleased / 0.1.1`。
- 不改变应用自动更新协议、不改变 Electron Builder artifacts、不引入 GitHub Packages。

## Capabilities

### New Capabilities
- 无。

### Modified Capabilities
- `product-readiness`: 增加明确的版本号策略、package/changelog 一致性、release tag 规则、发版后下一开发版本准备和对应验证要求。

## Impact

- 影响 `openspec/specs/product-readiness/spec.md` 的 release/changelog/version 相关要求。
- 影响 `CHANGELOG.md` 与 `package.json` 的版本一致性维护策略。
- 影响 `scripts/check-release-version.mjs`、`scripts/prepare-next-dev-version.mjs`、`scripts/extract-changelog-release-notes.mjs` 的行为约束和测试覆盖。
- 影响 `.github/workflows/release.yml`：需要明确 release 后准备下一开发版本的 job 和分支行为。
- 影响 release 相关测试，例如 `tests/release-scripts.test.mjs`、`tests/package-build-config.test.mjs`，必要时新增 package/changelog 一致性测试。
- 影响 README 或 release 文档：需要说明版本源、tag/title 格式、changelog 格式、`master`/`dev` 分支职责和不支持 prerelease/nightly 的边界。
- 本 change 是发布流程和版本策略更新，不改变工业通信、Renderer 页面业务、自动更新下载逻辑或打包产物种类。
