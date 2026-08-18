export const MODBUS_REGISTER_AREAS = [
  'coil',
  'discreteInput',
  'holdingRegister',
  'inputRegister'
] as const

export const MODBUS_EXCEPTION_CODES = {
  illegalFunction: 0x01,
  illegalDataAddress: 0x02,
  illegalDataValue: 0x03,
  serverDeviceFailure: 0x04
} as const

export type ModbusRegisterArea = (typeof MODBUS_REGISTER_AREAS)[number]
export type ModbusAccessMode = 'read' | 'readWrite'
export type ModbusDataType = 'boolean' | 'int16' | 'uint16' | 'uint32'
export type ModbusEngineeringValue = boolean | number
export type ModbusRawValue = boolean | number
export type ModbusPointLabelLanguage = 'zh-CN' | 'en-US'

export interface ModbusPointDefinition {
  id: string
  area: ModbusRegisterArea
  referenceAddress: string
  pduAddress: number
  quantity: number
  dataType: ModbusDataType
  access: ModbusAccessMode
  scale: number
  unit: string
  min?: number
  max?: number
  labels: Record<ModbusPointLabelLanguage, string>
  description: string
}

export const SIMULATED_MIXER_DEVICE_ID = 'simulated-mixer-plc'
export const DEFAULT_SIMULATOR_HOST = '127.0.0.1'
export const DEFAULT_SIMULATOR_PORT = 1502
export const DEFAULT_SIMULATOR_UNIT_ID = 1
export const DEFAULT_CONNECT_TIMEOUT_MS = 3000
export const DEFAULT_REQUEST_TIMEOUT_MS = 2000
export const DEFAULT_SIMULATOR_TICK_MS = 250

export const INITIAL_PROCESS_VALUES = {
  currentTemperature: 25.0,
  targetTemperature: 60.0,
  currentLevel: 40.0,
  currentPressure: 0.12,
  motorRpm: 0,
  productionCount: 0
} as const

