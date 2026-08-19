import {
  MODBUS_POINTS,
  SIMULATED_MIXER_DEVICE_ID,
  getModbusPointLabel,
  type ModbusDataType,
  type ModbusEngineeringValue,
  type ModbusPointDefinition,
  type ModbusPointId,
  type ModbusRegisterArea
} from './modbus'

export const TAG_QUALITIES = ['Good', 'Bad', 'Uncertain'] as const
export const TAG_SCAN_RATES_MS = [100, 500, 1000] as const

export type TagQuality = (typeof TAG_QUALITIES)[number]
export type TagScanRate = (typeof TAG_SCAN_RATES_MS)[number]
export type TagValueData = ModbusEngineeringValue | string | null
export type DashboardTagRole =
  | 'temperature'
  | 'level'
  | 'pressure'
  | 'rpm'
  | 'runningState'
  | 'mode'
  | 'productionCount'

export interface TagDefinition {
  id: string
  name: string
  deviceId: string
  address: number
  registerType: ModbusRegisterArea
  dataType: ModbusDataType
  scale: number
  offset: number
  unit: string
  writable: boolean
  scanRate: TagScanRate
  referenceAddress: string
  quantity: number
  description: string
  sourcePointId: ModbusPointId
  displayOrder: number
  dashboardRole?: DashboardTagRole
}

export interface TagValue {
  tagId: string
  value: TagValueData
  quality: TagQuality
  timestamp: string
}

export interface TagSnapshot {
  deviceId: string
  definitions: TagDefinition[]
  values: TagValue[]
  emittedAt: string
}

export interface TagValuesChangedEvent {
  deviceId: string
  values: TagValue[]
  emittedAt: string
}

interface DefaultTagMetadata {
  scanRate: TagScanRate
  displayOrder: number
  dashboardRole?: DashboardTagRole
}

const DEFAULT_TAG_METADATA = {
  currentTemperature: {
    scanRate: 500,
    displayOrder: 10,
    dashboardRole: 'temperature'
  },
  currentLevel: {
    scanRate: 500,
    displayOrder: 20,
    dashboardRole: 'level'
  },
  currentPressure: {
    scanRate: 500,
    displayOrder: 30,
    dashboardRole: 'pressure'
  },
  motorRpm: {
    scanRate: 500,
    displayOrder: 40,
    dashboardRole: 'rpm'
  },
  productionCount: {
    scanRate: 1000,
    displayOrder: 50,
    dashboardRole: 'productionCount'
  },
  deviceRunningStatus: {
    scanRate: 500,
    displayOrder: 60,
    dashboardRole: 'runningState'
  },
  mixerMotorRunningStatus: {
    scanRate: 500,
    displayOrder: 65
  },
  autoModeStatus: {
    scanRate: 500,
    displayOrder: 70,
    dashboardRole: 'mode'
  },
  targetTemperature: {
    scanRate: 1000,
    displayOrder: 80
  },
  manualMotorRpmSetpoint: {
    scanRate: 1000,
    displayOrder: 90
  }
} as const satisfies Partial<Record<ModbusPointId, DefaultTagMetadata>>

export const DEFAULT_MONITORING_TAG_IDS = [
  'currentTemperature',
  'currentLevel',
  'currentPressure',
  'motorRpm',
  'productionCount',
  'deviceRunningStatus',
  'mixerMotorRunningStatus',
  'autoModeStatus',
  'targetTemperature',
  'manualMotorRpmSetpoint'
] as const satisfies readonly ModbusPointId[]

export const DEFAULT_TAG_DEFINITIONS: TagDefinition[] = DEFAULT_MONITORING_TAG_IDS
  .map((pointId) => createTagDefinition(pointId, MODBUS_POINTS[pointId], DEFAULT_TAG_METADATA[pointId]))
  .sort((left, right) => left.displayOrder - right.displayOrder)

export function isTagQuality(value: unknown): value is TagQuality {
  return typeof value === 'string' && (TAG_QUALITIES as readonly string[]).includes(value)
}

export function isTagScanRate(value: unknown): value is TagScanRate {
  return typeof value === 'number' && (TAG_SCAN_RATES_MS as readonly number[]).includes(value)
}

export function formatTagValue(definition: TagDefinition, value: TagValueData): string {
  if (value === null) {
    return '-'
  }

  if (typeof value === 'boolean') {
    return value ? 'ON' : 'OFF'
  }

  if (typeof value === 'number') {
    if (definition.scale < 1) {
      const decimals = definition.scale === 0.01 ? 2 : 1
      return `${value.toFixed(decimals)}${definition.unit ? ` ${definition.unit}` : ''}`
    }

    return `${value}${definition.unit ? ` ${definition.unit}` : ''}`
  }

  return value
}

function createTagDefinition(
  pointId: ModbusPointId,
  point: ModbusPointDefinition,
  metadata: DefaultTagMetadata
): TagDefinition {
  return {
    id: point.id,
    name: getModbusPointLabel(point, 'zh-CN'),
    deviceId: SIMULATED_MIXER_DEVICE_ID,
    address: point.pduAddress,
    registerType: point.area,
    dataType: point.dataType,
    scale: point.scale,
    offset: 0,
    unit: point.unit,
    writable: point.access === 'readWrite',
    scanRate: metadata.scanRate,
    referenceAddress: point.referenceAddress,
    quantity: point.quantity,
    description: point.description,
    sourcePointId: pointId,
    displayOrder: metadata.displayOrder,
    dashboardRole: metadata.dashboardRole
  }
}
