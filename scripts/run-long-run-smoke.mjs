import { EventEmitter } from 'node:events'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

import Database from 'better-sqlite3'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reportDir = path.join(repoRoot, 'reports', 'performance')
const options = parseArgs(process.argv.slice(2))

await mkdir(reportDir, { recursive: true })

const report = await runLongRunSmoke(options)
const timestamp = report.generatedAt.replace(/[:.]/g, '-')
const jsonPath = path.join(reportDir, `${timestamp}-long-run-smoke.json`)
const markdownPath = path.join(reportDir, `${timestamp}-long-run-smoke.md`)

await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
await writeFile(markdownPath, renderMarkdown(report))

console.info(`Long-run smoke report written to ${jsonPath}`)
console.info(`Long-run smoke summary written to ${markdownPath}`)

async function runLongRunSmoke(config) {
  const startedAt = performance.now()
  const startedCpu = process.cpuUsage()
  const startedMemory = process.memoryUsage()
  const db = new Database(':memory:')
  db.exec('CREATE TABLE history (tag_id TEXT NOT NULL, value REAL NOT NULL, quality TEXT NOT NULL, ts TEXT NOT NULL)')
  const insertHistory = db.prepare('INSERT INTO history (tag_id, value, quality, ts) VALUES (?, ?, ?, ?)')
  const emitter = new EventEmitter()
  const resources = createResourceTracker()
  const trendBuffers = new Map(Array.from({ length: config.tags }, (_, index) => [`tag-${index + 1}`, []]))
  const metrics = {
    connectCount: 0,
    disconnectCount: 0,
    reconnectCount: 0,
    commandCount: 0,
    qualityBadCount: 0,
    sqliteWriteCount: 0,
    trendPointCount: 0,
    maxTrendPointCount: 0,
    logBytesGenerated: 0,
    acquisitionTickCount: 0,
    ipcMessageCount: 0,
    rendererUpdateCount: 0
  }

  const listeners = [
    ['tags', () => undefined],
    ['device', () => undefined],
    ['alarms', () => undefined]
  ]
  for (const [eventName, listener] of listeners) {
    emitter.on(eventName, listener)
    resources.listenersAdded += 1
  }

  let connected = false
  let quality = 'Uncertain'
  let acquisitionTimer = null
  let reconnectTimer = null
  let subscriptionActive = false

  const startAcquisition = () => {
    if (config.protocol === 'opcUa') {
      subscriptionActive = true
      resources.subscriptionsCreated += 1
    }

    acquisitionTimer = resources.setInterval(() => {
      metrics.acquisitionTickCount += 1
      metrics.ipcMessageCount += 1
      if (metrics.acquisitionTickCount % 2 === 0) {
        metrics.rendererUpdateCount += 1
      }
      emitter.emit('tags')
    }, config.scanRateMs)
  }

  const stopAcquisition = () => {
    if (acquisitionTimer) {
      resources.clearTimer(acquisitionTimer)
      acquisitionTimer = null
    }
    if (subscriptionActive) {
      subscriptionActive = false
      resources.subscriptionsDisposed += 1
    }
  }

  const connect = () => {
    if (connected) {
      return
    }
    connected = true
    quality = 'Good'
    metrics.connectCount += 1
    metrics.logBytesGenerated += 'connected\n'.length
    startAcquisition()
    emitter.emit('device')
  }

  const disconnect = (scheduleReconnect) => {
    if (!connected) {
      return
    }
    connected = false
    quality = 'Bad'
    metrics.disconnectCount += 1
    metrics.qualityBadCount += 1
    metrics.logBytesGenerated += 'disconnected\n'.length
    stopAcquisition()
    emitter.emit('device')

    if (scheduleReconnect) {
      resources.reconnectTimersCreated += 1
      reconnectTimer = resources.setTimeout(() => {
        reconnectTimer = null
        resources.reconnectTimersFired += 1
        metrics.reconnectCount += 1
        connect()
      }, config.reconnectDelayMs)
    }
  }

  connect()

  const commandTimer = resources.setInterval(() => {
    if (!connected) {
      return
    }
    metrics.commandCount += 1
    metrics.logBytesGenerated += 'command\n'.length
  }, 1000)

  const historianTimer = resources.setInterval(() => {
    const timestamp = new Date().toISOString()
    for (let index = 0; index < Math.max(1, Math.floor(config.tags / 20)); index += 1) {
      insertHistory.run(`tag-${index + 1}`, index, quality, timestamp)
      metrics.sqliteWriteCount += 1
    }
  }, 500)

  const trendTimer = resources.setInterval(() => {
    for (const buffer of trendBuffers.values()) {
      buffer.push({ ts: Date.now(), value: metrics.acquisitionTickCount })
      while (buffer.length > config.trendCapPerTag) {
        buffer.shift()
      }
    }
    metrics.trendPointCount = Array.from(trendBuffers.values()).reduce((total, buffer) => total + buffer.length, 0)
    metrics.maxTrendPointCount = Math.max(metrics.maxTrendPointCount, metrics.trendPointCount)
  }, 250)

  const dropDelay = Math.max(100, Math.floor(config.durationMs * 0.35))
  const dropTimer = resources.setTimeout(() => {
    disconnect(true)
  }, dropDelay)

  await delay(config.durationMs)

  if (reconnectTimer) {
    resources.clearTimer(reconnectTimer)
    reconnectTimer = null
    resources.reconnectTimersCleared += 1
  }
  resources.clearTimer(dropTimer)
  resources.clearTimer(commandTimer)
  resources.clearTimer(historianTimer)
  resources.clearTimer(trendTimer)
  disconnect(false)
  stopAcquisition()

  for (const [eventName, listener] of listeners) {
    emitter.off(eventName, listener)
    resources.listenersRemoved += 1
  }

  const historyRows = db.prepare('SELECT COUNT(*) AS count FROM history').get()
  db.close()
  const elapsedMs = performance.now() - startedAt
  const cpu = process.cpuUsage(startedCpu)
  const endedMemory = process.memoryUsage()

  return {
    generatedAt: new Date().toISOString(),
    command: `node scripts/run-long-run-smoke.mjs ${process.argv.slice(2).join(' ')}`.trim(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuCount: os.cpus().length
    },
    configuration: config,
    durationMs: Math.round(elapsedMs),
    metrics,
    sqliteRows: Number(historyRows.count),
    resources: {
      timersCreated: resources.timersCreated,
      timersCleared: resources.timersCleared,
      activeTimersAfterDispose: resources.activeTimers.size,
      listenersAdded: resources.listenersAdded,
      listenersRemoved: resources.listenersRemoved,
      activeListenersAfterDispose: emitter.eventNames().reduce((total, eventName) => total + emitter.listenerCount(eventName), 0),
      subscriptionsCreated: resources.subscriptionsCreated,
      subscriptionsDisposed: resources.subscriptionsDisposed,
      activeSubscriptionsAfterDispose: resources.subscriptionsCreated - resources.subscriptionsDisposed,
      reconnectTimersCreated: resources.reconnectTimersCreated,
      reconnectTimersFired: resources.reconnectTimersFired,
      reconnectTimersCleared: resources.reconnectTimersCleared,
      activeReconnectTimersAfterDispose: reconnectTimer ? 1 : 0
    },
    cpuUserMs: round(cpu.user / 1000),
    cpuSystemMs: round(cpu.system / 1000),
    memoryRssStartBytes: startedMemory.rss,
    memoryRssEndBytes: endedMemory.rss,
    memoryHeapUsedStartBytes: startedMemory.heapUsed,
    memoryHeapUsedEndBytes: endedMemory.heapUsed,
    limitations: [
      'This is a local smoke profile, not proof that leaks cannot exist.',
      'Extended 30-120 minute runs should be executed manually before relying on long-run behavior.'
    ]
  }
}

