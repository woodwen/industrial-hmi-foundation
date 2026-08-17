## Context

本项目当前是工业自动化上位机/HMI 学习与面试展示用的 Electron 桌面应用。既有基础 change 已建立：

- Electron Main / Preload / Renderer 三段式架构。
- Renderer 使用 React、TypeScript、MobX 和 MVVM。
- Renderer 通过 `AppViewModel.activePage` 做内部页面切换，不引入 React Router。
- Renderer 样式使用普通 CSS 或 CSS Modules，不引入 Tailwind 或组件库。
- Preload 通过单一 `window.hmi` 暴露 typed API。
- Renderer 不直接访问 Node.js、TCP、工业协议或 SQLite。

本 change 只在上述边界内补齐产品交付基础能力，不扩大工业业务范围。

参考项目 `/Users/mac/code/NodeProjects/StockMonitor` 中可复用的设计点包括：

- `src/main/update-manager.ts`：Main 侧集中管理 `electron-updater` 事件、错误映射、下载页打开和 macOS 未签名构建的手动安装降级。
- `src/renderer/features/app-update/view-models/AppUpdateViewModel.ts` 和 `views/UpdateStatusView.tsx`：Renderer 以 ViewModel 管理更新状态和用户动作。
- `src/renderer/features/help/views/UserManualModal.tsx`：帮助说明书作为应用内离线内容展示。
- `src/renderer/features/help/views/VersionUpdatesModal.tsx` 与 `models/changelog.ts`：从内置 `CHANGELOG.md` 解析版本说明。
- `.github/workflows/release.yml`：先校验版本和 changelog，再跨平台打包，最后创建 GitHub Release。
- `scripts/check-release-version.mjs`、`scripts/extract-changelog-release-notes.mjs`、`scripts/prepare-next-dev-version.mjs`：发布前后自动化脚本。

本项目不直接继承 StockMonitor 的 `yarn`、Ant Design、股票领域文案或包名配置；所有实现必须适配本项目当前 npm、普通 CSS、HMI 领域文案和 `window.hmi` API。

## Goals / Non-Goals

**Goals:**

- 默认中文，支持英文，语言资源覆盖导航、基础页面、帮助、版本说明和更新状态。
- 提供可切换语言的 Renderer i18n 基础设施，并对缺失 key 回退中文。
- 新增 `AGENTS.md`，为后续 agent/协作者固定项目背景、架构边界、命令和 OpenSpec 约定。
- 新增 `README.md`，让仓库首页可以独立说明项目定位、运行、构建、测试、架构和发布流程。
- 新增 `CHANGELOG.md`，作为应用内版本更新说明和 GitHub Release notes 的单一来源。
- 在 Help 中新增使用说明书和版本更新说明，内容可离线阅读。
- 在 Help 中新增检查更新入口，展示 checking、available、manual-download、not-available、downloading、downloaded、cancelled 和 error 等状态。
- 新增 GitHub Releases 更新源和跨平台自动打包 workflow。
- 为文档、帮助、更新和发布脚本补充可执行测试。

**Non-Goals:**

- 不实现真实工业协议、设备连接、采集调度、报警计算、趋势存储或配方执行。
- 不引入 React Router、Tailwind 或第三方 UI 组件库。
- 不要求本 change 完成 macOS 签名、公证、Windows 签名或自动安装可信证书链。
- 不要求帮助说明书覆盖未来未实现工业业务的详细操作。
- 不把 GitHub 仓库 owner/repo 硬编码为 StockMonitor；最终仓库信息需要以本项目实际仓库为准。

## Decisions

### 1. 多语言基础

Renderer 新增 `localization` 或等价模块，定义稳定的 `LanguageCode = 'zh-CN' | 'en-US'`、消息 key 和翻译字典。默认语言为 `zh-CN`。语言偏好可以先保存在 Renderer 本地持久化中；如果后续引入统一 settings store，再迁移到 Main 持久化。

