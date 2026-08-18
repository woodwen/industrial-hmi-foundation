import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

import type {
  AppUpdateEvent,
  AppInfo,
  AppUpdateListener,
  DeviceReadRequest,
  DeviceReadResponse,
  DeviceStatus,
  DeviceWriteRequest,
  DeviceWriteResponse,
  ErrorReportInput,
  HmiApi,
  HmiResult,
  LogEntryInput
} from '../../src/shared/hmi-api'
import { IPC_CHANNELS } from '../../src/shared/ipc-channels'

const electronMocks = vi.hoisted(() => {
  type IpcListener = (event: unknown, updateEvent: AppUpdateEvent) => void

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
    expectTypeOf<HmiApi['devices']['readRegisters']>().parameters.toEqualTypeOf<[DeviceReadRequest]>()
    expectTypeOf<HmiApi['devices']['readRegisters']>().returns.toEqualTypeOf<Promise<HmiResult<DeviceReadResponse>>>()
    expectTypeOf<HmiApi['devices']['writeRegisters']>().parameters.toEqualTypeOf<[DeviceWriteRequest]>()
    expectTypeOf<HmiApi['devices']['writeRegisters']>().returns.toEqualTypeOf<Promise<HmiResult<DeviceWriteResponse>>>()
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

    await hmiApi.devices.connect()
    await hmiApi.devices.disconnect()
    await hmiApi.devices.getStatus()
    await hmiApi.devices.readRegisters(readRequest)
    await hmiApi.devices.writeRegisters(writeRequest)

    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.devices.connect)
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.devices.disconnect)
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.devices.getStatus)
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.devices.readRegisters, readRequest)
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS.devices.writeRegisters, writeRequest)
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
})

function emitUpdateEvent(event: AppUpdateEvent): void {
  electronMocks.listeners.get(IPC_CHANNELS.updates.event)?.forEach((listener) => {
    listener({}, event)
  })
}