export const MODBUS_POINTS = {
  deviceStartCommand: {
    id: 'deviceStartCommand',
    area: 'coil',
    referenceAddress: '00001',
    pduAddress: 0,
    quantity: 1,
    dataType: 'boolean',
    access: 'readWrite',
    scale: 1,
    unit: '',
    labels: {
      'zh-CN': '设备启动',
      'en-US': 'Device Start'
    },
    description: '设备启动/停止命令'
  },
  mixerMotorCommand: {
    id: 'mixerMotorCommand',
    area: 'coil',
    referenceAddress: '00002',
    pduAddress: 1,
    quantity: 1,
    dataType: 'boolean',
    access: 'readWrite',
    scale: 1,
    unit: '',
    labels: {
      'zh-CN': '搅拌电机',
      'en-US': 'Mixer Motor'
    },
    description: '搅拌电机启停命令'
  },
  inletValveCommand: {
    id: 'inletValveCommand',
    area: 'coil',
    referenceAddress: '00003',
    pduAddress: 2,
    quantity: 1,
    dataType: 'boolean',
    access: 'readWrite',
    scale: 1,
    unit: '',
    labels: {
      'zh-CN': '进料阀',
      'en-US': 'Inlet Valve'
    },
    description: '进料阀开关命令'
  },
  outletValveCommand: {
    id: 'outletValveCommand',
    area: 'coil',
    referenceAddress: '00004',
    pduAddress: 3,
    quantity: 1,
    dataType: 'boolean',
    access: 'readWrite',
    scale: 1,
    unit: '',
    labels: {
      'zh-CN': '出料阀',
      'en-US': 'Outlet Valve'
    },
    description: '出料阀开关命令'
  },
  autoModeCommand: {
    id: 'autoModeCommand',
    area: 'coil',
    referenceAddress: '00005',
    pduAddress: 4,
    quantity: 1,
    dataType: 'boolean',
    access: 'readWrite',
    scale: 1,
    unit: '',
    labels: {
      'zh-CN': '自动模式',
      'en-US': 'Auto Mode'
    },
    description: '自动/手动模式命令'
  },
  deviceRunningStatus: {
    id: 'deviceRunningStatus',
    area: 'discreteInput',
    referenceAddress: '10001',
    pduAddress: 0,
    quantity: 1,
    dataType: 'boolean',
    access: 'read',
    scale: 1,
    unit: '',
    labels: {
      'zh-CN': '设备运行反馈',
      'en-US': 'Device Running Feedback'
    },
    description: '设备运行反馈'
  },
  mixerMotorRunningStatus: {
    id: 'mixerMotorRunningStatus',
    area: 'discreteInput',
    referenceAddress: '10002',
    pduAddress: 1,
    quantity: 1,
    dataType: 'boolean',
    access: 'read',
    scale: 1,
    unit: '',
    labels: {
      'zh-CN': '电机运行反馈',
      'en-US': 'Motor Running Feedback'
    },
    description: '搅拌电机运行反馈'
  },
  inletValveOpenStatus: {
    id: 'inletValveOpenStatus',
    area: 'discreteInput',
    referenceAddress: '10003',
    pduAddress: 2,
    quantity: 1,
    dataType: 'boolean',
    access: 'read',
    scale: 1,
    unit: '',
    labels: {
      'zh-CN': '进料阀反馈',
      'en-US': 'Inlet Valve Feedback'
    },
    description: '进料阀打开反馈'
  },
  outletValveOpenStatus: {
    id: 'outletValveOpenStatus',
    area: 'discreteInput',
    referenceAddress: '10004',
    pduAddress: 3,
    quantity: 1,
    dataType: 'boolean',
    access: 'read',
    scale: 1,
    unit: '',
    labels: {
      'zh-CN': '出料阀反馈',
      'en-US': 'Outlet Valve Feedback'
    },
    description: '出料阀打开反馈'
  },
  autoModeStatus: {
    id: 'autoModeStatus',
    area: 'discreteInput',
    referenceAddress: '10005',
    pduAddress: 4,
    quantity: 1,
    dataType: 'boolean',
    access: 'read',
    scale: 1,
    unit: '',
    labels: {
      'zh-CN': '自动模式反馈',
      'en-US': 'Auto Mode Feedback'
    },
    description: '自动模式反馈'
  },
  currentTemperature: {
    id: 'currentTemperature',
    area: 'inputRegister',
    referenceAddress: '30001',
    pduAddress: 0,
    quantity: 1,
    dataType: 'int16',
    access: 'read',
    scale: 0.1,
    unit: '°C',
    labels: {
      'zh-CN': '当前温度',
      'en-US': 'Current Temperature'
    },
    description: '当前温度'
  },
  currentLevel: {
    id: 'currentLevel',
    area: 'inputRegister',
    referenceAddress: '30002',
    pduAddress: 1,
    quantity: 1,
    dataType: 'uint16',
    access: 'read',
    scale: 0.1,
    unit: '%',
    labels: {
      'zh-CN': '当前液位',
      'en-US': 'Current Level'
    },
    description: '当前液位'
  },
  currentPressure: {
    id: 'currentPressure',
    area: 'inputRegister',
    referenceAddress: '30003',
    pduAddress: 2,
    quantity: 1,
    dataType: 'uint16',
    access: 'read',
    scale: 0.01,
    unit: 'MPa',
    labels: {
      'zh-CN': '当前压力',
      'en-US': 'Current Pressure'
    },
    description: '当前压力'
  },
  motorRpm: {
    id: 'motorRpm',
    area: 'inputRegister',
    referenceAddress: '30004',
    pduAddress: 3,
    quantity: 1,
    dataType: 'uint16',
    access: 'read',
    scale: 1,
    unit: 'rpm',
    labels: {
      'zh-CN': '电机转速',
      'en-US': 'Motor RPM'
    },
    description: '当前电机转速'
  },
  productionCount: {
    id: 'productionCount',
    area: 'inputRegister',
    referenceAddress: '30005-30006',
    pduAddress: 4,
    quantity: 2,
    dataType: 'uint32',
    access: 'read',
    scale: 1,
    unit: 'count',
    labels: {
      'zh-CN': '生产计数',
      'en-US': 'Production Count'
    },
    description: '生产计数，高字在前、低字在后'
  },
  targetTemperature: {
    id: 'targetTemperature',
    area: 'holdingRegister',
    referenceAddress: '40001',
    pduAddress: 0,
    quantity: 1,
    dataType: 'int16',
    access: 'readWrite',
    scale: 0.1,
    unit: '°C',
    min: 20.0,
    max: 90.0,
    labels: {
      'zh-CN': '目标温度',
      'en-US': 'Target Temperature'
    },
    description: '目标温度'
  },
  manualMotorRpmSetpoint: {
    id: 'manualMotorRpmSetpoint',
    area: 'holdingRegister',
    referenceAddress: '40002',
    pduAddress: 1,
    quantity: 1,
    dataType: 'uint16',
    access: 'readWrite',
    scale: 1,
    unit: 'rpm',
    min: 0,
    max: 1800,
    labels: {
      'zh-CN': '手动转速设定',
      'en-US': 'Manual RPM Setpoint'
    },
    description: '手动模式电机转速设定'
  }
} as const satisfies Record<string, ModbusPointDefinition>

export type ModbusPointId = keyof typeof MODBUS_POINTS

