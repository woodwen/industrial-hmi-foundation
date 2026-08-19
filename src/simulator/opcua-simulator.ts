import {
  DataType,
  OPCUAServer,
  StatusCodes,
  Variant,
  type StatusCode,
  type Variant as OpcUaVariant
} from 'node-opcua'

import {
  DEFAULT_OPCUA_SIMULATOR_ENDPOINT_URL
} from '../shared/hmi-api'
import {
  DEFAULT_SIMULATOR_TICK_MS,
  decodeModbusPointValue,
  encodeModbusPointValue,
  getModbusPoint,
  type ModbusEngineeringValue,
  type ModbusPointId
} from '../shared/modbus'
import { ModbusMemoryMap } from './memory-map'
import { ProcessModel } from './process-model'

export interface OpcUaSimulatorConfig {
  endpointUrl: string
  host: string
  port: number
  resourcePath: string
  tickMs: number
}

export interface OpcUaSimulatorStatus {
  listening: boolean
  endpoint: string
  tickMs: number
}

interface OpcUaVariableMapping {
  nodeName: string
  pointId: ModbusPointId
  dataType: DataType
  writable: boolean
}

const OPCUA_VARIABLES: readonly OpcUaVariableMapping[] = [
  { nodeName: 'Temperature', pointId: 'currentTemperature', dataType: DataType.Double, writable: false },
  { nodeName: 'Level', pointId: 'currentLevel', dataType: DataType.Double, writable: false },
  { nodeName: 'Pressure', pointId: 'currentPressure', dataType: DataType.Double, writable: false },
  { nodeName: 'RPM', pointId: 'motorRpm', dataType: DataType.UInt16, writable: false },
  { nodeName: 'ProductionCount', pointId: 'productionCount', dataType: DataType.UInt32, writable: false },
  { nodeName: 'Running', pointId: 'deviceStartCommand', dataType: DataType.Boolean, writable: true },
  { nodeName: 'MotorRunning', pointId: 'mixerMotorCommand', dataType: DataType.Boolean, writable: true },
  { nodeName: 'InletValve', pointId: 'inletValveCommand', dataType: DataType.Boolean, writable: true },
  { nodeName: 'OutletValve', pointId: 'outletValveCommand', dataType: DataType.Boolean, writable: true },
  { nodeName: 'AutoMode', pointId: 'autoModeCommand', dataType: DataType.Boolean, writable: true },
  { nodeName: 'Setpoint', pointId: 'targetTemperature', dataType: DataType.Double, writable: true },
  { nodeName: 'ManualRpmSetpoint', pointId: 'manualMotorRpmSetpoint', dataType: DataType.UInt16, writable: true }
]

export class OpcUaSimulator {
  readonly memoryMap: ModbusMemoryMap
  private readonly processModel: ProcessModel
  private server: OPCUAServer | null = null
  private timer: NodeJS.Timeout | null = null
  private listening = false

  constructor(private readonly config: OpcUaSimulatorConfig = getDefaultOpcUaSimulatorConfig()) {
    this.memoryMap = new ModbusMemoryMap()
    this.processModel = new ProcessModel(this.memoryMap)
  }

  async start(): Promise<void> {
    if (this.server) {
      return
    }

    const server = new OPCUAServer({
      port: this.config.port,
      hostname: this.config.host,
      resourcePath: this.config.resourcePath,
      buildInfo: {
        productName: 'Industrial HMI OPC UA Simulator',
        buildNumber: '1',
        buildDate: new Date()
      }
    })

    await server.initialize()
    this.installAddressSpace(server)
    await server.start()

    this.server = server
    this.listening = true
    if (!this.timer) {
      this.timer = setInterval(() => {
        this.processModel.tick(this.config.tickMs)
      }, this.config.tickMs)
    }
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    const server = this.server
    this.server = null
    this.listening = false
    if (server) {
      await server.shutdown(1000)
    }
  }

  tick(deltaMs: number = this.config.tickMs): void {
    this.processModel.tick(deltaMs)
  }

  getStatus(): OpcUaSimulatorStatus {
    return {
      listening: this.listening,
      endpoint: this.config.endpointUrl,
      tickMs: this.config.tickMs
    }
  }

