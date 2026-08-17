# Industrial HMI Foundation Agent Guide

## 项目定位

Industrial HMI Foundation 是一个 Electron + React + TypeScript 桌面应用基础项目，用于工业自动化上位机/HMI 学习、面试展示和后续工业能力演进。当前主线目标是建立稳定的桌面壳、Renderer MVVM、受控 IPC、日志、错误处理、帮助文档、更新检查和发布打包流程。

## 技术栈

- Electron Main / Preload / Renderer 三段式架构。
- Renderer 使用 React、TypeScript、MobX 和 MVVM。
- 构建工具使用 `electron-vite`。
- 包管理器使用 `npm`。
- 测试使用 Vitest。
- 样式使用普通 CSS 或 CSS Modules，不默认引入 Tailwind 或组件库。

## 架构边界

- `src/main/` 承载 Electron Main、IPC handlers、日志、更新检查和后续工业通信/持久化基础设施。
- `src/preload/` 只通过 `contextBridge` 暴露最小 typed `window.hmi` API。
- `src/shared/` 放置 Main、Preload、Renderer 可共享的类型和 IPC channel 常量。
- `src/renderer/` 承载 React UI、MobX ViewModel、页面、组件和浏览器侧 adapter。
- Renderer 代码不得直接导入或访问 Node.js、Electron Main-only API、TCP、Modbus、OPC UA、SQLite 或本地文件系统能力。
- 工业业务依赖方向保持 View -> ViewModel -> Application Service / Domain Service -> Infrastructure。

## OpenSpec 工作流

- 新能力先创建或更新 `openspec/changes/<change-id>/` 下的 `proposal.md`、`design.md`、`tasks.md` 和 `specs/**/spec.md`。
- 实施时按 `tasks.md` 顺序推进，完成且验证后再勾选。
- 不要在实施方案阶段提交、push 或 archive。
- 完成实现后至少运行：

```bash
openspec validate <change-id> --strict
openspec validate --all --strict
git diff --check
npm run typecheck
npm run lint
npm run test
npm run build
```

## 常用命令

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run dist
```

## 范围保护

当前基础项目仍不实现真实 Modbus、OPC UA、PLC Simulator、Tag Polling、Alarm processing、Historian storage 或 Recipe execution。相关页面和目录可以保留结构、文案、测试和接口边界，但不得在没有独立 OpenSpec change 的情况下加入真实工业业务逻辑。

StockMonitor 只能作为更新检查、帮助文档和 GitHub release workflow 的参考来源。实现必须使用本项目包名、仓库、HMI 领域文案、npm 命令和 `window.hmi` API。
