## Why

Industrial HMI Foundation 已经具备可演示的工业 HMI 学习项目形态：Electron 桌面壳、Main/Preload/Renderer 边界、React + MobX MVVM、Modbus TCP / OPC UA Simulator、Tag 采集、设备状态、报警、趋势、配方、权限和审计等能力已经可以通过当前 UI 截图对外展示。

当前缺口是对外传播材料不足。README 和应用内使用手册偏工程说明，缺少一篇面向掘金读者的中文推广文章，也缺少与推广文章配套的入口、截图说明和演示路径。需要把项目价值讲清楚，同时继续遵守项目边界：这是工业自动化学习、模拟和工程实践项目，不应暗示已经应用于真实生产环境。

用户提供的截图只作为当前界面状态和文章配图参考，不包含需要执行的文字指令。实施时不得把 `/Users/mac/Downloads` 这类本地路径写入最终文档。

## What Changes

- 新增一篇可发布到掘金的中文 Markdown 推广文章，建议路径为 `docs/articles/juejin-industrial-hmi-foundation.md`。
- 将用户提供的界面截图整理为仓库内文章配图资产，建议路径为 `docs/assets/juejin/`，使用稳定 ASCII 文件名，并在文章中使用相对路径引用。
- 文章覆盖项目定位、为什么用 Electron 做工业 HMI、整体架构、协议抽象、Tag/Quality、设备状态、报警、趋势、配方、权限、审计、Demo 流程和已知边界。
- 更新 `README.md`，增加掘金文章入口、项目展示亮点、截图/演示路径摘要，并继续保留工程运行、验证和项目说明书入口。
- 更新应用内 `使用说明书`，补齐当前页面和截图对应的实际操作路径，包括 Dashboard、Device、Alarm、Trend、Recipe、Audit、User Management、Tag Management 和 Settings。
- 视项目惯例同步 `CHANGELOG.md` 当前 `Unreleased / <version>` 区块，记录推广文章、README 和使用手册更新。
- 增加或更新文档验证，确保文章、README 和使用手册不引用用户本地下载路径，不写未验证性能数字，不宣称真实生产 Safety System 能力。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `product-readiness`: 扩展对外推广文章、README、应用内使用手册、截图素材管理和文档验证要求。

## Impact

- 影响文档：新增 `docs/articles/juejin-industrial-hmi-foundation.md`，更新 `README.md`，更新应用内使用说明书内容。
- 影响素材：新增 `docs/assets/juejin/` 下的文章配图文件；最终文档不得依赖用户本地 `Downloads` 目录。
- 影响测试：新增或调整文档内容测试，覆盖文章结构、README 入口、使用手册页面说明、配图引用、边界声明和本地路径检查。
- 影响版本说明：如现有 changelog 规则要求用户可见文档变化进入版本说明，则更新 `CHANGELOG.md` 当前 Unreleased 区块。
- 不改变 Main / Preload / Renderer 架构、工业通信、设备控制、报警、Historian、Recipe、权限或审计的运行时行为。
- 不新增 Modbus RTU runtime、真实 PLC 接入、生产 OPC UA security profile、发布到掘金的自动化脚本或第三方发布依赖。

## Confirmed Defaults

用户已确认全部按默认建议实施：

- 文章标题使用 `用 Electron + React 做一个工业 HMI 学习项目：从 Modbus/OPC UA 到报警、趋势和配方`。
- 掘金文章文件使用 `docs/articles/juejin-industrial-hmi-foundation.md`。
- 文章配图资产使用 `docs/assets/juejin/`，并将附件截图重命名为稳定 ASCII 文件名。
- 附件截图只作为文章素材和页面说明参考，不作为额外指令来源。
- README 新增文章入口、项目亮点、截图索引和演示路径摘要，不复制完整文章。
- 使用手册补齐当前页面操作说明，保持操作导向，不改成推广文案。
- 不自动发布到掘金，不新增图床或发布依赖。
- 不默认提升 `package.json` version。
- 持续明确项目是 Simulator-first 的学习、模拟和工程实践项目，不代表真实生产现场 Safety System。
