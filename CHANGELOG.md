# Changelog

所有用户可见变更都记录在此文件中。当前版本区块同时作为应用内版本更新说明和 GitHub Release notes 的来源。

## Unreleased / 0.1.1

### Added

- 建立 Industrial HMI Foundation 的产品可交付基础：中英文 UI、应用内帮助、版本更新说明、检查更新和 GitHub Release 打包发布流程。
- 新增根目录 `AGENTS.md`、`README.md` 和 `CHANGELOG.md`，补齐协作说明、项目说明和版本记录来源。
- 新增独立 PLC Simulator、Modbus TCP 协议适配器和 Device 页面手工连接/读写验证能力。
- 新增 Tag 模型、周期采集、TagCache、Dashboard 实时监控和 Device Tag Monitor。

### Changed

- 将应用默认语言明确为中文，并为英文演示保留可切换文案和中文回退。
- 明确 release version 以 `package.json` 的稳定 SemVer 为唯一来源，并要求 changelog 顶部版本与 package 版本保持一致。

### Build

- 补强 GitHub Release workflow：release title 使用 `v<version>`，发布后在既有 `dev` 分支准备下一开发版本。

### Notes

- 当前版本支持连接本项目模拟 PLC 验证 Modbus TCP 链路，并通过 Tag 周期采集展示实时监控数据；不包含真实生产设备采集、OPC UA、报警、历史趋势或配方执行。
