import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { AlarmEngine, AlarmHistoryRepository } from '../../src/main/alarm'
import { DeviceManager } from '../../src/main/device'
import {
  HistorianDatabase,
  HistorianService,
  TagHistoryRepository,
  TrendQueryService,
  TrendService
} from '../../src/main/historian'
import type { Logger } from '../../src/main/logging/logger'
import type {
  IProtocolAdapter,
  ProtocolAdapterStatus,
  ProtocolConnectionConfig,
  ProtocolReadRequest,
  ProtocolReadResult,
  ProtocolWriteRequest,
  ProtocolWriteResult
} from '../../src/main/protocol/types'
import { TagCache } from '../../src/main/tag'
import {
  DEFAULT_SIMULATOR_HOST,
  DEFAULT_SIMULATOR_PORT,
  DEFAULT_SIMULATOR_UNIT_ID,
  SIMULATED_MIXER_DEVICE_ID
} from '../../src/shared/modbus'
import { DEFAULT_TAG_DEFINITIONS, type TagValue } from '../../src/shared/tag'

describe('Alarm, Historian, and Trend acceptance path', () => {
  let tempDir: string | null = null
  let nowMs = Date.parse('2026-08-18T00:00:00.000Z')

  afterEach(() => {
    vi.useRealTimers()
    nowMs = Date.parse('2026-08-18T00:00:00.000Z')
    if (tempDir) {
      rmSync(tempDir, {
        recursive: true,
        force: true
      })
      tempDir = null
    }
  })

  it('covers high temperature alarm, acknowledge, recovery, and restart-readable trends', async () => {
    vi.useFakeTimers()
    tempDir = mkdtempSync(join(tmpdir(), 'industrial-hmi-acceptance-'))
    const databasePath = join(tempDir, 'historian.sqlite')
    const cache = new TagCache(DEFAULT_TAG_DEFINITIONS, now)
    const database = new HistorianDatabase(databasePath)
    const tagHistoryRepository = new TagHistoryRepository(database.db)
    const alarmHistoryRepository = new AlarmHistoryRepository(database.db)
    const historian = new HistorianService(cache, tagHistoryRepository, createLogger(), {
      now
    })
    const trend = new TrendService(cache, {
      autoStart: false,
      now
    })
    const deviceManager = createDeviceManager(now)
    const alarm = new AlarmEngine(
      cache,
      deviceManager,
      alarmHistoryRepository,
      createLogger(),
      {
        now
      }
    )

    try {
      cache.setValues([tagValue('currentTemperature', 82, nowMs)])
      trend.sampleOnce()
      await advance(3000)

      const active = alarm.getSnapshot().occurrences[0]
      expect(active).toMatchObject({
        code: 'TEMP_HIGH',
        status: 'Active',
        triggerValue: 82
      })

      alarm.acknowledge({
        occurrenceId: active.id
      })

      cache.setValues([tagValue('currentTemperature', 77, nowMs)])
      trend.sampleOnce()
      await advance(3000)

      expect(alarmHistoryRepository.queryHistory({
        tagId: 'currentTemperature'
      }).rows[0]).toMatchObject({
        code: 'TEMP_HIGH',
        status: 'Recovered',
        acknowledgeUser: 'operator',
        recoverValue: 77
      })
      expect(tagHistoryRepository.queryRaw({
        tagIds: ['currentTemperature'],
        startMs: Date.parse('2026-08-18T00:00:00.000Z'),
        endMs: Date.parse('2026-08-18T00:00:06.000Z')
      })).toHaveLength(2)
      expect(trend.getSnapshot(['currentTemperature']).points).toHaveLength(2)
    } finally {
      alarm.dispose()
      deviceManager.dispose()
      trend.dispose()
      historian.dispose()
      database.close()
    }

    const reopenedDatabase = new HistorianDatabase(databasePath)
    const trendQuery = new TrendQueryService(
      new TagHistoryRepository(reopenedDatabase.db),
      () => nowMs
    )

    try {
      expect(trendQuery.queryHistorical({
        tagIds: ['currentTemperature'],
        preset: 'custom',
        startTime: '2026-08-18T00:00:00.000Z',
        endTime: '2026-08-18T00:00:06.000Z',
        maxPointsPerTag: 1000
      }).points).toEqual(expect.arrayContaining([
        expect.objectContaining({
          tagId: 'currentTemperature',
          value: 82
        }),
        expect.objectContaining({
          tagId: 'currentTemperature',
          value: 77
        })
      ]))
    } finally {
      reopenedDatabase.close()
    }
  })

  async function advance(ms: number): Promise<void> {
    nowMs += ms
    await vi.advanceTimersByTimeAsync(ms)
  }

  function now(): string {
    return new Date(nowMs).toISOString()
  }
})

function tagValue(tagId: string, value: TagValue['value'], timestampMs: number): TagValue {
  return {
    tagId,
    value,
    quality: 'Good',
    timestamp: new Date(timestampMs).toISOString()
  }
}

function createDeviceManager(now: () => string): DeviceManager {
  return new DeviceManager({
    adapter: new FakeProtocolAdapter(),
    logger: createLogger(),
    connectionConfig: {
      deviceId: SIMULATED_MIXER_DEVICE_ID,
      host: DEFAULT_SIMULATOR_HOST,
      port: DEFAULT_SIMULATOR_PORT,
      unitId: DEFAULT_SIMULATOR_UNIT_ID,
      connectTimeoutMs: 1000,
      requestTimeoutMs: 1000
    },
    now
  })
}

class FakeProtocolAdapter implements IProtocolAdapter {
  private status: ProtocolAdapterStatus = {
    connectionStatus: 'Disconnected'
  }

  async connect(config: ProtocolConnectionConfig): Promise<void> {
    this.status = {
      connectionStatus: 'Connected',
      endpoint: `${config.host}:${config.port}`,
      unitId: config.unitId
    }
  }

  async disconnect(): Promise<void> {
    this.status = {
      connectionStatus: 'Disconnected'
    }
  }

  async read(request: ProtocolReadRequest): Promise<ProtocolReadResult> {
    return {
      area: request.area,
      address: request.address,
      quantity: request.quantity,
      values: [0]
    }
  }

  async write(request: ProtocolWriteRequest): Promise<ProtocolWriteResult> {
    return {
      area: request.area,
      address: request.address,
      quantity: request.values.length
    }
  }

  getStatus(): ProtocolAdapterStatus {
    return this.status
  }
}

function createLogger(): Logger {
  return {
    write: vi.fn()
  }
}
