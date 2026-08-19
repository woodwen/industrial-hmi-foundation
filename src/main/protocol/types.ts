import type { AppErrorShape } from '../../shared/app-error'
import type { ModbusRawValue, ModbusRegisterArea } from '../../shared/modbus'
import type { TagQuality } from '../../shared/tag'

export type ProtocolConnectionStatus =
  | 'Disconnected'
  | 'Connecting'
  | 'Connected'
  | 'Reconnecting'
  | 'Fault'

export type ProtocolKind = 'modbusTcp' | 'opcUa'
export type ProtocolAcquisitionMode = 'polling' | 'subscription'
export type ProtocolValueDataType = 'boolean' | 'int16' | 'uint16' | 'uint32' | 'double' | 'string'

export interface BaseProtocolConnectionConfig {
  deviceId?: string
  protocol?: ProtocolKind
  host?: string
  port?: number
  unitId?: number
  endpointUrl?: string
  connectTimeoutMs: number
  requestTimeoutMs: number
}

export interface ModbusTcpConnectionConfig extends BaseProtocolConnectionConfig {
  protocol?: 'modbusTcp'
  host: string
  port: number
  unitId: number
}

export interface OpcUaConnectionConfig extends BaseProtocolConnectionConfig {
  protocol: 'opcUa'
  endpointUrl: string
  namespaceUri?: string
  securityMode: 'None'
  securityPolicy: 'None'
  anonymous: true
}

export type ProtocolConnectionConfig = ModbusTcpConnectionConfig | OpcUaConnectionConfig

export interface ProtocolAdapterCapabilities {
  protocol: ProtocolKind
  preferredAcquisition: ProtocolAcquisitionMode
  supportsPolling: boolean
  supportsSubscription: boolean
  supportsBatchRead: boolean
  supportsWrite: boolean
  supportsReadBack: boolean
  maxItemsPerSubscription?: number
  requestTimeoutMs: number
}

export interface ModbusProtocolBinding {
  protocol: 'modbusTcp'
  area: ModbusRegisterArea
  address: number
  quantity: number
  unitId?: number
}

export interface OpcUaProtocolBinding {
  protocol: 'opcUa'
  nodeId: string
  dataType: ProtocolValueDataType
  samplingIntervalMs: number
  writable: boolean
}

export type ProtocolDataBinding = ModbusProtocolBinding | OpcUaProtocolBinding

export interface ProtocolReadRequest {
  binding?: ProtocolDataBinding
  area: ModbusRegisterArea
  address: number
  quantity: number
  unitId?: number
  timeoutMs?: number
}

export interface ProtocolReadResult {
  binding?: ProtocolDataBinding
  area: ModbusRegisterArea
  address: number
  quantity: number
  values: ModbusRawValue[]
  quality?: TagQuality
}

export interface ProtocolWriteRequest {
  binding?: ProtocolDataBinding
  area: ModbusRegisterArea
  address: number
  values: ModbusRawValue[]
  unitId?: number
  timeoutMs?: number
}

export interface ProtocolWriteResult {
  binding?: ProtocolDataBinding
  area: ModbusRegisterArea
  address: number
  quantity: number
}

export interface ProtocolAdapterStatus {
  connectionStatus: ProtocolConnectionStatus
  protocol?: ProtocolKind
  endpoint?: string
  unitId?: number
  lastSuccessfulAt?: string
  lastError?: AppErrorShape
}

export interface ProtocolSubscriptionItem {
  tagId: string
  binding: OpcUaProtocolBinding
}

export interface ProtocolSubscriptionValue {
  tagId: string
  binding: OpcUaProtocolBinding
  value: unknown
  quality: TagQuality
  timestamp: string
}

export type ProtocolSubscriptionListener = (values: ProtocolSubscriptionValue[]) => void
export type ProtocolSubscriptionFailureListener = (error: AppErrorShape) => void

export interface ProtocolSubscriptionHandle {
  dispose(): Promise<void>
}

export interface IProtocolAdapter {
  getCapabilities(): ProtocolAdapterCapabilities
  connect(config: ProtocolConnectionConfig): Promise<void>
  disconnect(): Promise<void>
  read(request: ProtocolReadRequest): Promise<ProtocolReadResult>
  write(request: ProtocolWriteRequest): Promise<ProtocolWriteResult>
  getStatus(): ProtocolAdapterStatus
  subscribe?(
    items: readonly ProtocolSubscriptionItem[],
    listener: ProtocolSubscriptionListener,
    failureListener?: ProtocolSubscriptionFailureListener
  ): Promise<ProtocolSubscriptionHandle>
}
