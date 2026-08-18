import type { AppErrorShape } from '../../shared/app-error'
import type {
  DevicePointValue,
  DeviceReadRequest,
  DeviceReadResponse,
  DeviceStatus,
  DeviceWriteRequest,
  DeviceWriteResponse
} from '../../shared/hmi-api'
import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_SIMULATOR_HOST,
  DEFAULT_SIMULATOR_PORT,
  DEFAULT_SIMULATOR_UNIT_ID,
  DEFAULT_PROCESS_READ_POINT_IDS,
  SIMULATED_MIXER_DEVICE_ID,
  decodeModbusPointValue,
  encodeModbusPointValue,
  formatModbusValue,
  getModbusPoint,
  type ModbusPointDefinition,
  type ModbusPointId,
  type ModbusRawValue
} from '../../shared/modbus'
import type { Logger } from '../logging/logger'
import { createDeviceError, DEVICE_ERROR_CODES } from '../protocol/errors'
import { ModbusAdapter } from '../protocol/modbus/ModbusAdapter'
import type {
  IProtocolAdapter,
  ProtocolAdapterStatus,
  ProtocolConnectionConfig,
  ProtocolReadResult
} from '../protocol/types'

export const DEFAULT_SIMULATED_DEVICE_CONFIG: ProtocolConnectionConfig = {
  deviceId: SIMULATED_MIXER_DEVICE_ID,
  host: DEFAULT_SIMULATOR_HOST,
  port: DEFAULT_SIMULATOR_PORT,
  unitId: DEFAULT_SIMULATOR_UNIT_ID,
  connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
  requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS
}

const DEFAULT_DEVICE_NAME = 'Simulated Mixer PLC'

export interface DeviceManagerDependencies {
  adapter: IProtocolAdapter
  logger: Logger
}

export class DeviceManager {
  constructor(private readonly dependencies: DeviceManagerDependencies) {}

  async connectDevice(): Promise<DeviceStatus> {
    await this.dependencies.adapter.connect(DEFAULT_SIMULATED_DEVICE_CONFIG)
    return this.getDeviceStatus()
  }

  async disconnectDevice(): Promise<DeviceStatus> {
    await this.dependencies.adapter.disconnect()
    return this.getDeviceStatus()
  }

  getDeviceStatus(): DeviceStatus {
    return toDeviceStatus(this.dependencies.adapter.getStatus())
  }

  async readDeviceRegisters(request: DeviceReadRequest): Promise<DeviceReadResponse> {
    const timestamp = new Date().toISOString()
    const pointIds = request.pointIds.length > 0
      ? request.pointIds
      : [...DEFAULT_PROCESS_READ_POINT_IDS]
    const values: DevicePointValue[] = []

    for (const pointId of pointIds) {
      const point = getModbusPoint(pointId)
      const result = await this.dependencies.adapter.read({
        area: point.area,
        address: point.pduAddress,
        quantity: point.quantity
      })

      values.push(createPointValue(point, result, timestamp))
    }

    return {
      deviceId: SIMULATED_MIXER_DEVICE_ID,
      values,
      timestamp
    }
  }

  async writeDeviceRegisters(request: DeviceWriteRequest): Promise<DeviceWriteResponse> {
    const point = getModbusPoint(request.pointId)

    if (point.access !== 'readWrite' || (point.area !== 'coil' && point.area !== 'holdingRegister')) {
      this.dependencies.logger.write({
        category: 'communication',
        level: 'warn',
        message: 'Rejected read-only device write',
        source: 'main:device-manager',
        context: {
          deviceId: SIMULATED_MIXER_DEVICE_ID,
          pointId: point.id,
          area: point.area,
          referenceAddress: point.referenceAddress
        }
      })
      throw createDeviceError(
        DEVICE_ERROR_CODES.writeRejected,
        'Selected point is read-only.',
        'main:device-manager',
        `pointId=${point.id}`
      )
    }

    const rawValues = encodeWritablePoint(point, request.value)
    await this.dependencies.adapter.write({
      area: point.area,
      address: point.pduAddress,
      values: rawValues
    })

    const timestamp = new Date().toISOString()
    const readBack = await this.dependencies.adapter.read({
      area: point.area,
      address: point.pduAddress,
      quantity: point.quantity
    })

    return {
      deviceId: SIMULATED_MIXER_DEVICE_ID,
      point: createPointValue(point, readBack, timestamp),
      timestamp
    }
  }
}

export function createDefaultDeviceManager(logger: Logger): DeviceManager {
  return new DeviceManager({
    adapter: new ModbusAdapter(logger),
    logger
  })
}

function toDeviceStatus(status: ProtocolAdapterStatus): DeviceStatus {
  return {
    deviceId: SIMULATED_MIXER_DEVICE_ID,
    name: DEFAULT_DEVICE_NAME,
    protocol: 'modbusTcp',
    connectionStatus: status.connectionStatus,
    endpoint: {
      host: DEFAULT_SIMULATED_DEVICE_CONFIG.host,
      port: DEFAULT_SIMULATED_DEVICE_CONFIG.port,
      unitId: status.unitId ?? DEFAULT_SIMULATED_DEVICE_CONFIG.unitId
    },
    lastSuccessfulAt: status.lastSuccessfulAt,
    lastError: status.lastError
  }
}

function createPointValue(
  point: ModbusPointDefinition,
  result: ProtocolReadResult,
  timestamp: string
): DevicePointValue {
  try {
    const value = decodeModbusPointValue(point, result.values)

    return {
      pointId: point.id as ModbusPointId,
      area: point.area,
      referenceAddress: point.referenceAddress,
      pduAddress: point.pduAddress,
      value,
      rawValues: result.values,
      formattedValue: formatModbusValue(point, value),
      unit: point.unit,
      writable: point.access === 'readWrite',
      timestamp
    }
  } catch (error) {
    throw createDeviceError(
      DEVICE_ERROR_CODES.protocolError,
      'Device point value could not be decoded.',
      'main:device-manager',
      `pointId=${point.id}`,
      error
    )
  }
}

function encodeWritablePoint(
  point: ModbusPointDefinition,
  value: DeviceWriteRequest['value']
): ModbusRawValue[] {
  try {
    return encodeModbusPointValue(point, value)
  } catch (error) {
    throw toWriteRejectedError(error, point)
  }
}

function toWriteRejectedError(error: unknown, point: ModbusPointDefinition): AppErrorShape {
  return createDeviceError(
    DEVICE_ERROR_CODES.writeRejected,
    'Device write value was rejected.',
    'main:device-manager',
    error instanceof Error ? `${point.id}: ${error.message}` : `${point.id}: ${String(error)}`
  )
}