  private installAddressSpace(server: OPCUAServer): void {
    const addressSpace = server.engine.addressSpace
    if (!addressSpace) {
      throw new Error('OPC UA address space is not initialized.')
    }

    const namespace = addressSpace.getOwnNamespace()
    const mixer = namespace.addObject({
      browseName: 'SimulatedMixer',
      organizedBy: addressSpace.rootFolder.objects
    })

    for (const mapping of OPCUA_VARIABLES) {
      namespace.addVariable({
        browseName: mapping.nodeName,
        nodeId: `ns=1;s=${mapping.nodeName}`,
        componentOf: mixer,
        dataType: mapping.dataType,
        accessLevel: mapping.writable ? 'CurrentRead | CurrentWrite' : 'CurrentRead',
        userAccessLevel: mapping.writable ? 'CurrentRead | CurrentWrite' : 'CurrentRead',
        minimumSamplingInterval: this.config.tickMs,
        value: {
          get: () => new Variant({
            dataType: mapping.dataType,
            value: this.readPoint(mapping.pointId)
          }),
          set: mapping.writable
            ? (value: OpcUaVariant) => this.writePoint(mapping.pointId, value.value)
            : null
        }
      })
    }
  }

  private readPoint(pointId: ModbusPointId): ModbusEngineeringValue {
    const point = getModbusPoint(pointId)
    const rawValues = point.area === 'coil' || point.area === 'discreteInput'
      ? this.memoryMap.readBooleans(point.area, point.pduAddress, point.quantity)
      : this.memoryMap.readRegisters(point.area, point.pduAddress, point.quantity)

    return decodeModbusPointValue(point, rawValues)
  }

  private writePoint(pointId: ModbusPointId, value: unknown): StatusCode {
    const point = getModbusPoint(pointId)
    try {
      const rawValues = encodeModbusPointValue(point, normalizeWriteValue(pointId, value))
      if (point.area === 'coil') {
        this.memoryMap.writeCoils(point.pduAddress, rawValues.map((entry) => entry === true))
        return StatusCodes.Good
      }

      if (point.area === 'holdingRegister') {
        this.memoryMap.writeHoldingRegisters(
          point.pduAddress,
          rawValues.map((entry) => Number(entry))
        )
        return StatusCodes.Good
      }
    } catch {
      return StatusCodes.BadOutOfRange
    }

    return StatusCodes.BadNotWritable
  }
}

export function getDefaultOpcUaSimulatorConfig(env: NodeJS.ProcessEnv = process.env): OpcUaSimulatorConfig {
  const endpointUrl = env.HMI_OPCUA_ENDPOINT_URL ?? DEFAULT_OPCUA_SIMULATOR_ENDPOINT_URL
  const parsed = parseOpcUaEndpoint(endpointUrl)

  return {
    endpointUrl,
    host: env.HMI_OPCUA_HOST ?? parsed.host,
    port: parsePositiveInteger(env.HMI_OPCUA_PORT, parsed.port),
    resourcePath: env.HMI_OPCUA_RESOURCE_PATH ?? parsed.resourcePath,
    tickMs: parsePositiveInteger(env.HMI_SIMULATOR_TICK_MS, DEFAULT_SIMULATOR_TICK_MS)
  }
}

function normalizeWriteValue(pointId: ModbusPointId, value: unknown): ModbusEngineeringValue {
  const point = getModbusPoint(pointId)
  if (point.dataType === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new Error(`Point ${pointId} expects boolean.`)
    }
    return value
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Point ${pointId} expects number.`)
  }

  return value
}

function parseOpcUaEndpoint(endpointUrl: string): { host: string; port: number; resourcePath: string } {
  try {
    const parsed = new URL(endpointUrl)
    return {
      host: parsed.hostname || '127.0.0.1',
      port: parsed.port ? Number(parsed.port) : 4840,
      resourcePath: parsed.pathname || '/industrial-hmi-simulator'
    }
  } catch {
    return {
      host: '127.0.0.1',
      port: 4840,
      resourcePath: '/industrial-hmi-simulator'
    }
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
