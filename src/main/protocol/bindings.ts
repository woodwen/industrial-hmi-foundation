import {
  MODBUS_POINT_LIST,
  getModbusPoint,
  type ModbusPointId,
  type ModbusRegisterArea
} from '../../shared/modbus'
import { DEFAULT_OPCUA_SIMULATOR_ENDPOINT_URL } from '../../shared/hmi-api'
import type {
  ModbusProtocolBinding,
  OpcUaProtocolBinding,
  ProtocolDataBinding,
  ProtocolKind,
  ProtocolReadRequest,
  ProtocolWriteRequest,
  ProtocolValueDataType
} from './types'

export const DEFAULT_OPCUA_ENDPOINT_URL = DEFAULT_OPCUA_SIMULATOR_ENDPOINT_URL
export const DEFAULT_OPCUA_NAMESPACE_URI = 'urn:industrial-hmi:simulator'

interface OpcUaPointBindingDefinition {
  nodeName: string
  dataType: ProtocolValueDataType
  writable: boolean
}

const OPCUA_POINT_BINDINGS = {
  deviceStartCommand: {
    nodeName: 'Running',
    dataType: 'boolean',
    writable: true
  },
  mixerMotorCommand: {
    nodeName: 'MotorRunning',
    dataType: 'boolean',
    writable: true
  },
  inletValveCommand: {
    nodeName: 'InletValve',
    dataType: 'boolean',
    writable: true
  },
  outletValveCommand: {
    nodeName: 'OutletValve',
    dataType: 'boolean',
    writable: true
  },
  autoModeCommand: {
    nodeName: 'AutoMode',
    dataType: 'boolean',
    writable: true
  },
  deviceRunningStatus: {
    nodeName: 'Running',
    dataType: 'boolean',
    writable: false
  },
  mixerMotorRunningStatus: {
    nodeName: 'MotorRunning',
    dataType: 'boolean',
    writable: false
  },
  inletValveOpenStatus: {
    nodeName: 'InletValve',
    dataType: 'boolean',
    writable: false
  },
  outletValveOpenStatus: {
    nodeName: 'OutletValve',
    dataType: 'boolean',
    writable: false
  },
  autoModeStatus: {
    nodeName: 'AutoMode',
    dataType: 'boolean',
    writable: false
  },
  currentTemperature: {
    nodeName: 'Temperature',
    dataType: 'double',
    writable: false
  },
  currentLevel: {
    nodeName: 'Level',
    dataType: 'double',
    writable: false
  },
  currentPressure: {
    nodeName: 'Pressure',
    dataType: 'double',
    writable: false
  },
  motorRpm: {
    nodeName: 'RPM',
    dataType: 'uint16',
    writable: false
  },
  productionCount: {
    nodeName: 'ProductionCount',
    dataType: 'uint32',
    writable: false
  },
  targetTemperature: {
    nodeName: 'Setpoint',
    dataType: 'double',
    writable: true
  },
  manualMotorRpmSetpoint: {
    nodeName: 'ManualRpmSetpoint',
    dataType: 'uint16',
    writable: true
  }
} as const satisfies Record<ModbusPointId, OpcUaPointBindingDefinition>

const POINT_ID_BY_MODBUS_ADDRESS = new Map<string, ModbusPointId>(
  MODBUS_POINT_LIST.map((point) => [modbusAddressKey(point.area, point.pduAddress, point.quantity), point.id as ModbusPointId])
)

const POINT_ID_BY_OPCUA_NODE_ID = new Map<string, ModbusPointId>(
  Object.entries(OPCUA_POINT_BINDINGS).map(([pointId, binding]) => [
    createOpcUaNodeId(binding.nodeName),
    pointId as ModbusPointId
  ])
)

export function createProtocolBinding(
  protocol: ProtocolKind,
  pointId: ModbusPointId,
  samplingIntervalMs: number
): ProtocolDataBinding {
  return protocol === 'opcUa'
    ? createOpcUaBinding(pointId, samplingIntervalMs)
    : createModbusBinding(pointId)
}

export function createModbusBinding(pointId: ModbusPointId): ModbusProtocolBinding {
  const point = getModbusPoint(pointId)
  return {
    protocol: 'modbusTcp',
    area: point.area,
    address: point.pduAddress,
    quantity: point.quantity
  }
}

export function createOpcUaBinding(pointId: ModbusPointId, samplingIntervalMs: number): OpcUaProtocolBinding {
  const definition = OPCUA_POINT_BINDINGS[pointId]
  return {
    protocol: 'opcUa',
    nodeId: createOpcUaNodeId(definition.nodeName),
    dataType: definition.dataType,
    samplingIntervalMs,
    writable: definition.writable
  }
}

export function getPointIdForProtocolRequest(
  request: ProtocolReadRequest | ProtocolWriteRequest
): ModbusPointId | undefined {
  const quantity = 'quantity' in request ? request.quantity : request.values.length
  const pointId = POINT_ID_BY_MODBUS_ADDRESS.get(modbusAddressKey(request.area, request.address, quantity))
  if (pointId) {
    return pointId
  }

  if (request.binding?.protocol === 'opcUa') {
    return POINT_ID_BY_OPCUA_NODE_ID.get(request.binding.nodeId)
  }

  if (request.binding?.protocol === 'modbusTcp') {
    return POINT_ID_BY_MODBUS_ADDRESS.get(
      modbusAddressKey(request.binding.area, request.binding.address, request.binding.quantity)
    )
  }

  return undefined
}

export function getPointIdForOpcUaNodeId(nodeId: string): ModbusPointId | undefined {
  return POINT_ID_BY_OPCUA_NODE_ID.get(nodeId)
}

export function listOpcUaBindings(
  pointIds: readonly ModbusPointId[],
  samplingIntervalMs: number
): OpcUaProtocolBinding[] {
  return pointIds.map((pointId) => createOpcUaBinding(pointId, samplingIntervalMs))
}

function createOpcUaNodeId(nodeName: string): string {
  return `ns=1;s=${nodeName}`
}

function modbusAddressKey(area: ModbusRegisterArea, address: number, quantity: number): string {
  return `${area}:${address}:${quantity}`
}
