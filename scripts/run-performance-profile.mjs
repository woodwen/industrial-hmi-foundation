import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reportDir = path.join(repoRoot, 'reports', 'performance')

const DEFAULT_TAG_COUNTS = [100, 500, 1000]

const options = parseArgs(process.argv.slice(2))
const tagCounts = options.tags.length > 0 ? options.tags : DEFAULT_TAG_COUNTS
const protocol = options.protocol
const durationMs = options.durationMs
const seed = options.seed

await mkdir(reportDir, { recursive: true })

const scenarios = []
for (const tagCount of tagCounts) {
  scenarios.push(await runScenario({
    protocol,
    tagCount,
    durationMs,
    scanRateMs: options.scanRateMs,
    seed
  }))
}

const report = {
  generatedAt: new Date().toISOString(),
  command: `node scripts/run-performance-profile.mjs ${process.argv.slice(2).join(' ')}`.trim(),
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem()
  },
  scenarios
}

const timestamp = report.generatedAt.replace(/[:.]/g, '-')
const jsonPath = path.join(reportDir, `${timestamp}-performance-profile.json`)
const markdownPath = path.join(reportDir, `${timestamp}-performance-profile.md`)

await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
await writeFile(markdownPath, renderMarkdown(report))

console.info(`Performance profile written to ${jsonPath}`)
console.info(`Performance summary written to ${markdownPath}`)

async function runScenario(config) {
  const random = createDeterministicRandom(config.seed + config.tagCount)
  const tags = Array.from({ length: config.tagCount }, (_, index) => ({
    id: `tag-${String(index + 1).padStart(4, '0')}`,
    value: random() * 100,
    scanRateMs: config.scanRateMs,
    deadband: 0.01 + (index % 5) * 0.01
  }))
  const acquisitionBatchSize = config.protocol === 'modbusTcp' ? 100 : config.tagCount
  const acquisitionMode = config.protocol === 'opcUa' ? 'subscription' : 'polling'
  const trendCapPerTag = 120
  const trendBuffers = new Map(tags.map((tag) => [tag.id, []]))
  const startedAt = performance.now()
  const startedCpu = process.cpuUsage()
  const startedMemory = process.memoryUsage()
  const metrics = {
    requestCount: 0,
    notificationCount: 0,
    pollingDurationMs: 0,
    acquisitionDurationMs: 0,
    ipcMessageCount: 0,
    ipcValueCount: 0,
    rendererUpdateCount: 0,
    tagCacheBatchCount: 0,
    tagCacheValueCount: 0,
    historianWriteCount: 0,
    trendPointCount: 0,
    maxTrendPointCount: 0,
    logBytesGenerated: 0,
    maxBatchSize: 0
  }
  let changedSinceLastIpc = 0
  let ipcPending = false
  let nextAcquisitionAt = startedAt
  let nextIpcAt = startedAt
  let nextRenderAt = startedAt
  let nextHistorianAt = startedAt + 1000

  while (performance.now() - startedAt < config.durationMs) {
    const now = performance.now()
    if (now >= nextAcquisitionAt) {
      const acquisitionStarted = performance.now()
      const batchCount = Math.ceil(tags.length / acquisitionBatchSize)
      if (config.protocol === 'modbusTcp') {
        metrics.requestCount += batchCount
      } else {
        metrics.notificationCount += batchCount
      }

      let changed = 0
      for (const tag of tags) {
        const previous = tag.value
        tag.value = nextValue(previous, random)
        if (Math.abs(tag.value - previous) >= tag.deadband) {
          changed += 1
        }
      }

      const acquisitionDuration = performance.now() - acquisitionStarted
      metrics.acquisitionDurationMs += acquisitionDuration
      if (config.protocol === 'modbusTcp') {
        metrics.pollingDurationMs += acquisitionDuration
      }
      metrics.tagCacheBatchCount += 1
      metrics.tagCacheValueCount += changed
      metrics.maxBatchSize = Math.max(metrics.maxBatchSize, changed)
      metrics.logBytesGenerated += `profile ${config.protocol} ${config.tagCount} ${changed}\n`.length
      changedSinceLastIpc += changed
      nextAcquisitionAt += config.scanRateMs
    }

    if (now >= nextIpcAt && changedSinceLastIpc > 0) {
      metrics.ipcMessageCount += 1
      metrics.ipcValueCount += changedSinceLastIpc
      changedSinceLastIpc = 0
      ipcPending = true
      nextIpcAt += 250
    }

    if (now >= nextRenderAt && ipcPending) {
      metrics.rendererUpdateCount += 1
      ipcPending = false
      nextRenderAt += 250
    }

    if (now >= nextHistorianAt) {
      const sampled = tags.filter((_tag, index) => index % 10 === 0)
      metrics.historianWriteCount += sampled.length
      for (const tag of sampled) {
        const buffer = trendBuffers.get(tag.id)
        if (!buffer) {
          continue
        }
        buffer.push({ time: Date.now(), value: tag.value })
        while (buffer.length > trendCapPerTag) {
          buffer.shift()
        }
      }
      metrics.trendPointCount = Array.from(trendBuffers.values()).reduce((total, buffer) => total + buffer.length, 0)
      metrics.maxTrendPointCount = Math.max(metrics.maxTrendPointCount, metrics.trendPointCount)
      nextHistorianAt += 1000
    }

    await delay(5)
  }

  const elapsedMs = performance.now() - startedAt
  const cpu = process.cpuUsage(startedCpu)
  const endedMemory = process.memoryUsage()

  return {
    protocol: config.protocol,
    acquisitionMode,
    tagCount: config.tagCount,
    seed: config.seed,
    durationMs: Math.round(elapsedMs),
    scanRateMs: config.scanRateMs,
    requestCount: metrics.requestCount,
    notificationCount: metrics.notificationCount,
    pollingDurationMs: round(metrics.pollingDurationMs),
    acquisitionDurationMs: round(metrics.acquisitionDurationMs),
    cpuUserMs: round(cpu.user / 1000),
    cpuSystemMs: round(cpu.system / 1000),
    memoryRssStartBytes: startedMemory.rss,
    memoryRssEndBytes: endedMemory.rss,
    memoryHeapUsedStartBytes: startedMemory.heapUsed,
    memoryHeapUsedEndBytes: endedMemory.heapUsed,
    ipcMessageRatePerSecond: round(metrics.ipcMessageCount / (elapsedMs / 1000)),
    rendererUpdateRatePerSecond: round(metrics.rendererUpdateCount / (elapsedMs / 1000)),
    tagCacheBatchCount: metrics.tagCacheBatchCount,
    averageTagCacheBatchSize: round(metrics.tagCacheBatchCount ? metrics.tagCacheValueCount / metrics.tagCacheBatchCount : 0),
    maxTagCacheBatchSize: metrics.maxBatchSize,
    historianWriteRatePerSecond: round(metrics.historianWriteCount / (elapsedMs / 1000)),
    trendPointCount: metrics.trendPointCount,
    maxTrendPointCount: metrics.maxTrendPointCount,
    logGrowthBytes: metrics.logBytesGenerated
  }
}

