import {
  DEFAULT_SIMULATOR_HOST,
  DEFAULT_SIMULATOR_PORT,
  DEFAULT_SIMULATOR_TICK_MS,
  DEFAULT_SIMULATOR_UNIT_ID
} from '../shared/modbus'
import { ModbusTcpServer } from './modbus-tcp-server'
import type { WriteFailureMode } from './modbus-tcp-server'
import { ModbusMemoryMap } from './memory-map'
import { ProcessModel } from './process-model'

export interface PlcSimulatorConfig {
  host: string
  port: number
  unitId: number
  tickMs: number
}

export interface PlcSimulatorStatus {
  listening: boolean
  faulted: boolean
  endpoint: string
  responseDelayMs: number
  writeFailureMode: WriteFailureMode
  networkErrorPending: boolean
}

export class PlcSimulator {
  readonly memoryMap: ModbusMemoryMap
  private readonly processModel: ProcessModel
  private readonly server: ModbusTcpServer
  private timer: NodeJS.Timeout | null = null
  private faulted = false

  constructor(private readonly config: PlcSimulatorConfig = getDefaultSimulatorConfig()) {
    this.memoryMap = new ModbusMemoryMap()
    this.processModel = new ProcessModel(this.memoryMap)
    this.server = new ModbusTcpServer(config, this.memoryMap)
  }

  async start(): Promise<void> {
    let startedTimer = false
    if (!this.timer) {
      this.timer = setInterval(() => {
        this.processModel.tick(this.config.tickMs)
      }, this.config.tickMs)
      startedTimer = true
    }

    try {
      await this.server.start()
      this.faulted = false
    } catch (error) {
      if (startedTimer && this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
      throw error
    }
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    await this.server.stop()
    this.faulted = false
  }

  async disconnect(): Promise<void> {
    await this.server.stop()
    this.faulted = true
  }

  async recover(): Promise<void> {
    await this.server.start()
    this.faulted = false
  }

  setResponseDelay(responseDelayMs: number): void {
    this.server.setResponseDelay(responseDelayMs)
  }

  clearResponseDelay(): void {
    this.server.setResponseDelay(0)
  }

  failNextWrite(): void {
    this.server.setWriteFailureMode('once')
  }

  setWriteFailureMode(mode: WriteFailureMode): void {
    this.server.setWriteFailureMode(mode)
  }

  triggerNetworkError(): void {
    this.server.triggerNetworkError()
  }

  clearFaults(): void {
    this.server.clearFaults()
  }

  tick(deltaMs: number = this.config.tickMs): void {
    this.processModel.tick(deltaMs)
  }

  getStatus(): PlcSimulatorStatus {
    const faultStatus = this.server.getFaultStatus()

    return {
      listening: this.server.listening,
      faulted: this.faulted,
      endpoint: `${this.config.host}:${this.config.port}/unit-${this.config.unitId}`,
      responseDelayMs: faultStatus.responseDelayMs,
      writeFailureMode: faultStatus.writeFailureMode,
      networkErrorPending: faultStatus.networkErrorPending
    }
  }
}

export function getDefaultSimulatorConfig(env: NodeJS.ProcessEnv = process.env): PlcSimulatorConfig {
  return {
    host: env.HMI_SIMULATOR_HOST ?? DEFAULT_SIMULATOR_HOST,
    port: parsePort(env.HMI_SIMULATOR_PORT, DEFAULT_SIMULATOR_PORT),
    unitId: parsePort(env.HMI_SIMULATOR_UNIT_ID, DEFAULT_SIMULATOR_UNIT_ID),
    tickMs: parsePort(env.HMI_SIMULATOR_TICK_MS, DEFAULT_SIMULATOR_TICK_MS)
  }
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
