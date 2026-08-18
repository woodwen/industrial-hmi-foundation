import { vi } from 'vitest'

import type { HmiApiClient } from '../../src/renderer/application/AppApplicationService'
import type {
  DeviceStatus,
  HmiResult
} from '../../src/shared/hmi-api'
import {
  DEFAULT_SIMULATOR_HOST,
  DEFAULT_SIMULATOR_PORT,
  DEFAULT_SIMULATOR_UNIT_ID,
  SIMULATED_MIXER_DEVICE_ID
} from '../../src/shared/modbus'
import { DEFAULT_TAG_DEFINITIONS, type TagSnapshot } from '../../src/shared/tag'

export function createApiClientStub(overrides: Partial<HmiApiClient> = {}): HmiApiClient {
  const defaultDeviceStatus = createDeviceStatus()

  return {
    getAppInfo: vi.fn<HmiApiClient['getAppInfo']>().mockResolvedValue({
      ok: true,
      data: {
        name: 'Industrial HMI Foundation',
        version: '0.1.0',
        environment: 'development'
      }
    }),
    writeLog: vi.fn<HmiApiClient['writeLog']>().mockResolvedValue(success(undefined)),
    reportError: vi.fn<HmiApiClient['reportError']>().mockResolvedValue(success(undefined)),
    checkForUpdates: vi.fn<HmiApiClient['checkForUpdates']>().mockResolvedValue(success(undefined)),
    downloadUpdate: vi.fn<HmiApiClient['downloadUpdate']>().mockResolvedValue(success(undefined)),
    cancelUpdateDownload: vi.fn<HmiApiClient['cancelUpdateDownload']>().mockResolvedValue(success(undefined)),
    openUpdateDownloadPage: vi.fn<HmiApiClient['openUpdateDownloadPage']>().mockResolvedValue(success(undefined)),
    quitAndInstallUpdate: vi.fn<HmiApiClient['quitAndInstallUpdate']>().mockResolvedValue(success(undefined)),
    onUpdateEvent: vi.fn<HmiApiClient['onUpdateEvent']>(() => () => undefined),
    connectDevice: vi.fn<HmiApiClient['connectDevice']>().mockResolvedValue(success({
      ...defaultDeviceStatus,
      connectionStatus: 'Connected'
    })),
    disconnectDevice: vi.fn<HmiApiClient['disconnectDevice']>().mockResolvedValue(success(defaultDeviceStatus)),
    getDeviceStatus: vi.fn<HmiApiClient['getDeviceStatus']>().mockResolvedValue(success(defaultDeviceStatus)),
    readDeviceRegisters: vi.fn<HmiApiClient['readDeviceRegisters']>().mockResolvedValue(success({
      deviceId: SIMULATED_MIXER_DEVICE_ID,
      values: [],
      timestamp: '2026-08-18T00:00:00.000Z'
    })),
    writeDeviceRegisters: vi.fn<HmiApiClient['writeDeviceRegisters']>().mockResolvedValue(success({
      deviceId: SIMULATED_MIXER_DEVICE_ID,
      point: {
        pointId: 'targetTemperature',
        area: 'holdingRegister',
        referenceAddress: '40001',
        pduAddress: 0,
        value: 60,
        rawValues: [600],
        formattedValue: '60.0 °C',
        unit: '°C',
        writable: true,
        timestamp: '2026-08-18T00:00:00.000Z'
      },
      timestamp: '2026-08-18T00:00:00.000Z'
    })),
    getTagSnapshot: vi.fn<HmiApiClient['getTagSnapshot']>().mockResolvedValue(success(createTagSnapshot())),
    subscribeTagValues: vi.fn<HmiApiClient['subscribeTagValues']>(() => () => undefined),
    ...overrides
  }
}

export function createDeviceStatus(connectionStatus: DeviceStatus['connectionStatus'] = 'Disconnected'): DeviceStatus {
  return {
    deviceId: SIMULATED_MIXER_DEVICE_ID,
    name: 'Simulated Mixer PLC',
    protocol: 'modbusTcp',
    connectionStatus,
    endpoint: {
      host: DEFAULT_SIMULATOR_HOST,
      port: DEFAULT_SIMULATOR_PORT,
      unitId: DEFAULT_SIMULATOR_UNIT_ID
    }
  }
}

function success<T>(data: T): HmiResult<T> {
  return {
    ok: true,
    data
  }
}

function createTagSnapshot(): TagSnapshot {
  return {
    deviceId: SIMULATED_MIXER_DEVICE_ID,
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
