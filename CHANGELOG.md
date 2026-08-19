# Changelog

所有用户可见变更都记录在此文件中。当前版本区块同时作为应用内版本更新说明和 GitHub Release notes 的来源。

## Unreleased / 0.1.2

## v0.1.1 - 2026-08-19

### Added

- 建立 Industrial HMI Foundation 的产品可交付基础：中英文 UI、应用内帮助、版本更新说明、检查更新和 GitHub Release 打包发布流程。
- 新增根目录 `AGENTS.md`、`README.md` 和 `CHANGELOG.md`，补齐协作说明、项目说明和版本记录来源。
- 新增独立 PLC Simulator、Modbus TCP 协议适配器和 Device 页面手工连接/读写验证能力。
- 新增 Tag 模型、周期采集、TagCache、Dashboard 实时监控和 Device Tag Monitor。
- 新增设备状态机、自动重连、Tag Quality 降级/恢复、CommandService 设备控制、写入验证和 Simulator 故障注入能力。
- 新增工业报警、SQLite 历史数据、实时趋势和历史趋势能力，支持报警确认、恢复和重启后历史查询。
- 新增本地用户权限、工业配方管理、Recipe 下载结果明细和关键操作 Audit Log 持久化能力。
- 新增 OPC UA 协议适配器、OPC UA Simulator、协议切换配置、subscription 采集链路、性能 profile 和长期运行 smoke profile。

### Changed

- 将应用默认语言明确为中文，并为英文演示保留可切换文案和中文回退。
- 明确 release version 以 `package.json` 的稳定 SemVer 为唯一来源，并要求 changelog 顶部版本与 package 版本保持一致。

### Build

- 补强 GitHub Release workflow：release title 使用 `v<version>`，发布后在既有 `dev` 分支准备下一开发版本。
- 统一项目 Yarn 工具链，并修复 `better-sqlite3` 在 Electron dev/test 入口之间的 native ABI 重编译流程。
- 固定 `node-opcua` 传递依赖 `hexy` 的 CommonJS 兼容版本，避免 Electron 主进程加载 OPC UA runtime 时触发 ESM require 错误。

### Notes

- 当前版本支持连接本项目模拟 PLC 验证 Modbus TCP / OPC UA 链路、实时监控、报警、历史数据、趋势分析、配方下载、权限和审计；所有能力仍限定为学习和模拟项目，不代表真实生产现场 Safety System。