翻译范围至少覆盖：

- 导航和页面标题。
- Dashboard、Device、Alarm、Trend、Recipe、Tag Management、Settings 的基础文案。
- Help 菜单/入口。
- 使用说明书目录和正文。
- 版本更新说明视图中的固定 UI 文案。
- 检查更新状态、按钮和错误提示。

当英文翻译缺失时，系统必须回退中文，避免 UI 出现空白 key 或调试字符串。

### 2. 文档和 changelog

根目录新增：

- `AGENTS.md`：面向 Codex/agent 和人工协作者，记录项目目标、架构边界、禁止事项、常用命令、OpenSpec 流程和测试要求。
- `README.md`：面向项目读者，描述 Industrial HMI Foundation 的定位、技术栈、运行命令、目录结构、当前已实现范围、后续工业能力边界、帮助/更新和发布方式。
- `CHANGELOG.md`：采用 `## Unreleased / <package version>` 与 `## vX.Y.Z - YYYY-MM-DD` 格式。这个格式同时服务应用内版本说明和 GitHub Release notes 提取脚本。

`README.md` 默认中文，可以增加英文摘要或双语小节；优先确保中文读者能完整理解。`CHANGELOG.md` 默认中文，英文 UI 模式下仍可以展示版本条目，后续如果需要完整英文 changelog 再单独扩展。

### 3. Help 用户入口

当前应用没有成熟 Help 菜单和帮助页面。本 change 应在现有 App shell 中提供 Help 入口，入口形态可以是顶部工具按钮、Settings 页分组或 Main 菜单触发 Renderer action。默认建议：

- Renderer shell 中增加 Help 工具入口，提供 `使用说明书`、`版本更新说明`、`检查更新`。
- 如果实现 Main menu，则 menu command 必须走 typed preload bridge，不在 Renderer 中解析任意字符串。
- 使用说明书以应用内弹窗或页面形式展示，不依赖外部网络。
- 版本更新说明从打包内置 `CHANGELOG.md` 解析，解析失败时展示空状态或可读错误，不导致应用崩溃。

帮助正文应匹配当前基础项目范围：解释应用定位、页面用途、架构限制、运行/演示方式、日志/错误基础和后续工业能力尚未实现的边界。

### 4. 检查更新

Main 侧新增 update manager，参考 StockMonitor 的状态机，但适配 HMI 项目：

- 使用 `electron-updater` 作为 GitHub Releases 更新检查来源。
- 在开发环境中不发起真实更新检查，可返回当前版本或模拟 `not-available`，避免开发时误触远端发布流程。
- 在 packaged 环境中调用 `autoUpdater.checkForUpdates()`。
- `autoDownload` 默认关闭，由用户确认后下载。
- 对 GitHub 网络错误、release metadata 缺失、macOS 未签名自动安装限制等情况提供用户可读错误或手动下载路径。
- macOS 未签名构建默认降级为打开 GitHub Releases 下载页，而不是承诺应用内自动安装。
- 更新事件通过 Main -> Preload -> Renderer typed event 流传递，不暴露 raw IPC。

Preload 扩展 `window.hmi.updates` 或等价 typed namespace，至少包含：

- `checkForUpdates()`
- `downloadUpdate()`
- `cancelUpdateDownload()`
- `openUpdateDownloadPage(version?)`
- `quitAndInstallUpdate()`
- `onUpdateEvent(listener)`

Renderer 新增 `AppUpdateViewModel` 管理状态和用户动作，更新状态 UI 使用普通 CSS 实现 modal/panel，不引入组件库。

### 5. GitHub 自动打包发布

新增 GitHub Actions workflow，参考 StockMonitor 但使用本项目 npm 命令：

