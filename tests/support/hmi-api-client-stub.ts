import { vi } from 'vitest'

import type { HmiApiClient } from '../../src/renderer/application/AppApplicationService'
import type {
  DeviceCommandResult,
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
    subscribeDeviceState: vi.fn<HmiApiClient['subscribeDeviceState']>(() => () => undefined),
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
    executeCommand: vi.fn<HmiApiClient['executeCommand']>().mockResolvedValue(success(createCommandResult())),
    getTagSnapshot: vi.fn<HmiApiClient['getTagSnapshot']>().mockResolvedValue(success(createTagSnapshot())),
    subscribeTagValues: vi.fn<HmiApiClient['subscribeTagValues']>(() => () => undefined),
    getAlarmSnapshot: vi.fn<HmiApiClient['getAlarmSnapshot']>().mockResolvedValue(success({
      occurrences: [],
      emittedAt: '2026-08-18T00:00:00.000Z'
    })),
    subscribeAlarms: vi.fn<HmiApiClient['subscribeAlarms']>(() => () => undefined),
    acknowledgeAlarm: vi.fn<HmiApiClient['acknowledgeAlarm']>().mockRejectedValue(new Error('No alarm occurrence.')),
    queryAlarmHistory: vi.fn<HmiApiClient['queryAlarmHistory']>().mockResolvedValue(success({
      rows: [],
      emittedAt: '2026-08-18T00:00:00.000Z'
    })),
    getRealtimeTrendSnapshot: vi.fn<HmiApiClient['getRealtimeTrendSnapshot']>().mockResolvedValue(success({
      points: [],
      emittedAt: '2026-08-18T00:00:00.000Z'
    })),
    subscribeRealtimeTrend: vi.fn<HmiApiClient['subscribeRealtimeTrend']>(() => () => undefined),
    queryHistoricalTrend: vi.fn<HmiApiClient['queryHistoricalTrend']>().mockResolvedValue(success({
      points: [],
      aggregated: false,
      startTime: '2026-08-18T00:00:00.000Z',
      endTime: '2026-08-18T00:00:00.000Z',
      emittedAt: '2026-08-18T00:00:00.000Z'
    })),
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

function createCommandResult(): DeviceCommandResult {
  return {
    commandId: 'setTargetTemperature',
    deviceId: SIMULATED_MIXER_DEVICE_ID,
    targetPointId: 'targetTemperature',
    status: 'succeeded',
    writeAccepted: true,
    verificationStatus: 'verified',
    durationMs: 12,
    message: 'Command setTargetTemperature succeeded.',
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
  }
}