function createResourceTracker() {
  const activeTimers = new Set()
  return {
    activeTimers,
    timersCreated: 0,
    timersCleared: 0,
    listenersAdded: 0,
    listenersRemoved: 0,
    subscriptionsCreated: 0,
    subscriptionsDisposed: 0,
    reconnectTimersCreated: 0,
    reconnectTimersFired: 0,
    reconnectTimersCleared: 0,
    setInterval(callback, ms) {
      const timer = setInterval(callback, ms)
      activeTimers.add(timer)
      this.timersCreated += 1
      return timer
    },
    setTimeout(callback, ms) {
      const timer = setTimeout(() => {
        activeTimers.delete(timer)
        callback()
      }, ms)
      activeTimers.add(timer)
      this.timersCreated += 1
      return timer
    },
    clearTimer(timer) {
      if (!activeTimers.has(timer)) {
        return
      }
      clearTimeout(timer)
      clearInterval(timer)
      activeTimers.delete(timer)
      this.timersCleared += 1
    }
  }
}

function renderMarkdown(report) {
  return [
    '# Long-Run Smoke Profile',
    '',
    `Generated: ${report.generatedAt}`,
    `Command: \`${report.command}\``,
    '',
    `Protocol: ${report.configuration.protocol}`,
    `Duration: ${report.durationMs} ms`,
    '',
    '## Resource Cleanup',
    '',
    `Timers active after dispose: ${report.resources.activeTimersAfterDispose}`,
    `Listeners active after dispose: ${report.resources.activeListenersAfterDispose}`,
    `Subscriptions active after dispose: ${report.resources.activeSubscriptionsAfterDispose}`,
    `Reconnect timers active after dispose: ${report.resources.activeReconnectTimersAfterDispose}`,
    '',
    '## Activity',
    '',
    `Connects: ${report.metrics.connectCount}`,
    `Disconnects: ${report.metrics.disconnectCount}`,
    `Reconnects: ${report.metrics.reconnectCount}`,
    `Commands: ${report.metrics.commandCount}`,
    `SQLite rows: ${report.sqliteRows}`,
    `Trend max points: ${report.metrics.maxTrendPointCount}`,
    `Log growth bytes: ${report.metrics.logBytesGenerated}`,
    '',
    'This smoke run records observed local resources only. It does not prove that no leak can exist.'
  ].join('\n') + '\n'
}

function parseArgs(args) {
  const parsed = {
    protocol: 'modbusTcp',
    durationMs: 300000,
    scanRateMs: 100,
    reconnectDelayMs: 1000,
    tags: 100,
    trendCapPerTag: 120
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = args[index + 1]
    if (arg === '--protocol' && (next === 'modbusTcp' || next === 'opcUa')) {
      parsed.protocol = next
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
    if (arg === '--reconnectDelayMs' && next) {
      parsed.reconnectDelayMs = parsePositiveInteger(next, parsed.reconnectDelayMs)
      index += 1
      continue
    }
    if (arg === '--tags' && next) {
      parsed.tags = parsePositiveInteger(next, parsed.tags)
      index += 1
      continue
    }
    if (arg === '--trendCapPerTag' && next) {
      parsed.trendCapPerTag = parsePositiveInteger(next, parsed.trendCapPerTag)
      index += 1
    }
  }

  return parsed
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