function renderMarkdown(report) {
  const lines = [
    '# Performance Profile',
    '',
    `Generated: ${report.generatedAt}`,
    `Command: \`${report.command}\``,
    '',
    '| Protocol | Tags | Requests | Notifications | Polling ms | CPU ms | RSS delta | IPC/s | Renderer/s | Historian/s | Trend points | Log bytes |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  ]

  for (const scenario of report.scenarios) {
    const cpuMs = round(scenario.cpuUserMs + scenario.cpuSystemMs)
    const rssDelta = scenario.memoryRssEndBytes - scenario.memoryRssStartBytes
    lines.push([
      scenario.protocol,
      scenario.tagCount,
      scenario.requestCount,
      scenario.notificationCount,
      scenario.pollingDurationMs,
      cpuMs,
      rssDelta,
      scenario.ipcMessageRatePerSecond,
      scenario.rendererUpdateRatePerSecond,
      scenario.historianWriteRatePerSecond,
      scenario.trendPointCount,
      scenario.logGrowthBytes
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push('', 'The numbers above are measured from this simulator profile run and are not production benchmarks.')
  return `${lines.join('\n')}\n`
}

function parseArgs(args) {
  const parsed = {
    protocol: 'modbusTcp',
    tags: [],
    durationMs: 5000,
    scanRateMs: 100,
    seed: 1729
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = args[index + 1]
    if (arg === '--protocol' && (next === 'modbusTcp' || next === 'opcUa')) {
      parsed.protocol = next
      index += 1
      continue
    }
    if (arg === '--tags' && next) {
      parsed.tags = next.split(',').map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry) && entry > 0)
      index += 1
      continue
    }
    if (arg === '--durationMs' && next) {
      parsed.durationMs = parsePositiveInteger(next, parsed.durationMs)
      index += 1
      continue
    }
    if (arg === '--scanRateMs' && next) {
      parsed.scanRateMs = parsePositiveInteger(next, parsed.scanRateMs)
      index += 1
      continue
    }
    if (arg === '--seed' && next) {
      parsed.seed = parsePositiveInteger(next, parsed.seed)
      index += 1
    }
  }

  return parsed
}

function createDeterministicRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

function nextValue(previous, random) {
  const delta = (random() - 0.5) * 2
  return Math.max(0, Math.min(100, previous + delta))
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function round(value) {
  return Math.round(value * 1000) / 1000
}
