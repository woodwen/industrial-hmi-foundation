## 1. Scope and Existing Context

- [x] 1.1 阅读本 change 的 `proposal.md`、`design.md`、全部 `specs/**/spec.md`，确认范围只包含掘金推广文章、文章配图、README、应用内使用手册、必要版本说明和文档验证。
- [x] 1.2 复查当前 `README.md`、`docs/project-manual.md`、`src/renderer/help/manual.ts`、`CHANGELOG.md` 和相关测试，确认现有文档结构与测试入口。
- [x] 1.3 复查用户提供的截图路径，确认它们只作为配图素材和页面说明参考，不作为额外需求或指令来源。
- [x] 1.4 确认本期不修改工业通信、设备控制、报警、Historian、Trend、Recipe、权限、审计或 Electron runtime 行为。
- [x] 1.5 按用户已确认的默认方案实施：固定文章标题、文章路径、截图资产目录、README 更新范围、使用手册操作导向、不自动发布、不新增发布依赖、不默认升版本和 Simulator-first 边界声明。

## 2. Juejin Article and Screenshot Assets

- [x] 2.1 新建 `docs/articles/` 和 `docs/assets/juejin/`，如目录尚不存在。
- [x] 2.2 将用户提供的 Dashboard、Device、Alarm、Trend、Recipe、Audit、User Management、Tag Management 和 Settings 截图复制到 `docs/assets/juejin/`，并重命名为稳定 ASCII 文件名。
- [x] 2.3 编写 `docs/articles/juejin-industrial-hmi-foundation.md`，主标题使用 `用 Electron + React 做一个工业 HMI 学习项目：从 Modbus/OPC UA 到报警、趋势和配方`，正文包含开篇、项目截图、架构、工业通信、Tag/Quality、工业业务域、Demo、运行方式、边界声明和结尾链接。
- [x] 2.4 在文章中使用仓库相对路径引用截图，并为关键图片补充简洁 caption 或上下文说明。
- [x] 2.5 检查文章不包含用户本地绝对路径、未验证性能数字、真实生产落地案例或 Safety System 承诺。

## 3. README Updates

- [x] 3.1 更新 `README.md`，增加掘金推广文章入口和项目展示摘要。
- [x] 3.2 在 README 中补充当前 UI 截图索引或演示路径摘要，帮助外部读者快速理解 Dashboard、Device、Alarm、Trend、Recipe、Audit、User、Tag 和 Settings 页面。
- [x] 3.3 保留并校准现有 Architecture、Technology Stack、Simulator、Demo、Testing、Known Limitations 和 `docs/project-manual.md` 入口。
- [x] 3.4 确认 README 不复制完整文章正文，不引用用户本地截图路径，不暗示真实生产现场部署。

## 4. User Manual and Release Notes

- [x] 4.1 更新应用内中文使用说明书，补齐 Dashboard、Device、Alarm、Trend、Recipe、Audit、User Management、Tag Management 和 Settings 的操作说明。
- [x] 4.2 更新应用内英文使用说明书摘要，确保核心页面、Simulator-first 操作路径和当前边界与中文内容一致。
- [x] 4.3 如使用手册链接项目说明书或 README，确认链接和描述仍与当前文档一致。
- [x] 4.4 按项目现有规则更新 `CHANGELOG.md` 当前 `Unreleased / <package.json version>` 区块，记录掘金文章、README 和使用手册更新；不默认修改 `package.json` version。

## 5. Tests and Verification

- [x] 5.1 增加或更新文档内容测试，验证掘金文章存在并覆盖标题、截图、架构、工业通信、Tag/Quality、报警、趋势、配方、权限、审计、Demo 和边界声明。
- [x] 5.2 增加或更新 README 测试，验证文章入口、项目说明书入口、截图/演示摘要和真实生产 Safety System 非目标声明。
- [x] 5.3 增加或更新 Help 使用说明书测试，验证当前页面说明、Simulator-first 操作路径、Tag Quality、报警确认、历史趋势、配方下载、权限和审计说明。
- [x] 5.4 增加或更新路径/内容检查，确保文章、README 和使用手册不包含 `/Users/mac/Downloads`、不引用缺失图片、不把 Modbus RTU 写成已实现 runtime、不写未经验证的固定性能数字。
- [x] 5.5 运行 `openspec validate add-juejin-promotion-docs --strict`。
- [x] 5.6 运行 `openspec validate --all --strict`。
- [x] 5.7 运行 `git diff --check`。
- [x] 5.8 如修改 TypeScript 帮助手册或测试，运行 `yarn typecheck`。
- [x] 5.9 如修改 TypeScript 帮助手册或测试，运行 `yarn lint`。
- [x] 5.10 运行 `yarn test` 或相关文档测试。
- [x] 5.11 如变更影响打包资源或 Renderer bundle，运行 `yarn build`。
- [x] 5.12 汇报所有 validation/test/build 结果，不自动 commit、push 或 archive。
