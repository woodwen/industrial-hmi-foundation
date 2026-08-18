# M-11(build): 统一项目 Yarn 工具链

背景:
- 项目在新增 SQLite Historian 后引入 `better-sqlite3`，`npm run dev` 会因 native module 与 Electron runtime 不兼容而无法稳定启动。
- 用户要求项目统一使用 Yarn，避免 npm/Yarn 混用导致锁文件、CI 和本地命令不一致。

调查结论:
- `better-sqlite3@13.0.3` 要求 Node >=22，不适配当前 `electron@33.4.11` 内置 Node 20 runtime。
- `better-sqlite3` native 产物需要按入口分别重编译：Electron dev/smoke 使用 Electron ABI，Vitest 使用当前 Node ABI。

方案概述:
- 将包管理器统一为 Yarn classic，并以 `yarn.lock` 作为唯一依赖锁文件。
- 将 `better-sqlite3` 降级到支持 Node 20 的 `^12.11.1`，并显式声明 `@electron/rebuild` 与 `node-gyp`。
- 在 Yarn scripts 中为 dev/smoke/test 入口增加对应 native rebuild，避免 ABI 状态互相污染。

实现改动:
- 更新 `package.json`：新增 `packageManager: "yarn@1.22.22"`，脚本内部切换为 `yarn`，新增 `rebuild:native:electron` 和 `rebuild:native:node`。
- 删除 `package-lock.json`，新增 `yarn.lock`。
- 更新 GitHub Release workflow：使用 `yarn install --frozen-lockfile`、`yarn typecheck`、`yarn lint`、`yarn test`、`yarn build` 和 `yarn electron-builder`。
- 修复 `scripts/smoke-start.mjs`：先 build，再直接启动 Electron main，并通过 `HMI_SMOKE_TEST=1` 验证主进程启动与退出。
- 同步 README、当前文档、帮助文案、OpenSpec 主规格和 release workflow 测试断言。
- 更新 `CHANGELOG.md` 的 Build 条目。

测试计划(UT):
- `yarn install --frozen-lockfile`
- `yarn typecheck`
- `yarn lint`
- `yarn test`
- `yarn build`
- `yarn smoke:start`
- `openspec validate --all --strict`
- `git diff --check`
- 已手动运行 `yarn dev`，确认 Electron dev app 稳定启动并输出主进程日志。

影响范围(建议手动测试范围):
- 本地开发命令：`yarn install`、`yarn dev`、`yarn test`、`yarn smoke:start`。
- CI 发布流程：validate/build job 的依赖安装、验证和 Electron Builder 打包命令。
- Native SQLite 模块：确认 dev、smoke、test 在不同 ABI 下切换后仍可正常加载 `better-sqlite3`。

风险与后续:
- Yarn 1 本地可能根据用户目录权限输出 cache/global folder warning，但当前验证不影响命令成功。
- `yarn test` 和 `yarn dev` 会重编译 `better-sqlite3`，首次运行会比纯 JS 项目慢。
