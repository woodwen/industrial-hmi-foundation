import { makeAutoObservable } from 'mobx'

import { createAppError, toAppError, type AppErrorShape } from '../../shared/app-error'
import type {
  DeviceCommandId,
  DeviceCommandRequest,
  DeviceCommandResult,
  DevicePointValue,
  DeviceStateChangedEvent,
  DeviceStatus,
  Unsubscribe
} from '../../shared/hmi-api'
import {
  DEFAULT_PROCESS_READ_POINT_IDS,
  DEFAULT_SIMULATOR_HOST,
  DEFAULT_SIMULATOR_PORT,
  DEFAULT_SIMULATOR_UNIT_ID,
  SIMULATED_MIXER_DEVICE_ID,
  getModbusPoint,
  getModbusPointLabel,
  type ModbusPointId,
  type ModbusPointLabelLanguage
} from '../../shared/modbus'
import type { AppApplicationService } from '../application/AppApplicationService'
import type { MessageKey } from '../localization/messages'
import type { AuthViewModel } from './AuthViewModel'
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

const CONTROLLED_COIL_POINT_IDS = [
  'inletValveCommand',
  'outletValveCommand'
] as const satisfies readonly ModbusPointId[]

const COMMAND_TARGET_POINT_IDS: Record<DeviceCommandId, ModbusPointId> = {
  start: 'deviceStartCommand',
  stop: 'deviceStartCommand',
  motorStart: 'mixerMotorCommand',
  motorStop: 'mixerMotorCommand',
  setInletValve: 'inletValveCommand',
  setOutletValve: 'outletValveCommand',
  setTargetTemperature: 'targetTemperature',
  setRpmSetpoint: 'manualMotorRpmSetpoint'
}

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
  commandId: DeviceCommandId
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
  activeCommandId: DeviceCommandId | null = null
  writingPointId: ModbusPointId | null = null
  lastCommandResult: DeviceCommandResult | null = null
  error: AppErrorShape | null = null
  operationMessageKey: MessageKey | null = null
  targetTemperatureInput = '60.0'
  manualMotorRpmInput = '0'
  private stateUnsubscribe: Unsubscribe | null = null

  constructor(
    private readonly appService: AppApplicationService,
    private readonly getLanguage: () => ModbusPointLabelLanguage = () => 'zh-CN',
    private readonly tags?: TagValuesViewModel,
    private readonly auth?: AuthViewModel
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

  get controlNoticeKey(): MessageKey | null {
    switch (this.status.connectionStatus) {
      case 'Disconnected':
        return 'device.controls.disconnected'
      case 'Connecting':
        return 'device.controls.connecting'
      case 'Reconnecting':
        return 'device.controls.reconnecting'
      case 'Fault':
        return 'device.controls.fault'
      case 'Connected':
        return null
    }
  }

  get isConnected(): boolean {
    return this.status.connectionStatus === 'Connected'
  }

  get canConnect(): boolean {
    return !this.isBusy && (
      this.status.connectionStatus === 'Disconnected' ||
      this.status.connectionStatus === 'Fault'
    )
  }

  get canDisconnect(): boolean {
    return !this.isBusy && this.status.connectionStatus !== 'Disconnected'
  }

  get isCommandPending(): boolean {
    return this.activeCommandId !== null
  }

  get isBusy(): boolean {
    return this.isConnecting ||
      this.isDisconnecting ||
      this.isRefreshingStatus ||
      this.isReading ||
      this.isCommandPending
  }

  get canExecuteCommand(): boolean {
    return this.isConnected && !this.isBusy
  }

  get canStartStopCommand(): boolean {
    return this.canExecuteCommand && this.hasPermission('device:start-stop')
  }

  get canWriteParameters(): boolean {
    return this.canExecuteCommand && this.hasPermission('parameter:write')
  }

  get canAdvancedControlCommand(): boolean {
    return this.canExecuteCommand && this.hasPermission('device:advanced-control')
  }

  get endpointLabel(): string {
    return `${this.status.endpoint.host}:${this.status.endpoint.port} / Unit ${this.status.endpoint.unitId}`
  }

  get statusErrorMessage(): string | null {
    return this.error?.message ?? this.status.lastError?.message ?? null
  }

  get commandResultMessage(): string | null {
    return this.lastCommandResult?.message ?? null
  }

  get valueRows(): DevicePointRow[] {
    return VALUE_POINT_IDS.map((pointId) => this.createPointRow(pointId))
  }

  get feedbackRows(): DevicePointRow[] {
    return FEEDBACK_POINT_IDS.map((pointId) => this.createPointRow(pointId))
  }

  get coilControls(): DeviceCoilControlRow[] {
    return CONTROLLED_COIL_POINT_IDS.map((pointId) => {
      const row = this.createPointRow(pointId)
      const currentValue = this.values.get(pointId)?.value

      return {
        ...row,
        commandId: pointId === 'inletValveCommand' ? 'setInletValve' : 'setOutletValve',
        checked: typeof currentValue === 'boolean' ? currentValue : false,
        disabled: !this.canAdvancedControlCommand
      }
    })
  }

  get tagMonitorRows(): TagMonitorRow[] {
    return this.tags?.tagMonitorRows ?? []
  }

  async initialize(): Promise<void> {
    if (this.stateUnsubscribe) {
      return
    }

    await this.refreshStatusSilently()
    this.stateUnsubscribe = this.appService.subscribeDeviceState(this.applyDeviceStateEvent)
  }

  dispose(): void {
    this.stateUnsubscribe?.()
    this.stateUnsubscribe = null
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

  async startDevice(): Promise<void> {
    await this.executeCommand({
      commandId: 'start'
    })
  }

  async stopDevice(): Promise<void> {
    await this.executeCommand({
      commandId: 'stop'
    })
  }

  async startMotor(): Promise<void> {
    await this.executeCommand({
      commandId: 'motorStart'
    })
  }

  async stopMotor(): Promise<void> {
    await this.executeCommand({
      commandId: 'motorStop'
    })
  }

  async setInletValve(open: boolean): Promise<void> {
    await this.executeCommand({
      commandId: 'setInletValve',
      value: open
    })
  }

  async setOutletValve(open: boolean): Promise<void> {
    await this.executeCommand({
      commandId: 'setOutletValve',
      value: open
    })
  }

  async writeTargetTemperature(): Promise<void> {
    const value = this.parseNumericInput(this.targetTemperatureInput, 'targetTemperature')
    if (value === null) {
      return
    }

    await this.executeCommand({
      commandId: 'setTargetTemperature',
      value
    })
  }

  async writeManualMotorRpm(): Promise<void> {
    const value = this.parseNumericInput(this.manualMotorRpmInput, 'manualMotorRpmSetpoint')
    if (value === null) {
      return
    }

    await this.executeCommand({
      commandId: 'setRpmSetpoint',
      value
    })
  }

  async writeCoil(pointId: ModbusPointId, value: boolean): Promise<void> {
    const request = mapCoilWriteToCommand(pointId, value)
    if (!request) {
      this.error = createAppError({
        code: 'DEVICE_COMMAND_UNSUPPORTED',
        message: 'Selected coil is not supported by CommandService.',
        source: 'renderer:device-command',
        detail: `pointId=${pointId}`
      })
      return
    }

    await this.executeCommand(request)
  }

  setTargetTemperatureInput(value: string): void {
    this.targetTemperatureInput = value
  }

  setManualMotorRpmInput(value: string): void {
    this.manualMotorRpmInput = value
  }

  applyDeviceStateEvent(event: DeviceStateChangedEvent): void {
    this.status = event
  }

  private async executeCommand(request: DeviceCommandRequest): Promise<void> {
    this.activeCommandId = request.commandId
    this.writingPointId = COMMAND_TARGET_POINT_IDS[request.commandId] ?? null
    this.clearOperationState()

    try {
      const result = await this.appService.executeCommand(request)
      if (!result.ok) {
        await this.handleDeviceError(result.error)
        return
      }

      this.lastCommandResult = result.data
      if (result.data.point) {
        this.applyPointValue(result.data.point)
      }

      if (result.data.status === 'succeeded') {
        this.operationMessageKey = 'device.operation.commandSucceeded'
        return
      }

      this.error = result.data.error ?? createAppError({
        code: `DEVICE_COMMAND_${result.data.status.toUpperCase()}`,
        message: result.data.message,
        source: 'renderer:device-command',
        detail: `commandId=${result.data.commandId}`
      })

      if (result.data.status === 'timeout' || result.data.status === 'failed') {
        await this.refreshStatusSilently()
      }
    } catch (error) {
      await this.handleDeviceError(toAppError(error, 'renderer:device-command'))
    } finally {
      this.activeCommandId = null
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
    if (!Number.isFinite(value)) {
      this.error = createAppError({
        code: 'DEVICE_INVALID_INPUT',
        message: 'Device command input must be a finite number.',
        source: 'renderer:device-input',
        detail: `pointId=${pointId}`
      })
      return null
    }

    const point = getModbusPoint(pointId)
    if ((point.min !== undefined && value < point.min) || (point.max !== undefined && value > point.max)) {
      this.error = createAppError({
        code: 'DEVICE_INVALID_INPUT',
        message: `Device command input must be between ${point.min} and ${point.max}.`,
        source: 'renderer:device-input',
        detail: `pointId=${pointId}`
      })
      return null
    }

    return value
  }

  private hasPermission(permission: Parameters<AuthViewModel['hasPermission']>[0]): boolean {
    return this.auth?.hasPermission(permission) ?? true
  }

  private clearOperationState(): void {
    this.error = null
    this.operationMessageKey = null
    this.lastCommandResult = null
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

function mapCoilWriteToCommand(pointId: ModbusPointId, value: boolean): DeviceCommandRequest | null {
  if (pointId === 'deviceStartCommand') {
    return {
      commandId: value ? 'start' : 'stop'
    }
  }

  if (pointId === 'mixerMotorCommand') {
    return {
      commandId: value ? 'motorStart' : 'motorStop'
    }
  }

  if (pointId === 'inletValveCommand') {
    return {
      commandId: 'setInletValve',
      value
    }
  }

  if (pointId === 'outletValveCommand') {
    return {
      commandId: 'setOutletValve',
      value
    }
  }

  return null
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
