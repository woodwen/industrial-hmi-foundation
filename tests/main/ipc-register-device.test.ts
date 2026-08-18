import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DeviceManagerApi, UpdateManagerApi } from '../../src/main/ipc/register'
import type { Logger } from '../../src/main/logging/logger'
import type { DeviceReadResponse, DeviceStatus, HmiResult } from '../../src/shared/hmi-api'
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
