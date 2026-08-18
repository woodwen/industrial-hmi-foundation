import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  AlarmEngine,
  AlarmHistoryRepository,
  DEFAULT_ALARM_ACKNOWLEDGE_USER,
  DEFAULT_ALARM_DEFINITIONS
} from '../../../src/main/alarm'
import { DeviceManager } from '../../../src/main/device'
import { HistorianDatabase } from '../../../src/main/historian'
import type { Logger } from '../../../src/main/logging/logger'
import type {
  IProtocolAdapter,
  ProtocolAdapterStatus,
  ProtocolConnectionConfig,
  ProtocolReadRequest,
  ProtocolReadResult,
  ProtocolWriteRequest,
  ProtocolWriteResult
} from '../../../src/main/protocol/types'
import type { DeviceStateChangedEvent } from '../../../src/shared/hmi-api'
import {
  DEFAULT_SIMULATOR_HOST,
  DEFAULT_SIMULATOR_PORT,
  DEFAULT_SIMULATOR_UNIT_ID,
  SIMULATED_MIXER_DEVICE_ID
} from '../../../src/shared/modbus'
import { DEFAULT_TAG_DEFINITIONS, type TagValue } from '../../../src/shared/tag'
import { TagCache } from '../../../src/main/tag'

const BASE_TIME_MS = Date.parse('2026-08-18T00:00:00.000Z')

