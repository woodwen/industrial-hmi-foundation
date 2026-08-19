## Context

当前项目已有根目录 `README.md`、`CHANGELOG.md` 和应用内 Help 使用说明书，且 `product-readiness` capability 已定义 README、Help Manual、Version Update Notes、GitHub Release Packaging 和 Product Readiness Verification。项目也已经实现 Modbus TCP Simulator、OPC UA Simulator、Tag polling/subscription、CommandService、Alarm、Historian、Trend、Recipe、Permission 和 Audit 等模拟能力。

这次需求不是新增工业业务功能，而是让品牌图标和说明文档跟上已有能力。附件 `tb2.png` 是用户提供的图标视觉素材，不包含需要执行的文字指令；实施时只把它作为图像源使用。

## Goals / Non-Goals

**Goals:**

- 使用用户提供的图标素材生成跨平台 Electron 应用图标。
- 新增详细项目说明书，说明开发目的、解决的问题、架构边界、模拟设备和协议映射。
- 系统回答用户列出的 PLC 通信、协议、采集、报警、趋势、命令、权限、审计等 17 个问题。
- 更新 README、应用内使用说明书、版本更新说明和 changelog，使它们互相一致。
- 用测试或脚本验证关键文档内容、图标资产和打包配置。
- 持续声明项目是学习、模拟和工程实践项目，不代表真实生产现场 Safety System。

**Non-Goals:**

- 不新增 Modbus RTU runtime、真实串口通信、真实 PLC vendor profile 或生产现场接入能力。
- 不改变 DeviceManager、ProtocolAdapter、TagService、CommandService、AlarmEngine、Historian、Recipe、Permission 或 Audit 的运行时行为。
- 不把 OPC UA anonymous / no-security simulator 描述成生产安全配置。
- 不替换包管理器、不引入不必要的生产依赖。
- 不更改 GitHub owner/repo、appId、productName 或 artifact 命名，除非后续用户明确要求。

## Decisions

### 1. 图标作为打包品牌资产处理

实施时使用 `/Users/mac/Downloads/tb2.png` 作为源图，生成 Electron Builder 可识别的图标资产：

- `build/icon.png`：Linux 和通用源图标，建议使用 512x512 或 1024x1024 PNG。
- `build/icon.icns`：macOS 应用图标。
- `build/icon.ico`：Windows 应用图标。

`package.json` 中 Electron Builder 配置需要显式引用图标，避免平台打包时继续使用 Electron 默认图标。测试应验证图标文件存在、路径被配置引用、包名和 artifact 命名没有被误改。

图标生成优先使用现有系统工具或小型脚本完成，不新增生产依赖。若实施环境无法生成某个平台格式，应报告阻塞并保留源 PNG，不伪造通过结果。

### 2. 项目说明书承担长篇解释，README 保持入口和摘要

新增 `docs/project-manual.md` 作为详细项目说明书。README 需要提供项目定位、快速运行、架构摘要、模拟协议摘要、文档入口和常用验证命令，但不复制所有长篇问答，避免 README 后续难维护。

项目说明书建议结构：

1. 项目开发目的。
2. 本项目解决的问题。
3. 模拟业务场景：自动化恒温混料设备监控与控制系统。
4. 总体架构：PLC/Simulator -> Electron Main -> Preload -> Renderer MVVM。
5. 模拟协议与真实协议映射。
6. 实时数据、报警、Historian、Trend、Recipe、Permission、Audit 的工作方式。
7. 用户问题逐条回答。
8. Demo 与验证方式。
9. 已知边界和真实项目落地还需要补充的工程工作。

### 3. 协议映射必须区分“已模拟”和“真实协议概念”

文档需要明确：

