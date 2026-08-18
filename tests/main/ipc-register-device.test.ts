import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AlarmManagerApi,
  AlarmSubscriptionApi,
  CommandManagerApi,
  DeviceManagerApi,
  TrendManagerApi,
  TrendSubscriptionApi,
  UpdateManagerApi
} from '../../src/main/ipc/register'
import type { Logger } from '../../src/main/logging/logger'
import type { DeviceCommandResult, DeviceReadResponse, DeviceStatus, HmiResult } from '../../src/shared/hmi-api'
import { IPC_CHANNELS } from '../../src/shared/ipc-channels'
import { DEFAULT_TAG_DEFINITIONS, type TagSnapshot } from '../../src/shared/tag'
import { createDeviceStatus } from '../support/hmi-api-client-stub'

const electronMocks = vi.hoisted(() => {
  type IpcHandler = (event: unknown, payload: unknown) => Promise<unknown>
  const handlers = new Map<string, IpcHandler>()
  const app = {
    getName: () => 'Industrial HMI Foundation',
    getVersion: () => '0.1.1',
    isPackaged: false
  }
  const ipcMain = {
    handle: vi.fn((channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler)
    })
  }

  return {
    app,
    handlers,
    ipcMain
  }
})

vi.mock('electron', () => ({
  app: electronMocks.app,
  ipcMain: electronMocks.ipcMain
}))

vi.mock('builder-util-runtime', () => ({
  CancellationToken: class TestCancellationToken {
    cancel(): void {
      return undefined
    }
  }
}))

vi.mock('electron-updater', () => ({
  default: {
    autoUpdater: {
      autoDownload: true,
      checkForUpdates: vi.fn(async () => undefined),
      downloadUpdate: vi.fn(async () => [] as string[]),
      logger: null,
      on: vi.fn(),
      quitAndInstall: vi.fn()
    }
  }
}))

