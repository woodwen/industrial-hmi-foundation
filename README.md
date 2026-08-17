# Industrial HMI Foundation

Industrial HMI Foundation 是一个用于工业自动化上位机/HMI 学习和面试展示的 Electron 桌面应用基础工程。项目重点是先固定 Main / Preload / Renderer 进程边界、Renderer MVVM、受控 IPC、日志、错误处理、帮助文档、更新检查和发布打包流程。

English summary: this repository provides a secure Electron foundation for an industrial HMI desktop application. It is a foundation shell, not a production control system.

## 当前能力

- Electron Main / Preload / Renderer 三段式架构。
- `contextIsolation` 开启，`nodeIntegration` 关闭。
- Renderer 使用 React、TypeScript、MobX 和 MVVM。
- 通过 `window.hmi` 暴露最小 typed API。
- Dashboard、Device、Alarm、Trend、Recipe、Tag Management、Settings 页面骨架。
- application、communication、error 三类日志基础。
- 统一应用错误模型。
- 中文默认、英文可切换的 UI 文案基础。
- 应用内 Help 入口：使用说明书、版本更新说明、检查更新。
- GitHub Releases 更新检查和自动打包发布基础。

## 非目标

当前项目仍是基础架构和页面骨架，不包含真实工业控制能力：

- 不实现 Modbus TCP。
- 不实现 OPC UA。
- 不实现 PLC Simulator。
- 不实现真实设备连接或实时采集。
- 不实现报警处理。
- 不实现历史趋势存储。
- 不实现配方执行或下发。

## 环境要求

- Node.js 22 或兼容版本。
- npm。
- macOS、Windows 或 Linux 桌面环境。

## 安装和运行

```bash
npm install
npm run dev
```

## 验证命令

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run smoke:start
```

## 目录结构

```text
src/
  main/       Electron Main、IPC handlers、日志、更新检查和后续工业基础设施
  preload/    contextBridge 和 typed window.hmi API
  shared/     共享类型、IPC channel 和错误模型
  renderer/   React UI、MobX ViewModel、页面、组件和浏览器侧 adapter
tests/        单元测试、契约测试、安全配置测试和架构边界测试
openspec/     OpenSpec specs 和 active changes
scripts/      发布版本、changelog 和 smoke check 脚本
```

## 架构边界

Renderer 是受限 UI 层，不直接访问 Node.js、Electron Main-only API、TCP、Modbus、OPC UA、SQLite 或文件系统。桌面能力和后续工业通信必须由 Main 或 Infrastructure 层承载，并通过 Preload 暴露的 typed `window.hmi` 用例 API 进入 Renderer。

默认分层方向：

```text
View -> ViewModel -> Application Service / Domain Service -> Infrastructure
```

## 帮助和更新

应用内 Help 入口提供：

- 使用说明书：离线说明当前页面、语言切换、日志/错误基础、更新检查和未实现的工业业务边界。
- 版本更新说明：从打包内置 `CHANGELOG.md` 读取。
- 检查更新：通过 GitHub Releases 检查新版本。开发环境不执行真实远端更新检查；macOS 未签名包检查到更新时打开 GitHub Releases 下载页手动安装。

## 发布打包

项目使用 Electron Builder 生成桌面安装包：

```bash
npm run dist
```

GitHub Actions 在 push 到 `master` 时执行发布流程：

1. 检查 `package.json` version 是否高于最新稳定 GitHub Release。
2. 运行 typecheck、lint、test、changelog release notes 校验和 build。
3. 在 macOS、Windows、Linux 上打包。
4. 创建 `v<version>` GitHub Release 并上传 artifacts。

默认只发布 GitHub Releases 和安装包 artifacts，不发布 GitHub Packages。
