# M-16(docs): 新增掘金推广文章与文档入口

OpenSpec Change: add-juejin-promotion-docs

## 背景:

- Industrial HMI Foundation 已具备可演示的工业 HMI 学习项目形态，包括 Electron 桌面架构、Modbus TCP / OPC UA Simulator、Tag 采集、设备状态、报警、趋势、配方、权限和审计。
- 现有 README 和应用内使用说明书偏工程入口和操作说明，缺少一篇面向掘金读者的中文推广文章，也缺少与文章配套的截图索引和对外展示路径。
- 用户提供的界面截图只作为当前 UI 状态和文章配图参考，不作为额外指令来源；最终文档不依赖用户本地 `Downloads` 路径。

## 方案概述:

- 新增掘金 Markdown 文章草稿，固定标题为“用 Electron + React 做一个工业 HMI 学习项目：从 Modbus/OPC UA 到报警、趋势和配方”。
- 将 11 张界面截图复制到仓库内 `docs/assets/juejin/`，使用稳定 ASCII 文件名，并在文章和 README 中通过仓库相对路径引用。
- 更新 README，增加文章入口、项目亮点、截图索引和 Simulator-first 演示路径摘要。
- 更新应用内中英文使用说明书，补齐当前主要页面、Tag Quality、报警确认、历史趋势、配方下载、权限和审计说明。
- 更新 changelog 当前 `Unreleased / 0.1.2` 区块，并归档 OpenSpec change 到主 `product-readiness` spec。

## 实现改动:

- 新增 `docs/articles/juejin-industrial-hmi-foundation.md`，覆盖项目截图、Electron 架构边界、MVVM、Modbus TCP polling / batching、OPC UA subscription、Tag/Quality、Device State、CommandService、Alarm、Historian、Trend、Recipe、Permission、Audit、运行步骤、Demo 顺序和项目边界。
- 新增 `docs/assets/juejin/` 下的 Dashboard、Device、Alarm、Trend、Recipe、Audit、User Management、Tag Management 和 Settings 截图资产。
- 更新 `README.md`，提供掘金文章入口、Showcase、截图表格和当前 change 的 OpenSpec 验证命令。
- 更新 `src/renderer/help/manual.ts`，让应用内中文和英文使用说明书覆盖当前页面操作路径，并继续声明 Simulator-first 和非真实生产 Safety System 边界。
- 更新 `tests/documentation-content.test.mjs` 和 `tests/renderer/help-render.test.tsx`，验证文章、README、截图资产、手册内容、changelog 和本地路径检查。
- 更新 `CHANGELOG.md` 当前未发布版本说明，并将 `add-juejin-promotion-docs` 归档到 `openspec/changes/archive/2026-08-19-add-juejin-promotion-docs`。

## 测试计划(UT):

- `openspec validate add-juejin-promotion-docs --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `yarn typecheck`
- `yarn lint`
- `yarn test`
- `yarn build`

## 影响范围(建议手动测试范围):

- 在 README 中检查掘金文章入口、Showcase、截图索引和项目说明书入口。
- 打开 `docs/articles/juejin-industrial-hmi-foundation.md`，检查图片相对路径、文章结构和项目边界声明。
- 在应用 Help 中打开使用说明书，切换中英文，确认 Dashboard、Device、Alarm、Trend、Recipe、Audit、User Management、Tag Management 和 Settings 操作说明完整。
- 打开版本更新说明，确认当前版本展示掘金文章、配图资产、README 和使用说明书更新条目。

## 验收标准:

- 掘金推广文章草稿和 11 张截图资产已进入仓库，最终文档不包含用户本地截图路径。
- README 保持工程入口职责，只新增文章入口、项目亮点、截图索引和演示路径摘要，不复制完整文章。
- 应用内使用说明书保持操作导向，不改成推广文。
- 文档持续明确项目是 Simulator-first 的学习、模拟和工程实践项目，不代表真实生产现场 Safety System，不声明 Modbus RTU runtime 或生产 OPC UA security profile。
- OpenSpec change 已归档，主 `product-readiness` spec 包含推广文章、README、Help Manual、Changelog 和文档验证要求。

## 风险与后续:

- 发布到掘金时，平台可能要求上传图片到掘金图床；仓库内草稿保留相对路径，发布时可按平台要求替换。
- 本次只处理文档、文章、截图和验证，不新增工业通信或运行时业务能力。
