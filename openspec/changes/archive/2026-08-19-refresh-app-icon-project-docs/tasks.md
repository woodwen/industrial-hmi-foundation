## 1. Scope and Existing Context

- [x] 1.1 阅读本 change 的 `proposal.md`、`design.md`、全部 `specs/**/spec.md`，确认本期只包含图标、README、使用说明书、项目说明书、版本说明和验证。
- [x] 1.2 复查现有 `README.md`、`CHANGELOG.md`、`src/renderer/help/manual.ts`、`src/renderer/help/changelog.ts` 和相关测试。
- [x] 1.3 复查 Electron Builder 当前配置和图标资产目录，确认不误改 `appId`、`productName`、artifact 命名和 GitHub Releases 配置。
- [x] 1.4 确认附件 `/Users/mac/Downloads/tb2.png` 可读取，且只作为图标视觉素材来源。
- [x] 1.5 确认本期不新增工业通信运行时能力，不实现 Modbus RTU 串口通信。
- [x] 1.6 按用户确认的默认建议实施：不改应用名称、不默认升版本、README 只做入口摘要、项目说明书承载 17 个问答、中文文档为主、英文 Help 同步准确摘要。

## 2. Application Icon

- [x] 2.1 建立图标资源目录，使用附件生成项目源图标 `build/icon.png`。
- [x] 2.2 生成 macOS 图标 `build/icon.icns`。
- [x] 2.3 生成 Windows 图标 `build/icon.ico`。
- [x] 2.4 更新 Electron Builder 配置，显式引用应用图标。
- [x] 2.5 增加或更新打包配置测试，验证图标路径、图标文件存在性和项目身份配置不变。
- [x] 2.6 确认图标生成产物不依赖 `/Users/mac/Downloads` 运行时路径。

## 3. Project Manual

- [x] 3.1 新增 `docs/project-manual.md`，说明项目开发目的、学习/工程实践定位和自动化恒温混料设备场景。
- [x] 3.2 说明项目解决的问题：工业 HMI 分层、协议抽象、实时数据、设备状态、控制、报警、历史趋势、配方、权限、审计和面试演示。
- [x] 3.3 增加模拟协议与真实协议映射表，覆盖 Modbus TCP Simulator、OPC UA Simulator，并明确 Modbus RTU 当前未实现 runtime。
- [x] 3.4 回答“怎么和 PLC / 设备通信？”。
- [x] 3.5 回答“Modbus TCP / RTU 是什么？”。
- [x] 3.6 回答“OPC UA 是什么？”。
- [x] 3.7 回答“怎么做周期采集？”。
- [x] 3.8 回答“1000 个点位怎么处理？”。
- [x] 3.9 回答“设备断线怎么办？”。
- [x] 3.10 回答“怎么避免 UI 被通信阻塞？”。
- [x] 3.11 回答“实时数据怎么刷新？”。
- [x] 3.12 回答“怎么做报警？”。
- [x] 3.13 回答“历史趋势怎么保存？”。
- [x] 3.14 回答“如何控制 PLC？”。
- [x] 3.15 回答“怎么防止重复下发命令？”。
- [x] 3.16 回答“PLC 通信线程和 UI 怎么隔离？”。
- [x] 3.17 回答“如何处理设备异常、超时、重连？”。
- [x] 3.18 回答“配方是什么？”。
- [x] 3.19 回答“点位 Tag 是怎么管理的？”。
- [x] 3.20 回答“操作员、工程师权限怎么区分？”。
- [x] 3.21 回答“怎么记录操作日志？”。
- [x] 3.22 在项目说明书中加入 Demo、验证命令、Known Limitations 和真实生产落地仍需补充的工程工作。

## 4. README, Help Manual, and Version Notes

- [x] 4.1 更新 `README.md`，加入新图标/品牌说明、项目说明书入口、协议映射摘要和关键问答入口。
- [x] 4.2 更新 README 的快速运行、Simulator、Testing 和 Known Limitations，确保与当前 package scripts 和实现一致。
- [x] 4.3 更新应用内中文使用说明书，覆盖设备连接、Tag Quality、断线重连、报警、历史趋势、配方、权限、审计和模拟边界。
- [x] 4.4 更新应用内英文使用说明书摘要，避免与中文默认内容和当前实现不一致。
- [x] 4.5 更新 `CHANGELOG.md` 顶部当前 `Unreleased / 0.1.1` 版本区块，记录图标替换和文档升级；不默认修改 `package.json` version。
- [x] 4.6 确认应用内版本更新说明可以展示新增 changelog 条目。

## 5. Tests and Verification

- [x] 5.1 增加或更新 README / 项目说明书内容测试，覆盖项目说明书入口、协议映射、17 个问题和 Safety System 非目标声明。
- [x] 5.2 增加或更新 Help 渲染测试，覆盖使用说明书新增内容。
- [x] 5.3 增加或更新 changelog / 版本更新说明测试，覆盖新增版本说明条目。
- [x] 5.4 增加或更新图标和 Electron Builder 配置测试，覆盖 `icon.png`、`icon.icns`、`icon.ico` 和配置引用。
- [x] 5.5 运行 `openspec validate refresh-app-icon-project-docs --strict`。
- [x] 5.6 运行 `openspec validate --all --strict`。
- [x] 5.7 运行 `git diff --check`。
- [x] 5.8 运行 `yarn typecheck`。
- [x] 5.9 运行 `yarn lint`。
- [x] 5.10 运行 `yarn test`。
- [x] 5.11 运行 `yarn build`。
- [x] 5.12 汇报所有 validation/test/build 结果，不自动 commit、push 或 archive。
