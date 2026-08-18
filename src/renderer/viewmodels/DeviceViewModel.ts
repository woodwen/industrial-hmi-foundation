import { makeAutoObservable } from 'mobx'

import { createAppError, toAppError, type AppErrorShape } from '../../shared/app-error'
import type { DevicePointValue, DeviceStatus } from '../../shared/hmi-api'
import {
  DEFAULT_PROCESS_READ_POINT_IDS,
  DEFAULT_SIMULATOR_HOST,
  DEFAULT_SIMULATOR_PORT,
  DEFAULT_SIMULATOR_UNIT_ID,
  DEFAULT_WRITABLE_COIL_POINT_IDS,
  SIMULATED_MIXER_DEVICE_ID,
  getModbusPoint,
  getModbusPointLabel,
  type ModbusEngineeringValue,
  type ModbusPointId,
  type ModbusPointLabelLanguage
} from '../../shared/modbus'
import type { AppApplicationService } from '../application/AppApplicationService'
import type { MessageKey } from '../localization/messages'
import type { TagMonitorRow, TagValuesViewModel } from './TagValuesViewModel'

const VALUE_POINT_IDS = [
  'currentTemperature',
  'currentLevel',
  'currentPressure',
  'motorRpm',
  'productionCount',
  'targetTemperature',
  'manualMotorRpmSetpoint'
] as const satisfies readonly ModbusPointId[]

const FEEDBACK_POINT_IDS = [
  'deviceRunningStatus',
  'mixerMotorRunningStatus',
  'inletValveOpenStatus',
  'outletValveOpenStatus',
  'autoModeStatus'
] as const satisfies readonly ModbusPointId[]

export interface DevicePointRow {
  pointId: ModbusPointId
  label: string
  area: string
  referenceAddress: string
  pduAddress: number
  value: string
  rawValues: string
  timestamp?: string
}

export interface DeviceCoilControlRow extends DevicePointRow {
  checked: boolean
  disabled: boolean
}

export class DeviceViewModel {
  descriptionKey: MessageKey = 'device.description'
  status: DeviceStatus = createInitialDeviceStatus()
  values = new Map<ModbusPointId, DevicePointValue>()
  isConnecting = false
  isDisconnecting = false
  isRefreshingStatus = false
  isReading = false
  writingPointId: ModbusPointId | null = null
  error: AppErrorShape | null = null
  operationMessageKey: MessageKey | null = null
  targetTemperatureInput = '60.0'
  manualMotorRpmInput = '0'

  constructor(
    private readonly appService: AppApplicationService,
    private readonly getLanguage: () => ModbusPointLabelLanguage = () => 'zh-CN',
    private readonly tags?: TagValuesViewModel
  ) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get connectionStatusKey(): MessageKey {
    switch (this.status.connectionStatus) {
      case 'Disconnected':
        return 'device.status.disconnected'
      case 'Connecting':
        return 'device.status.connecting'
      case 'Connected':
        return 'device.status.connected'
      case 'Reconnecting':
        return 'device.status.reconnecting'
      case 'Fault':
        return 'device.status.fault'
    }
  }

  get isConnected(): boolean {
    return this.status.connectionStatus === 'Connected'
  }

  get isBusy(): boolean {
    return this.isConnecting ||
      this.isDisconnecting ||
      this.isRefreshingStatus ||
      this.isReading ||
      this.writingPointId !== null
  }

  get endpointLabel(): string {
    return `${this.status.endpoint.host}:${this.status.endpoint.port} / Unit ${this.status.endpoint.unitId}`
  }

  get statusErrorMessage(): string | null {
    return this.error?.message ?? this.status.lastError?.message ?? null
  }

  get valueRows(): DevicePointRow[] {
    return VALUE_POINT_IDS.map((pointId) => this.createPointRow(pointId))
  }

  get feedbackRows(): DevicePointRow[] {
    return FEEDBACK_POINT_IDS.map((pointId) => this.createPointRow(pointId))
  }

  get coilControls(): DeviceCoilControlRow[] {
    return DEFAULT_WRITABLE_COIL_POINT_IDS.map((pointId) => {
      const row = this.createPointRow(pointId)
      const currentValue = this.values.get(pointId)?.value

      return {
        ...row,
        checked: typeof currentValue === 'boolean' ? currentValue : false,
        disabled: !this.isConnected || this.writingPointId !== null
      }
    })
  }

  get tagMonitorRows(): TagMonitorRow[] {
    return this.tags?.tagMonitorRows ?? []
  }

  async connect(): Promise<void> {
    this.isConnecting = true
    this.clearOperationState()

    try {
      const result = await this.appService.connectDevice()
      if (!result.ok) {
        await this.handleDeviceError(result.error)
        return
      }

      this.status = result.data
      this.operationMessageKey = 'device.operation.connected'
      await this.readConfiguredPoints()
    } catch (error) {
      await this.handleDeviceError(toAppError(error, 'renderer:device-connect'))
    } finally {
      this.isConnecting = false
    }
  }

