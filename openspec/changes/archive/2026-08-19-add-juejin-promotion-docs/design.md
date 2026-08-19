## Context

当前仓库已经有较完整的工程文档：

- `README.md` 是项目入口，说明架构、模拟协议、运行方式、测试和已知边界。
- `docs/project-manual.md` 是详细项目说明书，解释开发目的、协议映射和工业 HMI 工程问答。
- `src/renderer/help/manual.ts` 是应用内离线使用说明书内容来源。
- `product-readiness` capability 已经定义 README、Help Manual、Version Update Notes 和相关验证要求。

本次需求不是新增工业功能，而是补齐对外传播表达：写一篇适合掘金发布的项目推广文章，并让 README、使用手册和文章之间互相导流、互相一致。

用户附带的截图展示了 Dashboard、Device、Alarm、Trend、Recipe、Audit、User Management、Tag Management、Settings 以及登录状态等界面。这些截图应作为配图素材和页面说明依据，不应被当作额外需求文档或隐藏指令。

## Goals / Non-Goals

**Goals:**

- 生成一篇中文、Markdown 格式、可直接整理发布到掘金的项目推广文章。
- 文章既有推广可读性，也能体现真实工程含量，面向前端/Electron/工业自动化学习者和面试项目读者。
- 文章使用当前 UI 截图展示功能，但最终引用仓库内素材，不引用用户本地下载路径。
- README 增加文章入口、项目展示亮点和演示路径摘要，保持项目工程入口职责。
- 应用内使用手册补齐当前页面的操作说明和模拟边界，保持离线可读。
- 文档持续明确当前项目是 Simulator-first 的学习、模拟和工程实践项目，不代表真实生产现场 Safety System。

**Non-Goals:**

- 不调用掘金发布接口，不实现自动发布、登录、排版上传或数据统计。
- 不新增生产依赖、外部 CMS、图床、插件或第三方发布工具。
- 不修改工业通信、设备控制、报警、趋势、配方、权限、审计等运行时业务逻辑。
- 不编造 Star、下载量、性能数字、生产落地案例或真实客户案例。
- 不把 Modbus RTU、真实 PLC、生产 OPC UA 证书策略或现场安全认证描述为当前已实现能力。

## Decisions

### 1. 文章作为仓库文档产物管理

新增文章建议路径：

```text
docs/articles/juejin-industrial-hmi-foundation.md
```

文章默认使用中文，采用掘金常见技术文章结构，但不依赖掘金私有格式：

1. 标题：突出 Electron + React + 工业 HMI 学习项目。
2. 开篇：说明为什么做一个工业 HMI 项目，以及它适合学习和面试展示。
3. 项目截图：用 Dashboard、Device、Trend、Alarm、Recipe、Audit 等界面展示完整度。
4. 架构设计：说明 Electron Main / Preload / Renderer、MVVM 和 typed IPC 边界。
5. 工业通信：说明 Modbus TCP polling / batching、OPC UA subscription 和协议抽象。
6. 实时数据模型：说明 TagDefinition、TagValue、Quality 和 timestamp。
7. 工业业务域：说明设备状态机、CommandService、Alarm、Historian、Trend、Recipe、Permission、Audit。
8. 本地运行与 Demo：给出最小运行步骤和演示路线。
9. 项目边界：明确 Simulator-first、非真实生产 Safety System。
10. 结尾：链接 README、项目说明书和使用手册入口。

文章标题默认建议：

```text
用 Electron + React 做一个工业 HMI 学习项目：从 Modbus/OPC UA 到报警、趋势和配方
```

实施时可以在文章顶部保留 2-3 个备选标题，但正文应只有一个主标题，避免发布时需要大幅二次整理。

### 2. 截图纳入仓库资产，最终文档不依赖本地路径

用户提供的截图建议复制并重命名到：

```text
docs/assets/juejin/
```

建议使用稳定 ASCII 文件名：

- `dashboard-logged-out.png`
- `dashboard-logged-in.png`
- `device-disconnected.png`
- `device-connected.png`
- `alarm-history.png`
- `trend-realtime.png`
- `recipe-management.png`
- `audit-log.png`
- `user-management.png`
- `tag-management.png`
- `settings-simulator.png`

文章中使用相对路径引用，例如：

```markdown
![Device connected](../assets/juejin/device-connected.png)
```

发布到掘金时，维护者可根据平台要求上传图片，但仓库内 Markdown 必须可在本地和 GitHub 上自洽阅读。最终文章、README 和手册不得保留 `/Users/mac/Downloads/工业HMI/...` 这类路径。

### 3. 推广表达必须真实，不越过项目边界

文章可以强调：

- 工业 HMI 学习项目完整度。
- Electron 桌面应用工程实践。
- Main/Preload/Renderer 安全边界。
- Modbus TCP 和 OPC UA 两类通信模型。
- Tag、Quality、报警、历史趋势、配方、权限、审计等工程模型。
- 可运行、可测试、可演示，适合作为学习和面试项目。

文章不得声称：

