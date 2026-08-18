# Changelog

所有用户可见变更都记录在此文件中。当前版本区块同时作为应用内版本更新说明和 GitHub Release notes 的来源。

## Unreleased / 0.1.1

### Added

- 建立 Industrial HMI Foundation 的产品可交付基础：中英文 UI、应用内帮助、版本更新说明、检查更新和 GitHub Release 打包发布流程。
- 新增根目录 `AGENTS.md`、`README.md` 和 `CHANGELOG.md`，补齐协作说明、项目说明和版本记录来源。

### Changed

- 将应用默认语言明确为中文，并为英文演示保留可切换文案和中文回退。
- 明确 release version 以 `package.json` 的稳定 SemVer 为唯一来源，并要求 changelog 顶部版本与 package 版本保持一致。

### Build

- 补强 GitHub Release workflow：release title 使用 `v<version>`，发布后在既有 `dev` 分支准备下一开发版本。

### Notes

- 当前版本仍是工业 HMI 基础架构和页面骨架，不包含真实 Modbus、OPC UA、设备连接、采集、报警、历史趋势或配方执行。