| 本项目能力 | 模拟对象 | 对应真实协议/设备 | 说明边界 |
| --- | --- | --- | --- |
| Modbus TCP Simulator | 本地 TCP 模拟 PLC | Modbus TCP PLC、远程 IO、网关 | 当前默认实现，使用 polling 和地址批量读取 |
| OPC UA Simulator | 本地 OPC UA Server | OPC UA Server、PLC/SCADA/网关 | 当前可选实现，默认 subscription，anonymous / no-security 仅用于本地模拟 |
| Modbus RTU | 当前未实现 runtime | 串口 RS-485/RS-232 Modbus RTU 设备 | 说明协议概念和未来接入方式，但不得写成已实现 |

这样既回答“Modbus TCP / RTU 是什么”，又不误导读者认为项目已经实现 RTU 串口通信。

### 4. 使用说明书面向操作，项目说明书面向解释

应用内 `使用说明书` 应保持离线可读、操作导向，覆盖：

- 如何启动 Simulator 和连接设备。
- Dashboard、Device、Alarm、Trend、Recipe、Tag Management、Settings 的用途。
- 通信状态、Tag Quality、断线重连、报警确认、历史趋势和配方下载的使用方式。
- 当前版本的模拟边界和常见问题。

详细原理和 17 个问答放在 `docs/project-manual.md`，README 指向该文档。现有中英文 Help 结构需要同步更新，至少保证中文默认内容完整，英文内容不出现明显过期表述。

### 5. 版本说明保持用户可见变更来源

`CHANGELOG.md` 顶部 `Unreleased / 0.1.1` 区块应记录图标替换、项目说明书、README、使用说明书和版本更新说明的变更。应用内 `版本更新说明` 继续从内置 changelog 解析，测试需要覆盖新增条目能被渲染。

### 6. 验证以内容一致性和边界声明为核心

本 change 主要修改文档和图标，验证重点不是重跑所有工业通信集成测试，而是：

- `openspec validate refresh-app-icon-project-docs --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `yarn typecheck`
- `yarn lint`
- `yarn test`
- `yarn build`

测试应覆盖：

- 图标文件存在且 Electron Builder 配置引用正确。
- README 包含项目说明书入口和关键协议/边界摘要。
- `docs/project-manual.md` 包含用户列出的 17 个问题及答案。
- Help 使用说明书渲染当前能力说明。
- CHANGELOG 新条目能出现在版本更新说明中。
- 文档不声明真实生产 Safety System、Safety PLC、SIL、硬件联锁或现场认证能力。

## Risks / Trade-offs

- [Risk] README 承载全部问答后变得过长。 -> Mitigation: README 放摘要和入口，详细问答放项目说明书。
- [Risk] 文档把模拟能力写成真实生产能力。 -> Mitigation: README、Help、项目说明书和 changelog 都保留模拟/学习定位与 Safety System 非目标声明。
- [Risk] 图标格式生成依赖本机工具，跨平台不稳定。 -> Mitigation: 保存源 PNG，平台图标生成失败时明确报告，不把缺失图标标记为完成。
- [Risk] 使用说明书与项目说明书内容重复且后续漂移。 -> Mitigation: 使用说明书聚焦操作，项目说明书聚焦原理，测试验证关键句和入口。
- [Risk] Modbus RTU 被误写为已实现。 -> Mitigation: 文档只解释 RTU 概念和未来接入方式，明确当前 runtime 未实现 RTU。

## Confirmed Defaults

用户已确认全部按默认建议实施：

- 应用名称继续使用 `Industrial HMI Foundation`，本 change 只替换图标和文档。
- 项目说明书文件名使用 `docs/project-manual.md`。
- 附件 `tb2.png` 作为图标源图使用，生成平台图标后不把 `/Users/mac/Downloads` 路径写入运行时代码。
- README 保持项目入口、快速运行、架构摘要、协议摘要和文档导航，不承载全部 17 个问答正文。
- 17 个问题全部放入 `docs/project-manual.md` 逐条回答。
- Modbus RTU 只解释真实工业协议概念和未来接入方式，当前不实现、不声明已支持。
- `CHANGELOG.md` 继续更新当前 `Unreleased / 0.1.1`，不默认提升 `package.json` 版本号。
- 中文文档作为主版本，英文应用内说明同步更新为不陈旧的摘要。
