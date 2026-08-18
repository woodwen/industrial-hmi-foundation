import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

import type {
  AlarmAcknowledgeRequest,
  AlarmChangedEvent,
  AlarmHistoryQuery,
  AlarmHistoryResult,
  AlarmListener,
  AlarmOccurrence,
  AlarmSnapshot,
  AppUpdateEvent,
  AppInfo,
  AppUpdateListener,
  DeviceCommandRequest,
  DeviceCommandResult,
  DeviceReadRequest,
  DeviceReadResponse,
  DeviceStateChangedEvent,
  DeviceStateListener,
  DeviceStatus,
  DeviceWriteRequest,
  DeviceWriteResponse,
  ErrorReportInput,
  HistoricalTrendQuery,
  HistoricalTrendResult,
  HmiApi,
  HmiResult,
  LogEntryInput,
  RealtimeTrendChangedEvent,
  RealtimeTrendListener,
  RealtimeTrendRequest,
  RealtimeTrendSnapshot,
  TagSnapshot,
  TagValuesChangedEvent,
  TagValuesListener
} from '../../src/shared/hmi-api'
import { IPC_CHANNELS } from '../../src/shared/ipc-channels'

const electronMocks = vi.hoisted(() => {
  type IpcListener = (event: unknown, payload: unknown) => void

  const exposedApis = new Map<string, unknown>()
  const listeners = new Map<string, Set<IpcListener>>()
  const ipcRenderer = {
    invoke: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
    on: vi.fn((channel: string, listener: IpcListener) => {
      const channelListeners = listeners.get(channel) ?? new Set<IpcListener>()
      channelListeners.add(listener)
      listeners.set(channel, channelListeners)
    }),
    removeListener: vi.fn((channel: string, listener: IpcListener) => {
      listeners.get(channel)?.delete(listener)
    })
  }
  const contextBridge = {
    exposeInMainWorld: vi.fn((name: string, api: unknown) => {
      exposedApis.set(name, api)
    })
  }

  return {
    contextBridge,
    exposedApis,
    ipcRenderer,
    listeners
  }
})

vi.mock('electron', () => ({
  contextBridge: electronMocks.contextBridge,
  ipcRenderer: electronMocks.ipcRenderer
}))