describe('Device IPC registration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    electronMocks.handlers.clear()
  })

  it('validates device read payloads and calls DeviceManager', async () => {
    const deviceManager = createDeviceManager()
    const { registerIpcHandlers } = await import('../../src/main/ipc/register')

    registerIpcHandlers(createLogger(), createUpdateManager(), deviceManager)
    const handler = getHandler(IPC_CHANNELS.devices.readRegisters)
    const result = await handler({}, {
      pointIds: ['currentTemperature']
    }) as HmiResult<DeviceReadResponse>

    expect(result).toMatchObject({
      ok: true,
      data: {
        deviceId: 'simulated-mixer-plc'
      }
    })
    expect(deviceManager.readDeviceRegisters).toHaveBeenCalledWith({
      pointIds: ['currentTemperature']
    })
  })

  it('returns a typed error result for invalid device write payloads', async () => {
    const { registerIpcHandlers } = await import('../../src/main/ipc/register')

    registerIpcHandlers(createLogger(), createUpdateManager(), createDeviceManager())
    const handler = getHandler(IPC_CHANNELS.devices.writeRegisters)
    const result = await handler({}, {
      pointId: 'targetTemperature',
      value: '62.5'
    }) as HmiResult<unknown>

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'IPC_INVALID_PAYLOAD'
      }
    })
  })

  it('does not fall back to DeviceManager writes when CommandService is missing', async () => {
    const { registerIpcHandlers } = await import('../../src/main/ipc/register')
    const deviceManager = createDeviceManager()

    registerIpcHandlers(createLogger(), createUpdateManager(), deviceManager)
    const handler = getHandler(IPC_CHANNELS.devices.writeRegisters)
    const result = await handler({}, {
      pointId: 'targetTemperature',
      value: 62.5
    }) as HmiResult<unknown>

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'COMMAND_REJECTED'
      }
    })
    expect(deviceManager.writeDeviceRegisters).not.toHaveBeenCalled()
  })

  it('returns Tag snapshots through the typed Tag IPC handler', async () => {
    const { registerIpcHandlers } = await import('../../src/main/ipc/register')
    const tagManager = {
      getTagSnapshot: vi.fn(() => createTagSnapshot())
    }

    registerIpcHandlers(
      createLogger(),
      createUpdateManager(),
      createDeviceManager(),
      tagManager
    )
    const handler = getHandler(IPC_CHANNELS.tags.getSnapshot)
    const result = await handler({}, undefined) as HmiResult<TagSnapshot>

    expect(result).toMatchObject({
      ok: true,
      data: {
        deviceId: 'simulated-mixer-plc',
        definitions: expect.any(Array),
        values: expect.any(Array)
      }
    })
    expect(tagManager.getTagSnapshot).toHaveBeenCalled()
  })

  it('registers and removes Tag subscribers by webContents id', async () => {
    const { registerIpcHandlers } = await import('../../src/main/ipc/register')
    const tagSubscription = {
      addSubscriber: vi.fn(),
      removeSubscriber: vi.fn()
    }
    const sender = {
      id: 7
    }

    registerIpcHandlers(
      createLogger(),
      createUpdateManager(),
      createDeviceManager(),
      {
        getTagSnapshot: () => createTagSnapshot()
      },
      tagSubscription
    )

    await getHandler(IPC_CHANNELS.tags.subscribe)({ sender }, undefined)
    await getHandler(IPC_CHANNELS.tags.unsubscribe)({ sender }, undefined)

    expect(tagSubscription.addSubscriber).toHaveBeenCalledWith(sender)
    expect(tagSubscription.removeSubscriber).toHaveBeenCalledWith(7)
  })

  it('routes typed command execution through CommandService', async () => {
    const { registerIpcHandlers } = await import('../../src/main/ipc/register')
    const commandManager = createCommandManager()

    registerIpcHandlers(
      createLogger(),
      createUpdateManager(),
      createDeviceManager(),
      {
        getTagSnapshot: () => createTagSnapshot()
      },
      {
        addSubscriber: () => undefined,
        removeSubscriber: () => undefined
      },
      commandManager
    )

    const result = await getHandler(IPC_CHANNELS.commands.execute)({}, {
      commandId: 'start'
    }) as HmiResult<DeviceCommandResult>

    expect(result).toMatchObject({
      ok: true,
      data: {
        commandId: 'start',
        status: 'succeeded'
      }
    })
    expect(commandManager.executeCommand).toHaveBeenCalledWith({
      commandId: 'start'
    })
  })

  it('registers and removes device state subscribers by webContents id', async () => {
    const { registerIpcHandlers } = await import('../../src/main/ipc/register')
    const deviceStateSubscription = {
      addSubscriber: vi.fn(),
      removeSubscriber: vi.fn()
    }
    const sender = {
      id: 8
    }

    registerIpcHandlers(
      createLogger(),
      createUpdateManager(),
      createDeviceManager(),
      {
        getTagSnapshot: () => createTagSnapshot()
      },
      {
        addSubscriber: () => undefined,
        removeSubscriber: () => undefined
      },
      createCommandManager(),
      deviceStateSubscription
    )

    await getHandler(IPC_CHANNELS.devices.subscribeState)({ sender }, undefined)
    await getHandler(IPC_CHANNELS.devices.unsubscribeState)({ sender }, undefined)

    expect(deviceStateSubscription.addSubscriber).toHaveBeenCalledWith(sender)
    expect(deviceStateSubscription.removeSubscriber).toHaveBeenCalledWith(8)
  })

  it('routes alarm handlers and subscriptions through the typed Alarm service boundary', async () => {
    const { registerIpcHandlers } = await import('../../src/main/ipc/register')
    const alarmManager = createAlarmManager()
    const alarmSubscription = createAlarmSubscription()
    const sender = {
      id: 9
    }

    registerIpcHandlers(
      createLogger(),
      createUpdateManager(),
      createDeviceManager(),
      {
        getTagSnapshot: () => createTagSnapshot()
      },
      {
        addSubscriber: () => undefined,
        removeSubscriber: () => undefined
      },
      createCommandManager(),
      {
        addSubscriber: () => undefined,
        removeSubscriber: () => undefined
      },
      alarmManager,
      alarmSubscription
    )

    expect(await getHandler(IPC_CHANNELS.alarms.getSnapshot)({}, undefined)).toMatchObject({
      ok: true,
      data: {
        occurrences: expect.any(Array)
      }
    })
    await getHandler(IPC_CHANNELS.alarms.subscribe)({ sender }, undefined)
    await getHandler(IPC_CHANNELS.alarms.unsubscribe)({ sender }, undefined)
    expect(await getHandler(IPC_CHANNELS.alarms.acknowledge)({}, {
      occurrenceId: 'alarm-temp-high-1787011200000'
    })).toMatchObject({
      ok: true,
      data: {
        status: 'Acknowledged'
      }
    })
    expect(await getHandler(IPC_CHANNELS.alarms.queryHistory)({}, {
      level: 'High',
      status: 'Acknowledged',
      tagId: 'currentTemperature',
      acknowledgeUser: 'operator'
    })).toMatchObject({
      ok: true,
      data: {
        rows: expect.any(Array)
      }
    })

    expect(alarmManager.acknowledgeAlarm).toHaveBeenCalledWith({
      occurrenceId: 'alarm-temp-high-1787011200000',
      user: undefined
    })
    expect(alarmManager.queryAlarmHistory).toHaveBeenCalledWith(expect.objectContaining({
      level: 'High',
      status: 'Acknowledged',
      tagId: 'currentTemperature',
      acknowledgeUser: 'operator'
    }))
    expect(alarmSubscription.addSubscriber).toHaveBeenCalledWith(sender)
    expect(alarmSubscription.removeSubscriber).toHaveBeenCalledWith(9)
  })

  it('routes trend handlers and subscriptions through the typed Trend service boundary', async () => {
    const { registerIpcHandlers } = await import('../../src/main/ipc/register')
    const trendManager = createTrendManager()
    const trendSubscription = createTrendSubscription()
    const sender = {
      id: 10
    }

    registerIpcHandlers(
      createLogger(),
      createUpdateManager(),
      createDeviceManager(),
      {
        getTagSnapshot: () => createTagSnapshot()
      },
      {
        addSubscriber: () => undefined,
        removeSubscriber: () => undefined
      },
      createCommandManager(),
      {
        addSubscriber: () => undefined,
        removeSubscriber: () => undefined
      },
      createAlarmManager(),
      {
        addSubscriber: () => undefined,
        removeSubscriber: () => undefined
      },
      trendManager,
      trendSubscription
    )

    expect(await getHandler(IPC_CHANNELS.trends.getRealtimeSnapshot)({}, {
      tagIds: ['currentTemperature']
    })).toMatchObject({
      ok: true,
      data: {
        points: expect.any(Array)
      }
    })
    await getHandler(IPC_CHANNELS.trends.subscribeRealtime)({ sender }, {
      tagIds: ['currentTemperature', 'currentPressure']
    })
    await getHandler(IPC_CHANNELS.trends.unsubscribeRealtime)({ sender }, undefined)
    expect(await getHandler(IPC_CHANNELS.trends.queryHistorical)({}, {
      tagIds: ['currentTemperature'],
      preset: 'last1h',
      maxPointsPerTag: 1000
    })).toMatchObject({
      ok: true,
      data: {
        aggregated: false
      }
    })

    expect(trendManager.getRealtimeTrendSnapshot).toHaveBeenCalledWith({
      tagIds: ['currentTemperature']
    })
    expect(trendManager.queryHistoricalTrend).toHaveBeenCalledWith({
      tagIds: ['currentTemperature'],
      preset: 'last1h',
      startTime: undefined,
      endTime: undefined,
      maxPointsPerTag: 1000
    })
    expect(trendSubscription.addSubscriber).toHaveBeenCalledWith(sender, [
      'currentTemperature',
      'currentPressure'
    ])
    expect(trendSubscription.removeSubscriber).toHaveBeenCalledWith(10)
  })
})

