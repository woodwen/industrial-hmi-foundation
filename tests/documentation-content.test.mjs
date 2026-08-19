import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const readRepoFile = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('project documentation content', () => {
  it('links README to the detailed project manual and keeps README as an entry point', () => {
    const readme = readRepoFile('README.md')

    expect(readme).toContain('[docs/project-manual.md](docs/project-manual.md)')
    expect(readme).toContain('Modbus RTU 是真实工业串口协议形态，但当前项目未实现 RTU runtime')
    expect(readme).toContain('build/icon.png')
    expect(readme).toContain('openspec validate refresh-app-icon-project-docs --strict')
    expect(readme).toContain('不代表真实生产现场 Safety System')
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

    expect(packageJson.version).toBe('0.1.1')
    expect(changelog).toContain('## Unreleased / 0.1.1')
    expect(changelog).toContain('新增跨平台应用图标资产')
    expect(changelog).toContain('新增 `docs/project-manual.md` 项目说明书')
    expect(changelog).toContain('Electron Builder 显式引用 `build/icon.png`、`build/icon.icns` 和 `build/icon.ico`')
  })
})
