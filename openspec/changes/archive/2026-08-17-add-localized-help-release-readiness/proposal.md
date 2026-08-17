## Why

当前工业 HMI 基础项目已经具备 Electron Main / Preload / Renderer 分层、MVVM 页面骨架、基础日志和错误处理能力，但还缺少用户可读文档、协作者约定、版本记录、应用内帮助、更新检查和自动发布打包流程。随着项目从基础架构进入可演示应用阶段，需要先建立产品可交付所需的“文档 + 帮助 + 更新 + 发布”闭环，避免后续功能增长后文档、版本说明和安装包发布流程失控。

同时，应用面向中文学习与面试展示场景，默认语言应为中文，并保留英文 UI/帮助文案能力，便于后续对外展示或跨语言演示。

## What Changes

- 新增应用国际化基础，支持中文和英文，默认中文，缺失翻译回退到中文。
- 新增根目录 `AGENTS.md`，记录本项目的协作、架构、验证和 OpenSpec 工作约定。
- 新增根目录 `CHANGELOG.md`，采用可被发布脚本提取的版本说明格式。
- 新增根目录 `README.md`，描述项目定位、技术栈、运行方式、架构边界、文档入口、更新和发布方式。
- 在应用 Help 区域新增 `使用说明书`，内容离线打包并随语言切换展示中文或英文版本。
- 在应用 Help 区域新增 `版本更新说明`，从内置 `CHANGELOG.md` 读取当前版本和历史版本说明。
- 新增 `检查更新` 能力，参考 `/Users/mac/code/NodeProjects/StockMonitor` 的 `update-manager`、typed preload bridge、Renderer ViewModel 和更新状态 UI，但适配本项目既有 `window.hmi` API、MobX MVVM、普通 CSS 和 npm 工具链；第一版默认只提供手动检查更新入口。
- 新增 GitHub 自动打包与发布能力，参考 StockMonitor 的 release workflow、版本检查、changelog release notes 提取和发版后开发版本准备脚本，但适配本项目包名、仓库信息、Electron Builder 配置和 npm 命令；GitHub Release 默认由 `master` 分支触发，默认只发布 GitHub Releases artifacts，不启用 GitHub Packages。
- 增加必要测试，覆盖语言默认值/切换、帮助入口、changelog 解析、更新状态、release 配置和脚本行为。

## Capabilities

### New Capabilities
- `product-readiness`: 定义工业 HMI 应用的多语言、仓库文档、应用内帮助、版本更新说明、检查更新和 GitHub 自动打包发布能力。

### Modified Capabilities
- 无。

## Impact

- 影响根目录文档：`AGENTS.md`、`CHANGELOG.md`、`README.md`。
- 影响 Renderer：新增语言资源、帮助视图、版本更新说明视图、更新状态 ViewModel/UI，并接入现有 App shell 或 Help 入口。
- 影响 Preload / shared types：扩展 `window.hmi` 的 typed API，支持更新检查、更新事件订阅、打开发布下载页等用例。
- 影响 Main：新增 update manager、GitHub Releases 更新源配置、更新 IPC handlers 和可选启动检查。
- 影响构建发布：新增 Electron Builder 配置、发布脚本、`.github/workflows/release.yml`、release notes 提取和版本检查脚本，默认应用身份为 `Industrial HMI Foundation` / `com.industrialhmi.foundation`。
- 影响测试：新增单元测试、契约测试和发布配置测试。
- 不改变现有工业业务范围；本 change 仍不实现 Modbus、OPC UA、真实设备连接、采集、报警、趋势存储或配方执行。
