# M-3(feat): 补齐产品文档帮助更新发布

OpenSpec Change: add-localized-help-release-readiness

背景:
- 工业 HMI 基础项目已经具备 Electron 三进程架构和基础页面骨架，但缺少可交付产品所需的仓库文档、版本记录、应用内帮助、检查更新和自动打包发布流程。
- 应用面向中文学习与面试展示场景，需要默认中文，同时保留英文演示能力。

方案概述:
- 在现有 Main / Preload / Renderer 边界内补齐产品可交付能力，不扩大工业业务范围。
- Renderer 增加轻量 typed localization、Help 入口、离线使用说明书、版本更新说明和更新状态 UI。
- Main/Preload 增加 typed update bridge 和 `electron-updater` update manager，开发环境跳过真实远端检查，macOS 未签名包降级为手动下载。
- 增加 Electron Builder 配置、GitHub Releases workflow 和 release helper scripts，发布分支固定为 `master`。
- 完成 OpenSpec archive，将 `product-readiness` 能力同步到主 specs。

实现改动:
- 新增 `AGENTS.md`、`README.md`、`CHANGELOG.md`，补齐协作说明、项目说明和 release notes 来源。
- 新增 `src/renderer/localization/messages.ts`，支持 `zh-CN` / `en-US`、默认中文和中文回退。
- 更新导航、页面、App shell 和 ViewModel，使基础页面文案通过 localization 层渲染。
- 新增 `HelpPanel`、`Dialog`、`UserManualDialog`、`VersionUpdatesDialog`、manual 内容和 changelog parser。
- 新增 `src/main/update-manager.ts`，扩展 `src/shared/hmi-api.ts`、`src/shared/ipc-channels.ts`、`src/preload/index.ts` 和 IPC handlers，提供更新检查、下载、取消、打开下载页和重启安装 API。
- 新增 `AppUpdateViewModel` 和 `UpdateStatusView`，用 MobX 和普通 CSS 管理更新状态展示。
- 更新 `package.json` / `package-lock.json`，加入 `electron-updater`、`builder-util-runtime`、`electron-builder` 和 `dist` 脚本，并配置 GitHub Releases 发布产物。
- 新增 `.github/workflows/release.yml`，push 到 `master` 时执行版本检查、npm 验证、跨平台打包和 GitHub Release 创建，不默认发布 GitHub Packages。
- 新增 `scripts/check-release-version.mjs`、`scripts/extract-changelog-release-notes.mjs`、`scripts/prepare-next-dev-version.mjs`。
- 新增 localization、help render、changelog parser、update manager、release scripts、package workflow 测试，并更新既有 ViewModel、Renderer 和 preload contract 测试。
- 归档 OpenSpec change，并新增 `openspec/specs/product-readiness/spec.md`。

测试计划(UT):
- `openspec validate add-localized-help-release-readiness --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `node scripts/extract-changelog-release-notes.mjs --check`

影响范围(建议手动测试范围):
- 建议使用 `npm run dev` 打开应用，确认默认中文、语言切换、左侧导航、Help 菜单、使用说明书、版本更新说明和检查更新状态。
- 建议在 packaged 环境手动验证 GitHub Releases 检查更新路径，尤其是 macOS 未签名包打开下载页的降级行为。
- 建议检查 release workflow 中 `master` 触发、GitHub owner/repo、macOS `dmg`/`zip`、Windows `nsis`、Linux `AppImage` artifacts。

风险与后续:
- 本 change 不实现真实 Modbus、OPC UA、PLC Simulator、Tag Polling、Alarm processing、Historian storage 或 Recipe execution。
- macOS 自动安装仍受签名和公证限制；当前策略是未签名包手动下载。
- 启动自动检查更新未默认启用，后续可在引入 settings 持久化后增加开关。
