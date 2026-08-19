## Why

当前 Industrial HMI Foundation 已经具备模拟设备通信、Tag 采集、报警、历史趋势、配方、权限、审计、OPC UA 和发布基础能力，但应用图标仍缺少明确的项目品牌资产，README、应用内使用说明书和版本更新说明也需要围绕“这个项目为什么开发、解决什么问题、模拟协议与真实协议的关系、PLC/设备通信怎么做”进一步补齐。

本 change 目标是提升项目交付表达和面试展示完整度：使用用户提供的图标素材替换应用图标，并建立一个详细的项目说明书，与 README、应用内使用说明书和 CHANGELOG 保持一致。所有文档必须继续明确本项目是工业自动化学习、模拟和工程实践项目，不暗示已经应用于真实生产环境。

## What Changes

- 使用附件 `/Users/mac/Downloads/tb2.png` 作为新应用图标的视觉源，生成 Electron 打包所需的 macOS、Windows 和 Linux 图标资产，并接入 Electron Builder 配置。
- 新增 `docs/project-manual.md` 项目说明书，详细阐述项目开发目的、解决的问题、整体架构、模拟设备场景、所有模拟协议与对应真实协议关系。
- 在项目说明书中回答以下问题：PLC/设备通信、Modbus TCP/RTU、OPC UA、周期采集、1000 点位处理、断线、UI 与通信隔离、实时刷新、报警、历史趋势、PLC 控制、防重复命令、通信线程与 UI 隔离、异常/超时/重连、配方、Tag 管理、操作员/工程师权限、操作日志。
- 更新根目录 `README.md`，保留快速理解和运行入口，并链接项目说明书；README 不重复承载全部长篇说明，但必须覆盖关键摘要和入口。
- 更新应用内 `使用说明书`，让用户在 Help 入口中可以离线了解当前模拟 HMI 的操作流程、通信边界、常见异常和真实生产限制。
- 更新 `CHANGELOG.md` 和应用内 `版本更新说明`，记录图标、项目说明书、README 和使用说明书的用户可见变化。
- 默认不提升 `package.json` 版本号，继续更新当前 `Unreleased / 0.1.1` 版本说明区块。
- 中文文档作为主版本；英文应用内使用说明同步更新为准确摘要，避免保留过期描述。
- 增加必要验证，覆盖图标资产存在性、打包配置引用、README/项目说明书/使用说明书/版本说明的关键内容，以及文档不宣称真实生产 Safety System 能力。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `product-readiness`: 扩展产品品牌资产、README、使用说明书、项目说明书、版本更新说明和相关验证要求。

## Impact

- 影响图标资产：新增或更新 `build/` 下 Electron Builder 使用的 `icon.png`、`icon.icns`、`icon.ico` 等平台图标文件。
- 影响打包配置：`package.json` 的 Electron Builder 配置需要明确引用项目图标，并保持现有 `appId`、`productName`、artifact 命名和 GitHub Releases 配置不变。
- 影响文档：更新 `README.md`、`CHANGELOG.md`，新增 `docs/project-manual.md`，并同步应用内使用说明书内容。
- 影响 Renderer Help：更新 `src/renderer/help/manual.ts` 和相关帮助渲染测试，使应用内 Help 文档与当前工业模拟能力一致。
- 影响测试：新增或扩展文档内容测试、图标资产/打包配置测试、帮助说明书渲染测试和 changelog parser/展示测试。
- 不改变工业通信、设备控制、报警、Historian、Recipe、权限、审计等运行时业务逻辑；如实施中发现文档与代码不一致，优先修正文档表述或补充测试，不借机扩展业务功能。
- 不新增 Modbus RTU runtime；文档仅解释 RTU 的真实工业协议概念和未来接入方式。