- push 到发布分支时先运行版本检查，只有 `package.json` 版本高于 GitHub 最新稳定 release 时才发布。
- validate job 运行 `npm ci`、`npm run typecheck`、`npm run lint`、`npm run test`、`node scripts/extract-changelog-release-notes.mjs --check`、`npm run build`。
- build job 在 macOS、Windows、Linux 上运行 Electron Builder，上传 `.dmg`、`.zip`、`.exe`、`.AppImage`、`.yml`、`.yaml`、`.blockmap` 等 release artifacts。
- publish job 根据 `CHANGELOG.md` 生成 release notes，并创建 GitHub Release。
- release 后可选准备下一开发版本：更新 `package.json` 和 `CHANGELOG.md` 的 `Unreleased / <next version>` 区块，并提交回开发分支。

Electron Builder 配置必须包含：

- 本项目实际 `appId`、`productName`、`artifactName` 和 `directories.output`。
- GitHub publish provider，owner/repo 必须由本项目仓库确认后填写。
- macOS target 包含 `dmg` 和 `zip`，其中 `zip` 是 `electron-updater` 在 macOS 上检查/下载所需产物。
- Windows target 至少包含 `nsis`。
- Linux target 至少包含 `AppImage`，并使用不含 scope 或斜杠的安全 executable name。

### 6. 验证策略

本 change 实施时应新增或更新测试：

- i18n 默认语言、语言切换和缺失 key 中文回退测试。
- Help 入口渲染和打开使用说明书/版本更新说明测试。
- changelog parser 测试，覆盖 `Unreleased / X.Y.Z`、`vX.Y.Z - YYYY-MM-DD`、分组和空内容。
- preload API contract 测试，覆盖 updates namespace 和 event unsubscribe。
- update manager 测试，覆盖开发环境跳过真实检查、GitHub release URL、macOS 未签名手动下载降级、网络错误映射、下载取消。
- package build config 测试，覆盖 publish provider、macOS zip、Linux executable name 和 release artifacts。
- release scripts 测试，覆盖版本比较、release notes 提取和下一开发版本准备。

## Risks / Trade-offs

- [Risk] 多语言范围一次性覆盖过大，容易出现翻译遗漏 -> Mitigation：使用 typed message keys、中文回退和测试覆盖关键页面。
- [Risk] `CHANGELOG.md` 同时服务应用内展示和 GitHub Release notes，格式变化会影响发布 -> Mitigation：新增 parser 和 release notes 提取脚本测试。
- [Risk] GitHub auto update 依赖仓库 owner/repo、release artifacts 和签名状态 -> Mitigation：方案中保留 owner/repo 待确认项，macOS 未签名默认手动下载，不承诺自动安装。
- [Risk] 直接照搬 StockMonitor 会引入不匹配的 yarn、Ant Design 和股票领域文案 -> Mitigation：只复用 update/release 的流程和测试思路，UI 和文案按 HMI 项目实现。
- [Risk] release workflow 在私有仓库或权限受限仓库中无法发布 packages -> Mitigation：发布 job 使用最小 `contents: write` 权限，是否发布 GitHub Packages 作为可选项，不作为默认必需能力。

## Migration Plan

本 change 不涉及用户数据迁移。实施顺序建议：

1. 先补根目录文档和 `CHANGELOG.md` 格式。
2. 再补 Renderer i18n 基础和帮助/版本说明 UI。
3. 然后补 Main/Preload 更新检查 API 和 Renderer 更新状态。
4. 最后补 Electron Builder 配置、GitHub Actions、发布脚本和测试。

## Open Questions

- GitHub Releases 的 owner/repo 需要确认。默认建议从当前仓库 remote 推断；若当前目录没有 git remote，则先使用占位配置并在实施前要求确认。
- 默认发布分支需要确认。默认建议使用 `main`；如果项目实际使用 `master` 或 `dev -> master` 发版流，应在实施前同步到 workflow。
- macOS 是否需要签名和公证需要确认。默认建议本 change 先按未签名构建处理，应用内更新降级到打开下载页。
