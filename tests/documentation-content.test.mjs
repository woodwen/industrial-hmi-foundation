import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const readRepoFile = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const markdownImagePattern = /!\[[^\]]*]\(([^)]+)\)/g
const localAbsolutePathPattern = /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)/
const implementedClaimPattern =
  /(?:已实现|已支持|支持|提供|具备).{0,20}(?:真实生产现场 Safety System|Modbus RTU runtime|生产 OPC UA security profile|生产 OPC UA 安全配置)/

const expectNoLocalAbsolutePaths = (content) => {
  expect(content).not.toMatch(localAbsolutePathPattern)
}

const expectBoundedIndustrialClaims = (content) => {
  expect(content).not.toMatch(implementedClaimPattern)
  expect(content).not.toMatch(/(?:客户案例|下载量|Star 数|项目 Star 数).{0,20}\d/)
}

describe('project documentation content', () => {
  it('links README to the detailed project manual and keeps README as an entry point', () => {
    const readme = readRepoFile('README.md')

    expect(readme).toContain('[docs/articles/juejin-industrial-hmi-foundation.md](docs/articles/juejin-industrial-hmi-foundation.md)')
    expect(readme).toContain('[docs/project-manual.md](docs/project-manual.md)')
    expect(readme).toContain('应用内通过 `帮助 -> 项目说明书` 离线查看')
    expect(readme).toContain('在 `Simulator` 区域启动 Modbus TCP 或 OPC UA Simulator')
    expect(readme).toContain('设备连接仍由 DeviceManager 流程完成')
    expect(readme).toContain('Modbus RTU 是真实工业串口协议形态，但当前项目未实现 RTU runtime')
    expect(readme).toContain('[docs/assets/juejin](docs/assets/juejin)')
    expect(readme).toContain('Dashboard、Device、Alarm、Trend、Recipe、Audit、User Management、Tag Management 和 Settings')
    expect(readme).toContain('build/icon.png')
    expect(readme).toContain('openspec validate <change-id> --strict')
    expect(readme).toContain('不代表真实生产现场 Safety System')
    expectNoLocalAbsolutePaths(readme)
    expectBoundedIndustrialClaims(readme)
  })

  it('provides a Juejin promotion article with local screenshot assets and bounded claims', () => {
    const article = readRepoFile('docs/articles/juejin-industrial-hmi-foundation.md')
    const requiredAssets = [
      'dashboard-logged-out.png',
      'dashboard-logged-in.png',
      'device-disconnected.png',
      'device-connected.png',
      'alarm-history.png',
      'trend-realtime.png',
      'recipe-management.png',
      'audit-log.png',
      'user-management.png',
      'tag-management.png',
      'settings-simulator.png'
    ]
    const imagePaths = Array.from(article.matchAll(markdownImagePattern), (match) => match[1])
    const expectedImagePaths = requiredAssets.map((asset) => `../assets/juejin/${asset}`).sort()
    const articleBase = new URL('../docs/articles/', import.meta.url)

    expect(article).toContain('# 用 Electron + React 做一个工业 HMI 学习项目：从 Modbus/OPC UA 到报警、趋势和配方')
    expect(article).toContain('Main / Preload / Renderer')
    expect(article).toContain('Modbus TCP polling')
    expect(article).toContain('OPC UA subscription')
    expect(article).toContain('TagDefinition')
    expect(article).toContain('TagValue')
    expect(article).toContain('Device State')
    expect(article).toContain('CommandService')
    expect(article).toContain('Alarm')
    expect(article).toContain('Historian')
    expect(article).toContain('Trend')
    expect(article).toContain('Recipe')
    expect(article).toContain('Permission')
    expect(article).toContain('Audit')
    expect(article).toContain('普通演示路径')
    expect(article).toContain('不代表真实生产现场 Safety System')
    expect(article).toContain('Modbus RTU runtime')
    expectNoLocalAbsolutePaths(article)
    expectBoundedIndustrialClaims(article)
    expect([...imagePaths].sort()).toEqual(expectedImagePaths)

    for (const imagePath of imagePaths) {
      expect(imagePath).not.toMatch(/^(?:\/|[a-z]+:|[A-Za-z]:\\)/)
      expect(existsSync(new URL(imagePath, articleBase))).toBe(true)
    }
  })

  it('keeps the in-app user manual focused on current operation paths', () => {
    const manualSource = readRepoFile('src/renderer/help/manual.ts')

    expect(manualSource).toContain('Dashboard、Device、Alarm、Trend、Recipe、Audit、User Management、Tag Management 和 Settings')
    expect(manualSource).toContain('普通演示路径是先在 Settings 中启动 Simulator，再到 Device 页面 Connect')
    expect(manualSource).toContain('Device 页面连接状态显示 Disconnected、Connecting、Connected、Reconnecting 或 Fault')
    expect(manualSource).toContain('实时趋势使用有上限的 ring buffer，历史趋势来自 SQLite')
    expect(manualSource).toContain('配方下载需要校验、写入和 read-back / verify')
    expect(manualSource).toContain('关键写操作仍由 Main Process 权威校验，并通过 Audit Log 记录结果')
    expect(manualSource).toContain('当前版本不是生产控制系统')
    expectNoLocalAbsolutePaths(manualSource)
    expectBoundedIndustrialClaims(manualSource)
  })

  it('documents protocol mapping and answers the requested PLC communication questions', () => {
    const manual = readRepoFile('docs/project-manual.md')
    const requiredHeadings = [
      '### 怎么和 PLC / 设备通信？',
      '### 1. Modbus TCP / RTU 是什么？',
      '### 2. OPC UA 是什么？',
      '### 3. 怎么做周期采集？',
      '### 4. 1000 个点位怎么处理？',
      '### 5. 设备断线怎么办？',
      '### 6. 怎么避免 UI 被通信阻塞？',
      '### 7. 实时数据怎么刷新？',
      '### 8. 怎么做报警？',
      '### 9. 历史趋势怎么保存？',
      '### 10. 如何控制 PLC？',
      '### 11. 怎么防止重复下发命令？',
      '### 12. PLC 通信线程和 UI 怎么隔离？',
      '### 13. 如何处理设备异常、超时、重连？',
      '### 14. 配方是什么？',
      '### 15. 点位 Tag 是怎么管理的？',
      '### 16. 操作员、工程师权限怎么区分？',
      '### 17. 怎么记录操作日志？'
    ]

    for (const heading of requiredHeadings) {
      expect(manual).toContain(heading)
    }
    expect(manual).toContain('| Modbus TCP Simulator | 本地 TCP 模拟 PLC |')
    expect(manual).toContain('| OPC UA Simulator | 本地 OPC UA Server |')
    expect(manual).toContain('Modbus RTU | 当前未实现 runtime')
    expect(manual).toContain('不替代 Safety PLC、安全继电器、硬件联锁、急停、SIL、生产认证或现场网络安全合规能力')
  })

  it('keeps changelog release notes updated without bumping the current package version', () => {
    const packageJson = JSON.parse(readRepoFile('package.json'))
    const changelog = readRepoFile('CHANGELOG.md')

    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(changelog).toContain(`## Unreleased / ${packageJson.version}`)
    expect(changelog).toContain('新增 `docs/articles/juejin-industrial-hmi-foundation.md` 掘金推广文章草稿')
    expect(changelog).toContain('新增 `docs/assets/juejin/` 文章配图资产')
    expect(changelog).toContain('更新 README，增加掘金文章入口')
    expect(changelog).toContain('更新应用内使用说明书，补齐当前主要页面')
    expect(changelog).toContain('新增跨平台应用图标资产')
    expect(changelog).toContain('新增 `docs/project-manual.md` 项目说明书')
    expect(changelog).toContain('新增应用内 Simulator 控制入口')
    expect(changelog).toContain('`yarn simulator:start` 和 `yarn simulator:opcua:start` 继续作为维护者')
    expect(changelog).toContain('Electron Builder 显式引用 `build/icon.png`、`build/icon.icns` 和 `build/icon.ico`')
  })
})