  async disconnect(): Promise<void> {
    this.isDisconnecting = true
    this.clearOperationState()

    try {
      const result = await this.appService.disconnectDevice()
      if (!result.ok) {
        await this.handleDeviceError(result.error)
        return
      }

      this.status = result.data
      this.operationMessageKey = 'device.operation.disconnected'
    } catch (error) {
      await this.handleDeviceError(toAppError(error, 'renderer:device-disconnect'))
    } finally {
      this.isDisconnecting = false
    }
  }

  async refreshStatus(): Promise<void> {
    this.isRefreshingStatus = true
    this.clearOperationState()

    try {
      await this.refreshStatusSilently()
    } finally {
      this.isRefreshingStatus = false
    }
  }

  async readConfiguredPoints(): Promise<void> {
    this.isReading = true
    this.clearOperationState()

    try {
      const result = await this.appService.readDeviceRegisters({
        pointIds: [...DEFAULT_PROCESS_READ_POINT_IDS]
      })

      if (!result.ok) {
        await this.handleDeviceError(result.error)
        return
      }

      result.data.values.forEach((value) => this.applyPointValue(value))
      this.operationMessageKey = 'device.operation.read'
    } catch (error) {
      await this.handleDeviceError(toAppError(error, 'renderer:device-read'))
    } finally {
      this.isReading = false
    }
  }

  async writeTargetTemperature(): Promise<void> {
    const value = this.parseNumericInput(this.targetTemperatureInput, 'targetTemperature')
    if (value === null) {
      return
    }

    await this.writePoint('targetTemperature', value)
  }

  async writeManualMotorRpm(): Promise<void> {
    const value = this.parseNumericInput(this.manualMotorRpmInput, 'manualMotorRpmSetpoint')
    if (value === null) {
      return
    }

    await this.writePoint('manualMotorRpmSetpoint', value)
  }

  async writeCoil(pointId: ModbusPointId, value: boolean): Promise<void> {
    await this.writePoint(pointId, value)
  }

  setTargetTemperatureInput(value: string): void {
    this.targetTemperatureInput = value
  }

  setManualMotorRpmInput(value: string): void {
    this.manualMotorRpmInput = value
  }

  private async writePoint(pointId: ModbusPointId, value: ModbusEngineeringValue): Promise<void> {
    this.writingPointId = pointId
    this.clearOperationState()

    try {
      const result = await this.appService.writeDeviceRegisters({
        pointId,
        value
      })

      if (!result.ok) {
        await this.handleDeviceError(result.error)
        return
      }

      this.applyPointValue(result.data.point)
      this.operationMessageKey = 'device.operation.write'
    } catch (error) {
      await this.handleDeviceError(toAppError(error, 'renderer:device-write'))
    } finally {
      this.writingPointId = null
    }
  }

  private createPointRow(pointId: ModbusPointId): DevicePointRow {
    const point = getModbusPoint(pointId)
    const value = this.values.get(pointId)

    return {
      pointId,
      label: getModbusPointLabel(point, this.getLanguage()),
      area: point.area,
      referenceAddress: point.referenceAddress,
      pduAddress: point.pduAddress,
      value: value?.formattedValue ?? '-',
      rawValues: value?.rawValues.map((rawValue) => String(rawValue)).join(', ') ?? '-',
      timestamp: value?.timestamp
    }
  }

  private applyPointValue(value: DevicePointValue): void {
    this.values.set(value.pointId, value)

    if (value.pointId === 'targetTemperature' && typeof value.value === 'number') {
      this.targetTemperatureInput = value.value.toFixed(1)
    }

    if (value.pointId === 'manualMotorRpmSetpoint' && typeof value.value === 'number') {
      this.manualMotorRpmInput = String(value.value)
    }
  }

  private parseNumericInput(input: string, pointId: ModbusPointId): number | null {
    const value = Number(input)
    if (Number.isFinite(value)) {
      return value
    }

    this.error = createAppError({
      code: 'DEVICE_INVALID_INPUT',
      message: 'Device write input must be a finite number.',
      source: 'renderer:device-input',
      detail: `pointId=${pointId}`
    })
    return null
  }

  private clearOperationState(): void {
    this.error = null
    this.operationMessageKey = null
  }

  private async handleDeviceError(error: AppErrorShape): Promise<void> {
    this.error = error
    await this.refreshStatusSilently()
  }

  private async refreshStatusSilently(): Promise<void> {
    try {
      const result = await this.appService.getDeviceStatus()
      if (result.ok) {
        this.status = result.data
        return
      }

      this.error = result.error
    } catch (error) {
      this.error = toAppError(error, 'renderer:device-status')
    }
  }
}

function createInitialDeviceStatus(): DeviceStatus {
  return {
    deviceId: SIMULATED_MIXER_DEVICE_ID,
    name: 'Simulated Mixer PLC',
    protocol: 'modbusTcp',
    connectionStatus: 'Disconnected',
    endpoint: {
      host: DEFAULT_SIMULATOR_HOST,
      port: DEFAULT_SIMULATOR_PORT,
      unitId: DEFAULT_SIMULATOR_UNIT_ID
    }
  }
}
