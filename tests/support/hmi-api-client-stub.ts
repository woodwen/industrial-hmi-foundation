import { vi } from 'vitest'

import type { HmiApiClient } from '../../src/renderer/application/AppApplicationService'
import type {
  AuditRecord,
  DeviceCommandResult,
  DeviceStatus,
  HmiResult,
  RecipeDto,
  RecipeParameterDefinition,
  SimulatorRuntimeStatus,
  SimulatorStatusSnapshot
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
    updateDeviceConfig: vi.fn<HmiApiClient['updateDeviceConfig']>().mockResolvedValue(success(defaultDeviceStatus)),
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
    getCurrentUser: vi.fn<HmiApiClient['getCurrentUser']>().mockResolvedValue(success({
      user: {
        id: 'user-admin',
        username: 'admin',
        displayName: 'Admin',
        role: 'Admin',
        enabled: true,
        createdAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-18T00:00:00.000Z'
      },
      permissions: [
        'device:view',
        'device:start-stop',
        'device:advanced-control',
        'alarm:acknowledge',
        'recipe:read',
        'recipe:write',
        'recipe:download',
        'parameter:write',
        'tag-config:write',
        'audit:read',
        'user:manage',
        'system-config:write'
      ],
      requiresInitialization: false
    })),
    createFirstAdmin: vi.fn<HmiApiClient['createFirstAdmin']>().mockResolvedValue(success({
      id: 'user-admin',
      username: 'admin',
      displayName: 'Admin',
      role: 'Admin',
      enabled: true,
      createdAt: '2026-08-18T00:00:00.000Z',
      updatedAt: '2026-08-18T00:00:00.000Z'
    })),
    login: vi.fn<HmiApiClient['login']>().mockResolvedValue(success({
      user: null,
      permissions: [],
      requiresInitialization: false
    })),
    logout: vi.fn<HmiApiClient['logout']>().mockResolvedValue(success({
      user: null,
      permissions: [],
      requiresInitialization: false
    })),
    listUsers: vi.fn<HmiApiClient['listUsers']>().mockResolvedValue(success({
      users: [],
      emittedAt: '2026-08-18T00:00:00.000Z'
    })),
    createUser: vi.fn<HmiApiClient['createUser']>().mockResolvedValue(success({
      id: 'user-operator',
      username: 'operator',
      displayName: 'Operator',
      role: 'Operator',
      enabled: true,
      createdAt: '2026-08-18T00:00:00.000Z',
      updatedAt: '2026-08-18T00:00:00.000Z'
    })),
    updateUserRole: vi.fn<HmiApiClient['updateUserRole']>().mockResolvedValue(success({
      id: 'user-operator',
      username: 'operator',
      displayName: 'Operator',
      role: 'Engineer',
      enabled: true,
      createdAt: '2026-08-18T00:00:00.000Z',
      updatedAt: '2026-08-18T00:00:00.000Z'
    })),
    setUserEnabled: vi.fn<HmiApiClient['setUserEnabled']>().mockResolvedValue(success({
      id: 'user-operator',
      username: 'operator',
      displayName: 'Operator',
      role: 'Operator',
      enabled: false,
      createdAt: '2026-08-18T00:00:00.000Z',
      updatedAt: '2026-08-18T00:00:00.000Z'
    })),
    listRecipes: vi.fn<HmiApiClient['listRecipes']>().mockResolvedValue(success({
      recipes: [],
      emittedAt: '2026-08-18T00:00:00.000Z'
    })),
    getRecipeParameterDefinitions: vi.fn<HmiApiClient['getRecipeParameterDefinitions']>().mockResolvedValue(success(
      createRecipeParameterDefinitions()
    )),
    validateRecipe: vi.fn<HmiApiClient['validateRecipe']>().mockResolvedValue(success({
      valid: true,
      issues: []
    })),
    createRecipe: vi.fn<HmiApiClient['createRecipe']>().mockResolvedValue(success(createRecipe())),
    updateRecipe: vi.fn<HmiApiClient['updateRecipe']>().mockResolvedValue(success(createRecipe())),
    copyRecipe: vi.fn<HmiApiClient['copyRecipe']>().mockResolvedValue(success(createRecipe())),
    deleteRecipe: vi.fn<HmiApiClient['deleteRecipe']>().mockResolvedValue(success(undefined)),
    downloadRecipe: vi.fn<HmiApiClient['downloadRecipe']>().mockResolvedValue(success({
      downloadId: 'download-1',
      recipeId: 'recipe-1',
      recipeVersion: 1,
      status: 'Succeeded',
      message: 'Recipe download succeeded.',
      steps: [],
      startedAt: '2026-08-18T00:00:00.000Z',
      completedAt: '2026-08-18T00:00:00.000Z'
    })),
    queryAuditLog: vi.fn<HmiApiClient['queryAuditLog']>().mockResolvedValue(success({
      rows: [],
      emittedAt: '2026-08-18T00:00:00.000Z'
    })),
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
    getSimulatorStatus: vi.fn<HmiApiClient['getSimulatorStatus']>().mockResolvedValue(success(createSimulatorSnapshot())),
    startSimulator: vi.fn<HmiApiClient['startSimulator']>().mockImplementation(async (request) => success({
      ...createSimulatorStatus(request.kind),
      status: 'Running',
      managed: true,
      pid: 7301
    })),
    stopSimulator: vi.fn<HmiApiClient['stopSimulator']>().mockImplementation(async (request) => success({
      ...createSimulatorStatus(request.kind),
      status: 'Stopped',
      managed: false
    })),
    subscribeSimulatorStatus: vi.fn<HmiApiClient['subscribeSimulatorStatus']>(() => () => undefined),
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

function createSimulatorSnapshot(): SimulatorStatusSnapshot {
  return {
    simulators: [
      createSimulatorStatus('modbusTcp'),
      createSimulatorStatus('opcUa')
    ],
    emittedAt: '2026-08-18T00:00:00.000Z'
  }
}

function createSimulatorStatus(kind: SimulatorRuntimeStatus['kind']): SimulatorRuntimeStatus {
  return {
    kind,
    status: 'Stopped',
    endpoint: kind === 'opcUa'
      ? {
          label: 'opc.tcp://127.0.0.1:4840/industrial-hmi-simulator',
          endpointUrl: 'opc.tcp://127.0.0.1:4840/industrial-hmi-simulator'
        }
      : {
          label: '127.0.0.1:1502/unit-1',
          host: '127.0.0.1',
          port: 1502,
          unitId: 1
        },
    managed: false,
    updatedAt: '2026-08-18T00:00:00.000Z'
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

export function createRecipe(): RecipeDto {
  return {
    id: 'recipe-1',
    name: 'Standard Mixer Recipe',
    description: 'Simulator recipe',
    version: 1,
    parameters: {
      targetTemperature: 60,
      rpmSetpoint: 900,
      mixDuration: 300,
      feedDuration: 120
    },
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z'
  }
}

export function createRecipeParameterDefinitions(): RecipeParameterDefinition[] {
  return [
    {
      key: 'targetTemperature',
      label: 'Target Temperature',
      unit: '°C',
      dataType: 'number',
      required: true,
      min: 20,
      max: 90,
      commandId: 'setTargetTemperature'
    },
    {
      key: 'rpmSetpoint',
      label: 'RPM Setpoint',
      unit: 'rpm',
      dataType: 'number',
      required: true,
      min: 0,
      max: 1800,
      commandId: 'setRpmSetpoint'
    },
    {
      key: 'mixDuration',
      label: 'Mix Duration',
      unit: 's',
      dataType: 'number',
      required: true,
      min: 1,
      max: 3600
    },
    {
      key: 'feedDuration',
      label: 'Feed Duration',
      unit: 's',
      dataType: 'number',
      required: true,
      min: 1,
      max: 1800
    }
  ]
}

export function createAuditRecord(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    id: 'audit-1',
    timestamp: '2026-08-18T00:00:00.000Z',
    user: 'engineer',
    role: 'Engineer',
    action: 'Recipe Download',
    target: 'recipe:recipe-1',
    oldValue: null,
    newValue: {
      recipeId: 'recipe-1',
      version: 1,
      steps: [
        {
          parameterKey: 'targetTemperature',
          status: 'Verified'
        },
        {
          parameterKey: 'rpmSetpoint',
          status: 'WriteFailed'
        }
      ]
    },
    result: 'PartialFailed',
    ...overrides
  }
}
