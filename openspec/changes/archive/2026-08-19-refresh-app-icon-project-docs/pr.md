# M-14(feat): 更新应用图标与项目说明文档

OpenSpec Change: refresh-app-icon-project-docs

## 背景:

- Industrial HMI Foundation 已具备模拟通信、Tag 采集、报警、历史趋势、配方、权限、审计、OPC UA 和发布基础能力，但应用图标、README、使用说明书和版本说明还没有完整表达项目目的、协议边界和工程价值。
- 本次需求要求使用附件图标，并新增项目说明书，系统回答 PLC 通信、协议、采集、报警、趋势、控制、权限和审计等问题。

## 方案概述:

- 将附件图标转为项目内跨平台打包图标资产，并让 Electron Builder 显式引用。
- 新增 `docs/project-manual.md` 承载详细项目说明和 17 个关键问答，README 保持项目入口和摘要。
- 更新应用内使用说明书、CHANGELOG 和 OpenSpec 主规格，保持文档、Help 和版本更新说明一致。
- 增加文档内容、Help 渲染、changelog 展示和打包图标配置测试。

## 实现改动:

- 新增 `build/icon.png`、`build/icon.icns`、`build/icon.ico`，并在 `package.json` 中配置 `buildResources`、通用图标和各平台图标路径。
- 新增 `docs/project-manual.md`，说明项目开发目的、解决的问题、模拟协议与真实协议映射，并逐条回答 PLC/设备通信相关问题。
- 更新 `README.md`，加入图标说明、项目说明书入口、协议映射摘要、运行命令、验证命令和 Known Limitations。
- 更新 `src/renderer/help/manual.ts`，补充 Modbus RTU 未实现、OPC UA 使用方式、Tag Quality、报警确认/恢复、历史趋势、配方、权限和 Audit 说明。
- 更新 `CHANGELOG.md` 当前 `Unreleased / 0.1.1`，记录图标、项目说明书、README、使用说明书和打包配置变化，不提升 `package.json` 版本。
- 归档 OpenSpec change 到 `openspec/changes/archive/2026-08-19-refresh-app-icon-project-docs/`，并同步 `openspec/specs/product-readiness/spec.md`。
- 新增 `tests/documentation-content.test.mjs`，更新 `tests/package-build-config.test.mjs` 和 `tests/renderer/help-render.test.tsx`。

## 测试计划(UT):

- `openspec validate refresh-app-icon-project-docs --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `yarn typecheck`
- `yarn lint`
- `yarn test`
- `yarn build`

## 影响范围(建议手动测试范围):

- 桌面安装包图标：macOS、Windows、Linux 打包后确认使用项目图标。
- README 和 `docs/project-manual.md`：确认项目定位、协议映射、RTU 未实现边界和 17 个问答表达准确。
- 应用内 Help：确认中文默认使用说明书和英文摘要能正常展示新增内容。
- 应用内版本更新说明：确认 changelog 新条目可展示。

## 风险与后续:

- 当前仅生成和引用图标资产，未实际执行跨平台 `electron-builder` 打包验收；后续发版前应分别验证 macOS、Windows 和 Linux artifact 图标显示。
- Modbus RTU 仍为未实现 runtime，仅作为真实协议概念和未来 adapter 方向说明。