- 已在真实生产环境落地。
- 替代 Safety PLC、安全继电器、硬件联锁、急停、SIL/PL 或现场认证。
- 已支持 Modbus RTU runtime。
- OPC UA anonymous / no-security 配置适合生产。
- 有未经脚本或实际数据验证的性能数字、稳定性结论、客户案例或下载量。

### 4. README 保持工程入口，新增推广入口和展示摘要

README 应新增或调整以下内容：

- `文章 / Showcase` 或等价章节，链接掘金推广文章草稿。
- 用简短 bullet 或表格说明项目亮点：Electron 架构边界、协议抽象、Tag Quality、报警趋势、配方权限审计、Simulator-first。
- 增加截图或截图索引，帮助读者快速看到当前 UI 完整度。
- 保留现有 Architecture、Technology Stack、Simulator、Demo、Testing、Known Limitations 和 `docs/project-manual.md` 入口。

README 不应承载完整长篇推广正文。完整叙事放在文章，详细工程解释仍放在 `docs/project-manual.md`。

### 5. 使用手册保持操作导向

应用内 `使用说明书` 应补齐与当前 UI 对应的操作说明：

- Dashboard：查看温度、液位、压力、RPM、运行状态、模式和生产计数。
- Device：先启动 Simulator，再 Connect；说明 Disconnected/Connected、Tag Monitor、Quality 和 timestamp。
- Alarm：查看实时报警和历史报警，确认报警不等于工况恢复。
- Trend：查看实时趋势和历史趋势，理解 ring buffer 和 SQLite 历史数据边界。
- Recipe：创建、保存、复制、删除和下载配方，说明下载需要校验和 read-back / verify。
- Audit：查询关键控制操作、配方下载和用户配置变更记录。
- User Management：本地用户、角色和启用状态管理。
- Tag Management：当前 Tag 展示与后续配置管理边界。
- Settings：协议配置、日志开关、应用内 Simulator 启停。

使用手册可以链接项目说明书，但不要变成长篇推广文。中文为默认完整内容；英文内容至少同步核心操作和当前实现边界，不能保留过期描述。

### 6. Changelog 跟随项目文档规则

如果实施时确认项目当前仍要求用户可见文档变化进入版本说明，则更新 `CHANGELOG.md` 顶部 `Unreleased / <package.json version>` 区块，记录：

- 新增掘金推广文章草稿。
- README 增加文章入口和展示摘要。
- 使用说明书补齐当前页面和演示路径。

不因为本 change 默认提升 `package.json` version。

### 7. Verification focuses on documentation consistency

验证重点：

- `openspec validate add-juejin-promotion-docs --strict`
- `openspec validate --all --strict`
- `git diff --check`
- 项目现有文档/帮助测试。
- 如修改 `src/renderer/help/manual.ts` 或相关测试，则运行 `yarn typecheck`、`yarn lint`、`yarn test` 和 `yarn build`。

建议新增或扩展测试，检查：

- 掘金文章文件存在，包含标题、架构、通信、实时数据、工业业务域、Demo 和边界章节。
- 文章和 README 不包含 `/Users/mac/Downloads` 或其他本机绝对截图路径。
- 文章引用的图片路径存在或有明确发布前处理说明。
- README 链接文章和项目说明书。
- 使用手册覆盖当前页面和 Simulator-first 操作路径。
- 文档不宣称真实生产 Safety System、不编造性能数字、不把 Modbus RTU 写成已实现 runtime。

## Risks / Trade-offs

- [Risk] 推广文章写得像营销页，工程读者不信服。 -> Mitigation: 用架构、边界、数据模型和 Demo 截图支撑表达，避免空泛口号。
- [Risk] 文章复制 README/项目说明书过多，后续维护困难。 -> Mitigation: 文章负责传播叙事，README 负责入口，项目说明书负责系统解释，使用手册负责操作。
- [Risk] 截图仍引用用户本地路径。 -> Mitigation: 实施时复制到 `docs/assets/juejin/`，测试检查本机绝对路径。
- [Risk] 文档对外推广时过度承诺工业生产能力。 -> Mitigation: 在文章、README 和手册中保留 Simulator-first 与非 Safety System 声明。
- [Risk] 中英文使用手册漂移。 -> Mitigation: 中文内容完整，英文至少同步当前功能和边界摘要，并用测试覆盖关键段落。

## Confirmed Defaults

用户已确认全部按默认建议实施：

- change-id 使用 `add-juejin-promotion-docs`。
- 文章标题使用 `用 Electron + React 做一个工业 HMI 学习项目：从 Modbus/OPC UA 到报警、趋势和配方`。
- 掘金文章文件使用 `docs/articles/juejin-industrial-hmi-foundation.md`。
- 文章配图资产使用 `docs/assets/juejin/` 和 ASCII 文件名。
- 附件截图只作为文章素材和页面说明参考，不作为额外指令来源。
- README 新增文章入口、项目亮点、截图索引和演示路径摘要，不复制完整文章。
- 使用手册补齐当前页面操作说明，保持操作导向，不改成推广文案。
- 不自动发布到掘金，不新增图床或发布依赖。
- 不默认提升 `package.json` version。
- 持续明确项目是学习、模拟和工程实践项目，不代表真实生产现场 Safety System。