function getHandler(channel: string): (event: unknown, payload: unknown) => Promise<unknown> {
  const handler = electronMocks.handlers.get(channel)
  if (!handler) {
    throw new Error(`Handler ${channel} was not registered.`)
  }

  return handler
}

function createDeviceManager(): DeviceManagerApi {
  const status = createDeviceStatus('Connected')

  return {
    connectDevice: vi.fn<() => Promise<DeviceStatus>>().mockResolvedValue(status),
    disconnectDevice: vi.fn<() => Promise<DeviceStatus>>().mockResolvedValue(createDeviceStatus()),
    getDeviceStatus: vi.fn<() => DeviceStatus>().mockReturnValue(status),
    subscribeState: vi.fn<DeviceManagerApi['subscribeState']>(() => () => undefined),
    readDeviceRegisters: vi.fn<DeviceManagerApi['readDeviceRegisters']>().mockResolvedValue({
      deviceId: 'simulated-mixer-plc',
      values: [],
      timestamp: '2026-08-18T00:00:00.000Z'
    }),
    writeDeviceRegisters: vi.fn<DeviceManagerApi['writeDeviceRegisters']>().mockResolvedValue({
      deviceId: 'simulated-mixer-plc',
      point: {
        pointId: 'targetTemperature',
        area: 'holdingRegister',
        referenceAddress: '40001',
        pduAddress: 0,
        value: 62.5,
        rawValues: [625],
        formattedValue: '62.5 °C',
        unit: '°C',
        writable: true,
        timestamp: '2026-08-18T00:00:00.000Z'
      },
      timestamp: '2026-08-18T00:00:00.000Z'
    })
  }
}

