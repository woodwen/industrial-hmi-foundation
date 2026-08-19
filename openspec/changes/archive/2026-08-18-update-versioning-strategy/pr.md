# M-6(build): 固化版本发布策略

OpenSpec Change: update-versioning-strategy

背景:
- 项目已有 GitHub Release、changelog release notes 和下一开发版本脚本，但版本策略没有固化为可验证规则。
- `package.json` 当前版本为 `0.1.1`，而 `CHANGELOG.md` 顶部曾停留在 `Unreleased / 0.1.0`，会影响 release notes 提取和应用内版本说明一致性。

方案概述:
- 以 `package.json` 的稳定 SemVer `X.Y.Z` 作为唯一 release version 来源。
- Git tag 和 GitHub Release title 统一使用 `v<package.json version>`。
- 发布前校验 package/changelog 顶部版本一致，并在 GitHub Release 成功后针对既有 `dev` 分支准备下一开发版本。
- 保持本项目 npm 工具链和 GitHub Releases-only 策略，不引入 Yarn、GitHub Packages、prerelease/nightly 或 conventional commits 自动推导版本。

实现改动:
- `scripts/extract-changelog-release-notes.mjs` 新增 `getTopUnreleasedVersion` 和 `assertPackageChangelogVersion`，默认 `--check` 会验证 `CHANGELOG.md` 顶部 `Unreleased / <package version>`。
- `.github/workflows/release.yml` 将 release title 改为 `$RELEASE_TAG`，并新增 `prepare-next-dev-version` job：校验远端 `dev` 存在、checkout `dev`、运行 `prepare-next-dev-version.mjs`、提交 `[skip release] [skip ci]` 后推回 `dev`。
- `CHANGELOG.md` 顶部修正为 `Unreleased / 0.1.1`，`package-lock.json` 根版本同步为 `0.1.1`。
- `README.md` 新增版本策略说明，覆盖版本源、tag/title、changelog 格式、`master`/`dev` 分支职责和暂不支持的版本流。
- release 相关测试覆盖稳定 SemVer、release tag 过滤、版本比较、package/changelog 一致性、下一开发版本进位、changelog 归档和 workflow 策略。
- OpenSpec 已归档到 `openspec/changes/archive/2026-08-18-update-versioning-strategy/`，并同步 `openspec/specs/product-readiness/spec.md`。

测试计划(UT):
- `openspec validate update-versioning-strategy --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

影响范围(建议手动测试范围):
- 发布流程：检查 `master` push 触发后的 release title、release notes 提取、artifact 上传和 `dev` 下一版本准备行为。
- 版本说明：检查应用内版本更新说明是否展示 `CHANGELOG.md` 当前 `0.1.1` 区块。
- 仓库治理：远端必须已有 `dev` 分支且 GitHub Actions 具备 `contents: write` 权限，否则下一开发版本 job 会明确失败。

风险与后续:
- 本次不自动创建 `dev` 分支，也不支持 prerelease/nightly/build metadata；这些能力如需引入，应单独通过 OpenSpec change 设计。
- `prepare-next-dev-version` 自动递增 patch，minor/major 升版仍由维护者显式调整。