describe('Preload HMI API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    electronMocks.exposedApis.clear()
    electronMocks.listeners.clear()
  })

  it('exposes the typed HMI API shape only', () => {
    expectTypeOf<HmiApi['app']['getInfo']>().returns.toEqualTypeOf<Promise<HmiResult<AppInfo>>>()
    expectTypeOf<HmiApi['log']['write']>().parameters.toEqualTypeOf<[LogEntryInput]>()
    expectTypeOf<HmiApi['log']['write']>().returns.toEqualTypeOf<Promise<HmiResult<void>>>()
    expectTypeOf<HmiApi['errors']['report']>().parameters.toEqualTypeOf<[ErrorReportInput]>()
    expectTypeOf<HmiApi['errors']['report']>().returns.toEqualTypeOf<Promise<HmiResult<void>>>()
    expectTypeOf<HmiApi['updates']['checkForUpdates']>().returns.toEqualTypeOf<Promise<HmiResult<void>>>()
    expectTypeOf<HmiApi['updates']['downloadUpdate']>().returns.toEqualTypeOf<Promise<HmiResult<void>>>()
    expectTypeOf<HmiApi['updates']['cancelUpdateDownload']>().returns.toEqualTypeOf<Promise<HmiResult<void>>>()
    expectTypeOf<HmiApi['updates']['openUpdateDownloadPage']>().parameters.toEqualTypeOf<[version?: string]>()
    expectTypeOf<HmiApi['updates']['quitAndInstallUpdate']>().returns.toEqualTypeOf<Promise<HmiResult<void>>>()
    expectTypeOf<HmiApi['updates']['onUpdateEvent']>().parameters.toEqualTypeOf<[AppUpdateListener]>()
    expectTypeOf<HmiApi['updates']['onUpdateEvent']>().returns.toEqualTypeOf<() => void>()
    expectTypeOf<HmiApi['devices']['connect']>().returns.toEqualTypeOf<Promise<HmiResult<DeviceStatus>>>()
    expectTypeOf<HmiApi['devices']['disconnect']>().returns.toEqualTypeOf<Promise<HmiResult<DeviceStatus>>>()
    expectTypeOf<HmiApi['devices']['getStatus']>().returns.toEqualTypeOf<Promise<HmiResult<DeviceStatus>>>()
    expectTypeOf<HmiApi['devices']['subscribeState']>().parameters.toEqualTypeOf<[DeviceStateListener]>()
    expectTypeOf<HmiApi['devices']['subscribeState']>().returns.toEqualTypeOf<() => void>()
    expectTypeOf<HmiApi['devices']['readRegisters']>().parameters.toEqualTypeOf<[DeviceReadRequest]>()
    expectTypeOf<HmiApi['devices']['readRegisters']>().returns.toEqualTypeOf<Promise<HmiResult<DeviceReadResponse>>>()
    expectTypeOf<HmiApi['devices']['writeRegisters']>().parameters.toEqualTypeOf<[DeviceWriteRequest]>()
    expectTypeOf<HmiApi['devices']['writeRegisters']>().returns.toEqualTypeOf<Promise<HmiResult<DeviceWriteResponse>>>()
    expectTypeOf<HmiApi['commands']['execute']>().parameters.toEqualTypeOf<[DeviceCommandRequest]>()
    expectTypeOf<HmiApi['commands']['execute']>().returns.toEqualTypeOf<Promise<HmiResult<DeviceCommandResult>>>()
    expectTypeOf<HmiApi['tags']['getSnapshot']>().returns.toEqualTypeOf<Promise<HmiResult<TagSnapshot>>>()
    expectTypeOf<HmiApi['tags']['subscribeValues']>().parameters.toEqualTypeOf<[TagValuesListener]>()
    expectTypeOf<HmiApi['tags']['subscribeValues']>().returns.toEqualTypeOf<() => void>()
    expectTypeOf<HmiApi['alarms']['getSnapshot']>().returns.toEqualTypeOf<Promise<HmiResult<AlarmSnapshot>>>()
    expectTypeOf<HmiApi['alarms']['subscribe']>().parameters.toEqualTypeOf<[AlarmListener]>()
    expectTypeOf<HmiApi['alarms']['subscribe']>().returns.toEqualTypeOf<() => void>()
    expectTypeOf<HmiApi['alarms']['acknowledge']>().parameters.toEqualTypeOf<[AlarmAcknowledgeRequest]>()
    expectTypeOf<HmiApi['alarms']['acknowledge']>().returns.toEqualTypeOf<Promise<HmiResult<AlarmOccurrence>>>()
    expectTypeOf<HmiApi['alarms']['queryHistory']>().parameters.toEqualTypeOf<[AlarmHistoryQuery]>()
    expectTypeOf<HmiApi['alarms']['queryHistory']>().returns.toEqualTypeOf<Promise<HmiResult<AlarmHistoryResult>>>()
    expectTypeOf<HmiApi['trends']['getRealtimeSnapshot']>().parameters.toEqualTypeOf<[RealtimeTrendRequest]>()
    expectTypeOf<HmiApi['trends']['getRealtimeSnapshot']>().returns.toEqualTypeOf<Promise<HmiResult<RealtimeTrendSnapshot>>>()
    expectTypeOf<HmiApi['trends']['subscribeRealtime']>().parameters.toEqualTypeOf<[RealtimeTrendRequest, RealtimeTrendListener]>()
    expectTypeOf<HmiApi['trends']['subscribeRealtime']>().returns.toEqualTypeOf<() => void>()
    expectTypeOf<HmiApi['trends']['queryHistorical']>().parameters.toEqualTypeOf<[HistoricalTrendQuery]>()
    expectTypeOf<HmiApi['trends']['queryHistorical']>().returns.toEqualTypeOf<Promise<HmiResult<HistoricalTrendResult>>>()
  })

  it('routes device methods through dedicated IPC channels', async () => {
    await import('../../src/preload/index')
    const hmiApi = electronMocks.exposedApis.get('hmi') as HmiApi
    const readRequest: DeviceReadRequest = {
      pointIds: ['currentTemperature']
    }
    const writeRequest: DeviceWriteRequest = {
      pointId: 'targetTemperature',
      value: 62.5
    }
    const commandRequest: DeviceCommandRequest = {
      commandId: 'start'
    }

    await hmiApi.devices.connect()
    await hmiApi.devices.disconnect()
    await hmiApi.devices.getStatus()
    await hmiApi.devices.readRegisters(readRequest)
    await hmiApi.devices.writeRegisters(writeRequest)
    await hmiApi.commands.execute(commandRequest)

    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.devices.connect)
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.devices.disconnect)
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.devices.getStatus)
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.devices.readRegisters, readRequest)
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.devices.writeRegisters, writeRequest)
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.commands.execute, commandRequest)
  })

  it('unsubscribes update event listeners from the preload bridge', async () => {
    await import('../../src/preload/index')
    const hmiApi = electronMocks.exposedApis.get('hmi') as HmiApi
    const listener = vi.fn<AppUpdateListener>()

    const unsubscribe = hmiApi.updates.onUpdateEvent(listener)

    emitUpdateEvent({ type: 'checking' })
    expect(listener).toHaveBeenCalledWith({ type: 'checking' })
    expect(electronMocks.ipcRenderer.on).toHaveBeenCalledWith(
      IPC_CHANNELS.updates.event,
      expect.any(Function)
    )

    unsubscribe()
    emitUpdateEvent({ type: 'available', version: '0.1.1' })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(electronMocks.ipcRenderer.removeListener).toHaveBeenCalledWith(
      IPC_CHANNELS.updates.event,
      expect.any(Function)
    )
  })

  it('routes Tag snapshot and subscription through dedicated IPC channels', async () => {
    await import('../../src/preload/index')
    const hmiApi = electronMocks.exposedApis.get('hmi') as HmiApi
    const listener = vi.fn<TagValuesListener>()

    await hmiApi.tags.getSnapshot()
    const unsubscribe = hmiApi.tags.subscribeValues(listener)
    emitTagValuesEvent({
      deviceId: 'simulated-mixer-plc',
      values: [{
        tagId: 'currentTemperature',
        value: 25.5,
        quality: 'Good',
        timestamp: '2026-08-18T00:00:00.000Z'
      }],
      emittedAt: '2026-08-18T00:00:00.000Z'
    })

    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.tags.getSnapshot)
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.tags.subscribe)
    expect(electronMocks.ipcRenderer.on).toHaveBeenCalledWith(
      IPC_CHANNELS.tags.valuesChanged,
      expect.any(Function)
    )
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      deviceId: 'simulated-mixer-plc'
    }))

    unsubscribe()

    expect(electronMocks.ipcRenderer.removeListener).toHaveBeenCalledWith(
      IPC_CHANNELS.tags.valuesChanged,
      expect.any(Function)
    )
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.tags.unsubscribe)
  })

  it('unsubscribes device state listeners from the preload bridge', async () => {
    await import('../../src/preload/index')
    const hmiApi = electronMocks.exposedApis.get('hmi') as HmiApi
    const listener = vi.fn<DeviceStateListener>()

    const unsubscribe = hmiApi.devices.subscribeState(listener)
    emitDeviceStateEvent({
      deviceId: 'simulated-mixer-plc',
      name: 'Simulated Mixer PLC',
      protocol: 'modbusTcp',
      connectionStatus: 'Reconnecting',
      endpoint: {
        host: '127.0.0.1',
        port: 1502,
        unitId: 1
      },
      emittedAt: '2026-08-18T00:00:00.000Z'
    })

    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.devices.subscribeState)
    expect(electronMocks.ipcRenderer.on).toHaveBeenCalledWith(
      IPC_CHANNELS.devices.stateChanged,
      expect.any(Function)
    )
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      connectionStatus: 'Reconnecting'
    }))

    unsubscribe()

    expect(electronMocks.ipcRenderer.removeListener).toHaveBeenCalledWith(
      IPC_CHANNELS.devices.stateChanged,
      expect.any(Function)
    )
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.devices.unsubscribeState)
  })

  it('routes alarm methods and subscription through dedicated IPC channels', async () => {
    await import('../../src/preload/index')
    const hmiApi = electronMocks.exposedApis.get('hmi') as HmiApi
    const listener = vi.fn<AlarmListener>()
    const acknowledgeRequest: AlarmAcknowledgeRequest = {
      occurrenceId: 'alarm-temp-high-1787011200000'
    }
    const historyQuery: AlarmHistoryQuery = {
      level: 'High',
      status: 'Recovered',
      tagId: 'currentTemperature',
      acknowledgeUser: 'operator'
    }

    await hmiApi.alarms.getSnapshot()
    const unsubscribe = hmiApi.alarms.subscribe(listener)
    emitAlarmEvent({
      occurrences: [{
        id: acknowledgeRequest.occurrenceId,
        definitionId: 'alarm-temp-high',
        code: 'TEMP_HIGH',
        tagId: 'currentTemperature',
        level: 'High',
        message: 'Temperature is too high',
        status: 'Active',
        triggerTime: '2026-08-18T00:00:00.000Z',
        triggerValue: 82,
        conditionActive: true,
        updatedAt: '2026-08-18T00:00:00.000Z'
      }],
      emittedAt: '2026-08-18T00:00:00.000Z'
    })
    await hmiApi.alarms.acknowledge(acknowledgeRequest)
    await hmiApi.alarms.queryHistory(historyQuery)

    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.alarms.getSnapshot)
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.alarms.subscribe)
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(
      IPC_CHANNELS.alarms.acknowledge,
      acknowledgeRequest
    )
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(
      IPC_CHANNELS.alarms.queryHistory,
      historyQuery
    )
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      occurrences: expect.any(Array)
    }))

    unsubscribe()

    expect(electronMocks.ipcRenderer.removeListener).toHaveBeenCalledWith(
      IPC_CHANNELS.alarms.changed,
      expect.any(Function)
    )
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.alarms.unsubscribe)
  })

  it('routes realtime and historical trend methods through dedicated IPC channels', async () => {
    await import('../../src/preload/index')
    const hmiApi = electronMocks.exposedApis.get('hmi') as HmiApi
    const listener = vi.fn<RealtimeTrendListener>()
    const request: RealtimeTrendRequest = {
      tagIds: ['currentTemperature', 'currentLevel']
    }
    const historicalQuery: HistoricalTrendQuery = {
      tagIds: ['currentTemperature'],
      preset: 'last1h',
      maxPointsPerTag: 1000
    }

    await hmiApi.trends.getRealtimeSnapshot(request)
    const unsubscribe = hmiApi.trends.subscribeRealtime(request, listener)
    emitRealtimeTrendEvent({
      points: [{
        tagId: 'currentTemperature',
        timestamp: '2026-08-18T00:00:00.000Z',
        value: 26,
        quality: 'Good'
      }],
      emittedAt: '2026-08-18T00:00:00.000Z'
    })
    await hmiApi.trends.queryHistorical(historicalQuery)

    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(
      IPC_CHANNELS.trends.getRealtimeSnapshot,
      request
    )
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(
      IPC_CHANNELS.trends.subscribeRealtime,
      request
    )
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(
      IPC_CHANNELS.trends.queryHistorical,
      historicalQuery
    )
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      points: expect.any(Array)
    }))

    unsubscribe()

    expect(electronMocks.ipcRenderer.removeListener).toHaveBeenCalledWith(
      IPC_CHANNELS.trends.realtimeChanged,
      expect.any(Function)
    )
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.trends.unsubscribeRealtime)
  })
})

function emitUpdateEvent(event: AppUpdateEvent): void {
  electronMocks.listeners.get(IPC_CHANNELS.updates.event)?.forEach((listener) => {
    listener({}, event)
  })
}

function emitTagValuesEvent(event: TagValuesChangedEvent): void {
  electronMocks.listeners.get(IPC_CHANNELS.tags.valuesChanged)?.forEach((listener) => {
    listener({}, event)
  })
}

function emitDeviceStateEvent(event: DeviceStateChangedEvent): void {
  electronMocks.listeners.get(IPC_CHANNELS.devices.stateChanged)?.forEach((listener) => {
    listener({}, event)
  })
}

function emitAlarmEvent(event: AlarmChangedEvent): void {
  electronMocks.listeners.get(IPC_CHANNELS.alarms.changed)?.forEach((listener) => {
    listener({}, event)
  })
}

function emitRealtimeTrendEvent(event: RealtimeTrendChangedEvent): void {
  electronMocks.listeners.get(IPC_CHANNELS.trends.realtimeChanged)?.forEach((listener) => {
    listener({}, event)
  })
}
