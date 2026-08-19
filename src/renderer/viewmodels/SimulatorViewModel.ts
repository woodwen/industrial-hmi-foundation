import { makeAutoObservable } from 'mobx'

import { toAppError, type AppErrorShape } from '../../shared/app-error'
import {
  DEFAULT_SIMULATOR_ENDPOINTS,
  SIMULATOR_KINDS,
  type SimulatorKind,
  type SimulatorLifecycleStatus,
  type SimulatorRuntimeStatus,
  type SimulatorStatusChangedEvent
} from '../../shared/simulator'
import type { AppApplicationService } from '../application/AppApplicationService'
import type { MessageKey } from '../localization/messages'

export interface SimulatorControlRow {
  kind: SimulatorKind
  protocolLabel: string
  status: SimulatorLifecycleStatus
  statusKey: MessageKey
  endpointLabel: string
  managedLabelKey: MessageKey
  canStart: boolean
  canStop: boolean
  isBusy: boolean
  errorMessage: string | null
}

export class SimulatorViewModel {
  statuses = new Map<SimulatorKind, SimulatorRuntimeStatus>(
    SIMULATOR_KINDS.map((kind) => [kind, createInitialStatus(kind)])
  )
  activeKind: SimulatorKind | null = null
  error: AppErrorShape | null = null
  private statusUnsubscribe: (() => void) | null = null

  constructor(private readonly appService: AppApplicationService) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get rows(): SimulatorControlRow[] {
    return SIMULATOR_KINDS.map((kind) => this.createRow(kind))
  }

  get isBusy(): boolean {
    return this.activeKind !== null
  }

  getRow(kind: SimulatorKind): SimulatorControlRow {
    return this.createRow(kind)
  }

  async initialize(): Promise<void> {
    if (this.statusUnsubscribe) {
      return
    }

    await this.refreshStatus()
    this.statusUnsubscribe = this.appService.subscribeSimulatorStatus(this.applyStatusEvent)
  }

  dispose(): void {
    this.statusUnsubscribe?.()
    this.statusUnsubscribe = null
  }

  async refreshStatus(): Promise<void> {
    try {
      const result = await this.appService.getSimulatorStatus()
      if (!result.ok) {
        this.error = result.error
        return
      }

      this.applyStatuses(result.data.simulators)
      this.error = null
    } catch (error) {
      this.error = toAppError(error, 'renderer:simulator-status')
    }
  }

  async start(kind: SimulatorKind): Promise<void> {
    this.activeKind = kind
    this.error = null

    try {
      const result = await this.appService.startSimulator({ kind })
      if (!result.ok) {
        await this.refreshStatus()
        this.error = result.error
        return
      }

      this.statuses.set(kind, result.data)
    } catch (error) {
      this.error = toAppError(error, 'renderer:simulator-start')
    } finally {
      this.activeKind = null
    }
  }

  async stop(kind: SimulatorKind): Promise<void> {
    this.activeKind = kind
    this.error = null

    try {
      const result = await this.appService.stopSimulator({ kind })
      if (!result.ok) {
        await this.refreshStatus()
        this.error = result.error
        return
      }

      this.statuses.set(kind, result.data)
    } catch (error) {
      this.error = toAppError(error, 'renderer:simulator-stop')
    } finally {
      this.activeKind = null
    }
  }

  applyStatusEvent(event: SimulatorStatusChangedEvent): void {
    this.applyStatuses(event.simulators)
  }

  private applyStatuses(statuses: readonly SimulatorRuntimeStatus[]): void {
    statuses.forEach((status) => {
      this.statuses.set(status.kind, status)
    })
  }

  private createRow(kind: SimulatorKind): SimulatorControlRow {
    const status = this.statuses.get(kind) ?? createInitialStatus(kind)
    const isLifecycleBusy = status.status === 'Starting' || status.status === 'Stopping'
    const active = this.activeKind === kind

    return {
      kind,
      protocolLabel: kind === 'opcUa' ? 'OPC UA' : 'Modbus TCP',
      status: status.status,
      statusKey: getStatusKey(status.status),
      endpointLabel: status.endpoint.label,
      managedLabelKey: status.managed ? 'simulator.managed.app' : 'simulator.managed.external',
      canStart: !this.isBusy && status.status !== 'Starting' && status.status !== 'Running' && status.status !== 'Stopping',
      canStop: !this.isBusy && status.managed && (
        status.status === 'Starting' ||
        status.status === 'Running' ||
        status.status === 'Stopping'
      ),
      isBusy: active || isLifecycleBusy,
      errorMessage: status.lastError?.message ?? (active ? this.error?.message ?? null : null)
    }
  }

}

function createInitialStatus(kind: SimulatorKind): SimulatorRuntimeStatus {
  return {
    kind,
    status: 'Stopped',
    endpoint: DEFAULT_SIMULATOR_ENDPOINTS[kind],
    managed: false,
    updatedAt: new Date(0).toISOString()
  }
}

function getStatusKey(status: SimulatorLifecycleStatus): MessageKey {
  switch (status) {
    case 'Stopped':
      return 'simulator.status.stopped'
    case 'Starting':
      return 'simulator.status.starting'
    case 'Running':
      return 'simulator.status.running'
    case 'Stopping':
      return 'simulator.status.stopping'
    case 'Fault':
      return 'simulator.status.fault'
  }
}
