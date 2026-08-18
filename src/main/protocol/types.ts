import type { AppErrorShape } from '../../shared/app-error'
import type { ModbusRawValue, ModbusRegisterArea } from '../../shared/modbus'

export type ProtocolConnectionStatus =
  | 'Disconnected'
  | 'Connecting'
  | 'Connected'
  | 'Reconnecting'
  | 'Fault'

export interface ProtocolConnectionConfig {
  deviceId?: string
  host: string
  port: number
  unitId: number
  connectTimeoutMs: number
  requestTimeoutMs: number
}

export interface ProtocolReadRequest {
  area: ModbusRegisterArea
  address: number
  quantity: number
  unitId?: number
  timeoutMs?: number
}

export interface ProtocolReadResult {
  area: ModbusRegisterArea
  address: number
  quantity: number
  values: ModbusRawValue[]
}

export interface ProtocolWriteRequest {
  area: ModbusRegisterArea
  address: number
  values: ModbusRawValue[]
  unitId?: number
  timeoutMs?: number
}

export interface ProtocolWriteResult {
  area: ModbusRegisterArea
  address: number
  quantity: number
}

export interface ProtocolAdapterStatus {
  connectionStatus: ProtocolConnectionStatus
  endpoint?: string
  unitId?: number
  lastSuccessfulAt?: string
  lastError?: AppErrorShape
}

export interface IProtocolAdapter {
  connect(config: ProtocolConnectionConfig): Promise<void>
  disconnect(): Promise<void>
  read(request: ProtocolReadRequest): Promise<ProtocolReadResult>
  write(request: ProtocolWriteRequest): Promise<ProtocolWriteResult>
  getStatus(): ProtocolAdapterStatus
}