function createCommandManager(): CommandManagerApi {
  return {
    executeCommand: vi.fn<CommandManagerApi['executeCommand']>().mockResolvedValue({
      commandId: 'start',
      deviceId: 'simulated-mixer-plc',
      targetPointId: 'deviceStartCommand',
      status: 'succeeded',
      writeAccepted: true,
      verificationStatus: 'verified',
      durationMs: 20,
      message: 'Command start succeeded.',
      timestamp: '2026-08-18T00:00:00.000Z'
    }),
    writeDeviceRegisters: vi.fn<CommandManagerApi['writeDeviceRegisters']>().mockResolvedValue({
      deviceId: 'simulated-mixer-plc',
      point: {
        pointId: 'targetTemperature',
        area: 'holdingRegister',
        referenceAddress: '40001',
        pduAddress: 0,
        value: 62.5,
        rawValues: [625],
        formattedValue: '62.5 °C',
        unit: '°C',
        writable: true,
        timestamp: '2026-08-18T00:00:00.000Z'
      },
      timestamp: '2026-08-18T00:00:00.000Z'
    })
  }
}

function createAlarmManager(): AlarmManagerApi {
  return {
    getAlarmSnapshot: vi.fn<AlarmManagerApi['getAlarmSnapshot']>(() => ({
      occurrences: [],
      emittedAt: '2026-08-18T00:00:00.000Z'
    })),
    acknowledgeAlarm: vi.fn<AlarmManagerApi['acknowledgeAlarm']>(() => ({
      id: 'alarm-temp-high-1787011200000',
      definitionId: 'alarm-temp-high',
      code: 'TEMP_HIGH',
      tagId: 'currentTemperature',
      level: 'High',
      message: 'Temperature is too high',
      status: 'Acknowledged',
      triggerTime: '2026-08-18T00:00:00.000Z',
      acknowledgeTime: '2026-08-18T00:01:00.000Z',
      triggerValue: 82,
      acknowledgeUser: 'operator',
      conditionActive: true,
      updatedAt: '2026-08-18T00:01:00.000Z'
    })),
    queryAlarmHistory: vi.fn<AlarmManagerApi['queryAlarmHistory']>(() => ({
      rows: [],
      emittedAt: '2026-08-18T00:00:00.000Z'
    }))
  }
}

function createAlarmSubscription(): AlarmSubscriptionApi {
  return {
    addSubscriber: vi.fn(),
    removeSubscriber: vi.fn()
  }
}

function createTrendManager(): TrendManagerApi {
  return {
    getRealtimeTrendSnapshot: vi.fn<TrendManagerApi['getRealtimeTrendSnapshot']>(() => ({
      points: [],
      emittedAt: '2026-08-18T00:00:00.000Z'
    })),
    queryHistoricalTrend: vi.fn<TrendManagerApi['queryHistoricalTrend']>(() => ({
      points: [],
      aggregated: false,
      startTime: '2026-08-18T00:00:00.000Z',
      endTime: '2026-08-18T01:00:00.000Z',
      emittedAt: '2026-08-18T01:00:00.000Z'
    }))
  }
}

function createTrendSubscription(): TrendSubscriptionApi {
  return {
    addSubscriber: vi.fn(),
    removeSubscriber: vi.fn()
  }
}

function createUpdateManager(): UpdateManagerApi {
  return {
    checkForUpdates: vi.fn(async () => undefined),
    downloadUpdate: vi.fn(async () => undefined),
    cancelUpdateDownload: vi.fn(() => undefined),
    openUpdateDownloadPage: vi.fn(async () => undefined),
    quitAndInstallUpdate: vi.fn(() => undefined)
  }
}

function createLogger(): Logger {
  return {
    write: vi.fn()
  }
}

function createTagSnapshot(): TagSnapshot {
  return {
    deviceId: 'simulated-mixer-plc',
    definitions: DEFAULT_TAG_DEFINITIONS,
    values: DEFAULT_TAG_DEFINITIONS.map((definition) => ({
      tagId: definition.id,
      value: null,
      quality: 'Uncertain',
      timestamp: '2026-08-18T00:00:00.000Z'
    })),
    emittedAt: '2026-08-18T00:00:00.000Z'
  }
}
