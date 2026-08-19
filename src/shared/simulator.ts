import type { AppErrorShape } from './app-error'
import {
  DEFAULT_SIMULATOR_HOST,
  DEFAULT_SIMULATOR_PORT,
  DEFAULT_SIMULATOR_UNIT_ID
} from './modbus'

export type SimulatorKind = 'modbusTcp' | 'opcUa'
export type SimulatorLifecycleStatus = 'Stopped' | 'Starting' | 'Running' | 'Stopping' | 'Fault'

export interface SimulatorEndpointSummary {
  label: string
  host?: string
  port?: number
  unitId?: number
  endpointUrl?: string
}

export interface SimulatorRuntimeStatus {
  kind: SimulatorKind
  status: SimulatorLifecycleStatus
  endpoint: SimulatorEndpointSummary
  managed: boolean
  pid?: number
  startedAt?: string
  stoppedAt?: string
  updatedAt: string
  lastError?: AppErrorShape
}

export interface SimulatorStatusSnapshot {
  simulators: SimulatorRuntimeStatus[]
  emittedAt: string
}

export interface SimulatorLifecycleRequest {
  kind: SimulatorKind
}

export interface SimulatorStatusChangedEvent extends SimulatorStatusSnapshot {
  changed: SimulatorRuntimeStatus
}

export type SimulatorLifecycleListener = (event: SimulatorStatusChangedEvent) => void

export const SIMULATOR_KINDS: readonly SimulatorKind[] = ['modbusTcp', 'opcUa'] as const
export const DEFAULT_OPCUA_SIMULATOR_ENDPOINT_URL = 'opc.tcp://127.0.0.1:4840/industrial-hmi-simulator'

export const DEFAULT_SIMULATOR_ENDPOINTS: Record<SimulatorKind, SimulatorEndpointSummary> = {
  modbusTcp: {
    label: `${DEFAULT_SIMULATOR_HOST}:${DEFAULT_SIMULATOR_PORT}/unit-${DEFAULT_SIMULATOR_UNIT_ID}`,
    host: DEFAULT_SIMULATOR_HOST,
    port: DEFAULT_SIMULATOR_PORT,
    unitId: DEFAULT_SIMULATOR_UNIT_ID
  },
  opcUa: {
    label: DEFAULT_OPCUA_SIMULATOR_ENDPOINT_URL,
    endpointUrl: DEFAULT_OPCUA_SIMULATOR_ENDPOINT_URL
  }
}

export function isSimulatorKind(value: unknown): value is SimulatorKind {
  return value === 'modbusTcp' || value === 'opcUa'
}