describe('AlarmEngine', () => {
  const disposables: Array<() => void> = []
  let nowMs = BASE_TIME_MS

  afterEach(() => {
    while (disposables.length > 0) {
      disposables.pop()?.()
    }
    vi.useRealTimers()
    nowMs = BASE_TIME_MS
  })

  it('defines the required default industrial alarms', () => {
    expect(DEFAULT_ALARM_DEFINITIONS).toEqual([
      expect.objectContaining({
        code: 'TEMP_HIGH',
        tagId: 'currentTemperature',
        condition: 'High',
        threshold: 80,
        delay: 3000,
        level: 'High',
        message: 'Temperature is too high',
        enabled: true
      }),
      expect.objectContaining({
        code: 'LEVEL_LOW',
        tagId: 'currentLevel',
        condition: 'Low',
        threshold: 15,
        delay: 3000,
        level: 'Warning',
        message: 'Level is too low',
        enabled: true
      }),
      expect.objectContaining({
        code: 'PRESSURE_HIGH',
        tagId: 'currentPressure',
        condition: 'High',
        threshold: 0.3,
        delay: 2000,
        level: 'High',
        message: 'Pressure is too high',
        enabled: true
      }),
      expect.objectContaining({
        code: 'MOTOR_ABNORMAL',
        condition: 'BooleanState',
        threshold: true,
        delay: 5000,
        level: 'Critical',
        message: 'Motor feedback is abnormal',
        enabled: true
      }),
      expect.objectContaining({
        code: 'PLC_DISCONNECTED',
        condition: 'BooleanState',
        threshold: true,
        delay: 1000,
        level: 'Critical',
        message: 'PLC communication is lost',
        enabled: true
      })
    ])
  })

  it('debounces transient high temperature without creating alarm history', async () => {
    vi.useFakeTimers()
    const { cache, engine, repository } = createHarness(() => new Date(nowMs).toISOString())

    cache.setValues([tagValue('currentTemperature', 81, nowMs)])
    await advance(1000)
    cache.setValues([tagValue('currentTemperature', 79, nowMs)])
    await advance(3000)

    expect(engine.getSnapshot().occurrences).toEqual([])
    expect(repository.queryHistory({}).rows).toEqual([])
  })

  it('triggers, acknowledges, and recovers a sustained high temperature alarm', async () => {
    vi.useFakeTimers()
    const { cache, engine, repository } = createHarness(() => new Date(nowMs).toISOString())

    cache.setValues([tagValue('currentTemperature', 81, nowMs)])
    await advance(3000)

    const active = engine.getSnapshot().occurrences[0]
    expect(active).toMatchObject({
      code: 'TEMP_HIGH',
      status: 'Active',
      triggerValue: 81,
      conditionActive: true
    })

    await advance(100)
    const acknowledged = engine.acknowledge({
      occurrenceId: active.id
    })
    expect(acknowledged).toMatchObject({
      status: 'Acknowledged',
      acknowledgeUser: DEFAULT_ALARM_ACKNOWLEDGE_USER
    })

    cache.setValues([tagValue('currentTemperature', 79, nowMs)])
    await advance(3000)

    expect(engine.getSnapshot().occurrences[0]).toMatchObject({
      id: active.id,
      status: 'Recovered',
      conditionActive: false,
      recoverValue: 79
    })
    expect(repository.queryHistory({
      tagId: 'currentTemperature'
    }).rows[0]).toMatchObject({
      id: active.id,
      code: 'TEMP_HIGH',
      status: 'Recovered',
      acknowledgeUser: DEFAULT_ALARM_ACKNOWLEDGE_USER,
      triggerValue: 81,
      recoverValue: 79,
      conditionActive: false
    })
  })

  it('suppresses duplicate occurrences and cancels recovery when the value becomes abnormal again', async () => {
    vi.useFakeTimers()
    const { cache, engine, repository } = createHarness(() => new Date(nowMs).toISOString())

    cache.setValues([tagValue('currentTemperature', 81, nowMs)])
    await advance(3000)

    const active = engine.getSnapshot().occurrences[0]
    cache.setValues([tagValue('currentTemperature', 82, nowMs)])
    await advance(3000)

    expect(repository.queryHistory({
      tagId: 'currentTemperature'
    }).rows).toHaveLength(1)

    cache.setValues([tagValue('currentTemperature', 79, nowMs)])
    await advance(1000)
    cache.setValues([tagValue('currentTemperature', 81, nowMs)])
    await advance(3000)

    const stillActive = engine.getSnapshot().occurrences[0]
    expect(stillActive).toMatchObject({
      id: active.id,
      status: 'Active',
      conditionActive: true
    })
    expect(stillActive.recoverTime).toBeUndefined()
    expect(repository.queryHistory({
      tagId: 'currentTemperature'
    }).rows).toHaveLength(1)
  })

  it('keeps recovered-before-acknowledge alarms active until the operator acknowledges them', async () => {
    vi.useFakeTimers()
    const { cache, engine } = createHarness(() => new Date(nowMs).toISOString())

    cache.setValues([tagValue('currentTemperature', 81, nowMs)])
    await advance(3000)

    const active = engine.getSnapshot().occurrences[0]
    cache.setValues([tagValue('currentTemperature', 79, nowMs)])
    await advance(3000)

    expect(engine.getSnapshot().occurrences[0]).toMatchObject({
      id: active.id,
      status: 'Active',
      conditionActive: false,
      recoverValue: 79
    })

    expect(engine.acknowledge({
      occurrenceId: active.id,
      user: 'shift-a'
    })).toMatchObject({
      id: active.id,
      status: 'Recovered',
      acknowledgeUser: 'shift-a'
    })
  })

  it('does not acknowledge in memory when persisting acknowledge fails', async () => {
    vi.useFakeTimers()
    const failingRepository = createFailingAcknowledgeRepository()
    const { cache, engine } = createHarness(() => new Date(nowMs).toISOString(), failingRepository)

    cache.setValues([tagValue('currentTemperature', 81, nowMs)])
    await advance(3000)

    const active = engine.getSnapshot().occurrences[0]
    let caught: unknown
    try {
      engine.acknowledge({
        occurrenceId: active.id
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toMatchObject({
      code: 'ALARM_HISTORY_WRITE_FAILED',
      source: 'main:alarm-engine'
    })
    expect(failingRepository.updateAcknowledge).toHaveBeenCalled()
    const afterFailedAcknowledge = engine.getSnapshot().occurrences[0]
    expect(afterFailedAcknowledge).toMatchObject({
      id: active.id,
      status: 'Active'
    })
    expect(afterFailedAcknowledge.acknowledgeUser).toBeUndefined()
  })

  it('creates default boolean alarms for motor abnormal and PLC disconnected signals', async () => {
    vi.useFakeTimers()
    const { cache, engine } = createHarness(() => new Date(nowMs).toISOString())

    cache.setValues([
      tagValue('deviceRunningStatus', true, nowMs),
      tagValue('mixerMotorRunningStatus', false, nowMs)
    ])
    await advance(5000)

    engine.handleDeviceState(createDeviceState('Reconnecting', nowMs))
    await advance(1000)

    expect(engine.getSnapshot().occurrences).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'MOTOR_ABNORMAL',
        status: 'Active',
        level: 'Critical'
      }),
      expect.objectContaining({
        code: 'PLC_DISCONNECTED',
        status: 'Active',
        level: 'Critical'
      })
    ]))
  })

  async function advance(ms: number): Promise<void> {
    nowMs += ms
    await vi.advanceTimersByTimeAsync(ms)
  }

  function createHarness(now: () => string, repositoryOverride?: AlarmHistoryRepository): {
    cache: TagCache
    engine: AlarmEngine
    repository: AlarmHistoryRepository
  } {
    const cache = new TagCache(DEFAULT_TAG_DEFINITIONS, now)
    let database: HistorianDatabase | null = null
    let repository = repositoryOverride
    if (!repository) {
      database = new HistorianDatabase(':memory:')
      repository = new AlarmHistoryRepository(database.db)
    }
    const deviceManager = new DeviceManager({
      adapter: new FakeProtocolAdapter(),
      logger: createLogger(),
      now
    })
    const engine = new AlarmEngine(cache, deviceManager, repository, createLogger(), {
      now
    })

    if (database) {
      disposables.push(() => database.close())
    }
    disposables.push(() => deviceManager.dispose())
    disposables.push(() => engine.dispose())
    return {
      cache,
      engine,
      repository
    }
  }
})

function createFailingAcknowledgeRepository(): AlarmHistoryRepository {
  return {
    createOccurrence: vi.fn(),
    updateAcknowledge: vi.fn(() => {
      throw new Error('database is locked')
    }),
    updateRecovery: vi.fn(),
    queryHistory: vi.fn()
  } as unknown as AlarmHistoryRepository
}

function tagValue(tagId: string, value: TagValue['value'], timestampMs: number): TagValue {
  return {
    tagId,
    value,
    quality: 'Good',
    timestamp: new Date(timestampMs).toISOString()
  }
}

function createDeviceState(
  connectionStatus: DeviceStateChangedEvent['connectionStatus'],
  timestampMs: number
): DeviceStateChangedEvent {
  const timestamp = new Date(timestampMs).toISOString()
  return {
    deviceId: SIMULATED_MIXER_DEVICE_ID,
    name: 'Simulated Mixer PLC',
    protocol: 'modbusTcp',
    connectionStatus,
    endpoint: {
      host: DEFAULT_SIMULATOR_HOST,
      port: DEFAULT_SIMULATOR_PORT,
      unitId: DEFAULT_SIMULATOR_UNIT_ID
    },
    emittedAt: timestamp
  }
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