export const MODBUS_POINT_LIST = Object.values(MODBUS_POINTS) as ModbusPointDefinition[]

export const DEFAULT_PROCESS_READ_POINT_IDS = [
  'currentTemperature',
  'currentLevel',
  'currentPressure',
  'motorRpm',
  'productionCount',
  'targetTemperature',
  'manualMotorRpmSetpoint',
  'deviceStartCommand',
  'mixerMotorCommand',
  'inletValveCommand',
  'outletValveCommand',
  'autoModeCommand',
  'deviceRunningStatus',
  'mixerMotorRunningStatus',
  'inletValveOpenStatus',
  'outletValveOpenStatus',
  'autoModeStatus'
] as const satisfies readonly ModbusPointId[]

export const DEFAULT_WRITABLE_COIL_POINT_IDS = [
  'deviceStartCommand',
  'mixerMotorCommand',
  'inletValveCommand',
  'outletValveCommand',
  'autoModeCommand'
] as const satisfies readonly ModbusPointId[]

export function isModbusRegisterArea(value: unknown): value is ModbusRegisterArea {
  return typeof value === 'string' && (MODBUS_REGISTER_AREAS as readonly string[]).includes(value)
}

export function isModbusPointId(value: unknown): value is ModbusPointId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MODBUS_POINTS, value)
}

export function getModbusPoint(pointId: ModbusPointId): ModbusPointDefinition {
  return MODBUS_POINTS[pointId]
}

export function getModbusPointLabel(
  point: ModbusPointDefinition,
  language: ModbusPointLabelLanguage
): string {
  return point.labels[language] ?? point.labels['zh-CN']
}

export function decodeModbusPointValue(
  point: ModbusPointDefinition,
  rawValues: readonly ModbusRawValue[]
): ModbusEngineeringValue {
  if (rawValues.length !== point.quantity) {
    throw new Error(`Point ${point.id} expects ${point.quantity} raw values.`)
  }

  if (point.dataType === 'boolean') {
    const value = rawValues[0]
    if (typeof value !== 'boolean') {
      throw new Error(`Point ${point.id} expects a boolean raw value.`)
    }
    return value
  }

  const registers = rawValues.map((value) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 0xffff) {
      throw new Error(`Point ${point.id} expects uint16 register raw values.`)
    }
    return value
  })

  if (point.dataType === 'int16') {
    const signed = registers[0] & 0x8000 ? registers[0] - 0x10000 : registers[0]
    return roundEngineeringValue(signed * point.scale)
  }

  if (point.dataType === 'uint16') {
    return roundEngineeringValue(registers[0] * point.scale)
  }

  const combined = registers[0] * 0x10000 + registers[1]
  return combined * point.scale
}

export function encodeModbusPointValue(
  point: ModbusPointDefinition,
  value: ModbusEngineeringValue
): ModbusRawValue[] {
  if (point.access !== 'readWrite') {
    throw new Error(`Point ${point.id} is read-only.`)
  }

  if (point.dataType === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new Error(`Point ${point.id} expects a boolean value.`)
    }
    return [value]
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Point ${point.id} expects a numeric value.`)
  }

  if (point.min !== undefined && value < point.min) {
    throw new Error(`Point ${point.id} value is below ${point.min}.`)
  }

  if (point.max !== undefined && value > point.max) {
    throw new Error(`Point ${point.id} value is above ${point.max}.`)
  }

  const raw = Math.round(value / point.scale)

  if (point.dataType === 'int16') {
    if (raw < -0x8000 || raw > 0x7fff) {
      throw new Error(`Point ${point.id} raw value is outside int16 range.`)
    }
    return [raw < 0 ? raw + 0x10000 : raw]
  }

  if (point.dataType === 'uint16') {
    if (raw < 0 || raw > 0xffff) {
      throw new Error(`Point ${point.id} raw value is outside uint16 range.`)
    }
    return [raw]
  }

  if (raw < 0 || raw > 0xffffffff) {
    throw new Error(`Point ${point.id} raw value is outside uint32 range.`)
  }

  return [Math.floor(raw / 0x10000), raw & 0xffff]
}

export function formatModbusValue(point: ModbusPointDefinition, value: ModbusEngineeringValue): string {
  if (typeof value === 'boolean') {
    return value ? 'ON' : 'OFF'
  }

  if (point.scale < 1) {
    return `${value.toFixed(point.scale === 0.01 ? 2 : 1)}${point.unit ? ` ${point.unit}` : ''}`
  }

  return `${value}${point.unit ? ` ${point.unit}` : ''}`
}

function roundEngineeringValue(value: number): number {
  return Math.round(value * 1000) / 1000
}
