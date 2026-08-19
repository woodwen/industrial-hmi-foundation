import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)

describe('performance profile script', () => {
  it('generates measured report structure for 100, 500, and 1000 Tags', async () => {
    const { stdout } = await execFileAsync(process.execPath, [
      'scripts/run-performance-profile.mjs',
      '--tags',
      '100,500,1000',
      '--durationMs',
      '50'
    ], {
      cwd: process.cwd()
    })
    const match = stdout.match(/Performance profile written to (.+\.json)/)
    expect(match).not.toBeNull()

    const reportPath = match?.[1]
    if (!reportPath) {
      throw new Error('Performance report path was not printed.')
    }

    const report = JSON.parse(await readFile(reportPath, 'utf8')) as {
      scenarios: Array<{
        tagCount: number
        requestCount: number
        cpuUserMs: number
        memoryRssEndBytes: number
      }>
    }

    expect(report.scenarios.map((scenario) => scenario.tagCount)).toEqual([100, 500, 1000])
    expect(report.scenarios.every((scenario) => scenario.requestCount > 0)).toBe(true)
    expect(report.scenarios.every((scenario) => scenario.cpuUserMs >= 0)).toBe(true)
    expect(report.scenarios.every((scenario) => scenario.memoryRssEndBytes > 0)).toBe(true)
  }, 10000)
})
