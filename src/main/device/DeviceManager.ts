import type { AppErrorShape } from '../../shared/app-error'
import { UNKNOWN_ERROR_CODE, toAppError } from '../../shared/app-error'
import type {
  DeviceConnectionStatus,
  DeviceConfigUpdateRequest,
  DevicePointValue,
  DeviceReadRequest,
  DeviceReadResponse,
  DeviceStateChangedEvent,
  DeviceStatus,
  DeviceWriteRequest,
  DeviceWriteResponse
} from '../../shared/hmi-api'
import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_PROCESS_READ_POINT_IDS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_SIMULATOR_HOST,
  DEFAULT_SIMULATOR_PORT,
  DEFAULT_SIMULATOR_UNIT_ID,
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
import { DEFAULT_OPCUA_ENDPOINT_URL, createProtocolBinding } from '../protocol/bindings'
import { createDeviceError, DEVICE_ERROR_CODES } from '../protocol/errors'
import { createProtocolAdapter, getProtocolKind } from '../protocol/factory'
import type {
  IProtocolAdapter,
  ProtocolConnectionConfig,
  ProtocolReadResult
} from '../protocol/types'
import { DeviceOperationBusyError, DeviceOperationGate } from './DeviceOperationGate'
import { transitionDeviceState, type DeviceStateEvent } from './state-machine'

export const DEFAULT_SIMULATED_DEVICE_CONFIG: ProtocolConnectionConfig = {
  deviceId: SIMULATED_MIXER_DEVICE_ID,
  protocol: 'modbusTcp',
  host: DEFAULT_SIMULATOR_HOST,
  port: DEFAULT_SIMULATOR_PORT,
  unitId: DEFAULT_SIMULATOR_UNIT_ID,
  connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
  requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS
}

export const DEFAULT_RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 10000] as const

const DEFAULT_DEVICE_NAME = 'Simulated Mixer PLC'

export type DeviceStateListener = (event: DeviceStateChangedEvent) => void

export interface DeviceLifecycleCallbacks {
  onConnected?(deviceId: string): void
  onReconnecting?(deviceId: string, error: AppErrorShape): void
  onDisconnected?(deviceId: string, manual: boolean): void
  onFault?(deviceId: string, error: AppErrorShape): void
}

export interface DeviceManagerDependencies {
  adapter?: IProtocolAdapter
  adapterFactory?: (config: ProtocolConnectionConfig) => IProtocolAdapter
  logger: Logger
  connectionConfig?: ProtocolConnectionConfig
  operationGate?: DeviceOperationGate
  lifecycle?: DeviceLifecycleCallbacks
  reconnectBackoffMs?: readonly number[]
  now?: () => string
}

export class DeviceManager {
  private adapter: IProtocolAdapter
  private connectionConfig: ProtocolConnectionConfig
  private connectionStatus: DeviceConnectionStatus = 'Disconnected'
  private lastTransitionAt: string | undefined
  private transitionReason: string | undefined
  private lastError: AppErrorShape | undefined
  private readonly listeners = new Set<DeviceStateListener>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private reconnectRunning = false
  private lastReconnectFailureLoggedAt = 0
  private lifecycleGeneration = 0

  constructor(private readonly dependencies: DeviceManagerDependencies) {
    this.connectionConfig = dependencies.connectionConfig ?? DEFAULT_SIMULATED_DEVICE_CONFIG
    this.adapter = dependencies.adapter ?? this.createAdapter(this.connectionConfig)
  }

  async connectDevice(): Promise<DeviceStatus> {
    const transitioned = this.applyTransition(
      this.connectionStatus === 'Fault' ? 'retryRequested' : 'connectRequested',
      'user-connect'
    )
    if (!transitioned) {
      return this.getDeviceStatus()
    }

    this.cancelReconnect()
    const generation = this.nextLifecycleGeneration()

    try {
      await this.adapter.connect(this.getConnectionConfig())
      if (!this.isLifecycleCurrent(generation, 'Connecting')) {
        await this.disconnectAdapterSafely('stale-connect-success')
        return this.getDeviceStatus()
      }

      this.reconnectAttempt = 0
      this.lastError = undefined
      if (this.applyTransition('connectSucceeded', 'connect-success')) {
        this.dependencies.lifecycle?.onConnected?.(SIMULATED_MIXER_DEVICE_ID)
      }
    } catch (error) {
      if (!this.isLifecycleCurrent(generation, 'Connecting')) {
        return this.getDeviceStatus()
      }

      const appError = toAppError(error, 'main:device-manager')
      this.lastError = appError
      if (this.applyTransition('connectFailed', 'initial-connect-failed', appError)) {
        this.dependencies.lifecycle?.onFault?.(SIMULATED_MIXER_DEVICE_ID, appError)
      }
      throw appError
    }

    return this.getDeviceStatus()
  }

  async disconnectDevice(): Promise<DeviceStatus> {
    this.nextLifecycleGeneration()
    this.cancelReconnect()
    this.applyTransition('manualDisconnect', 'user-disconnect')
    await this.disconnectAdapterSafely('user-disconnect')
    this.lastError = undefined
    this.dependencies.lifecycle?.onDisconnected?.(SIMULATED_MIXER_DEVICE_ID, true)
    return this.getDeviceStatus()
  }

  getDeviceStatus(): DeviceStatus {
    return this.toDeviceStatus()
  }

  getProtocolAdapter(): IProtocolAdapter {
    return this.adapter
  }

  async updateDeviceConfig(request: DeviceConfigUpdateRequest): Promise<DeviceStatus> {
    if (request.deviceId !== SIMULATED_MIXER_DEVICE_ID) {
      throw createDeviceError(
        DEVICE_ERROR_CODES.configurationInvalid,
        'Device configuration target is not supported.',
        'main:device-manager',
        `deviceId=${request.deviceId}`
      )
    }

    if (this.connectionStatus === 'Connecting' || this.connectionStatus === 'Reconnecting') {
      throw createDeviceError(
        DEVICE_ERROR_CODES.commandBusy,
        'Device communication is busy.',
        'main:device-manager',
        `state=${this.connectionStatus}`
      )
    }

    if (this.connectionStatus === 'Connected') {
      await this.disconnectDevice()
    }

    this.nextLifecycleGeneration()
    this.cancelReconnect()
    await this.disconnectAdapterSafely('configuration-change')

    this.connectionConfig = toProtocolConnectionConfig(request)
    this.adapter = this.createAdapter(this.connectionConfig)
    this.lastError = undefined
    this.connectionStatus = 'Disconnected'
    this.transitionReason = 'configuration-change'
    this.lastTransitionAt = this.dependencies.now?.() ?? new Date().toISOString()
    this.emitState()

    this.dependencies.logger.write({
      category: 'application',
      level: 'info',
      message: 'Device protocol configuration changed',
      source: 'main:device-manager',
      context: {
        deviceId: SIMULATED_MIXER_DEVICE_ID,
        protocol: getProtocolKind(this.connectionConfig)
      }
    })

    return this.getDeviceStatus()
  }

  subscribeState(listener: DeviceStateListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  handleCommunicationFailure(error: unknown): void {
    const appError = toAppError(error, 'main:device-manager')

    if (!isLifecycleCommunicationError(appError)) {
      this.dependencies.logger.write({
        category: 'communication',
        level: 'debug',
        message: 'Ignored non-lifecycle device error',
        source: 'main:device-manager',
        context: {
          deviceId: SIMULATED_MIXER_DEVICE_ID,
          errorCode: appError.code,
          errorMessage: appError.message
        }
      })
      return
    }

    this.lastError = appError

    if (this.connectionStatus === 'Connected') {
      if (this.applyTransition('communicationLost', 'communication-lost', appError)) {
        this.nextLifecycleGeneration()
        this.dependencies.lifecycle?.onReconnecting?.(SIMULATED_MIXER_DEVICE_ID, appError)
        this.startReconnectLoop()
      }
      return
    }

    if (this.connectionStatus === 'Connecting') {
      if (this.applyTransition('connectFailed', 'connect-failed', appError)) {
        this.dependencies.lifecycle?.onFault?.(SIMULATED_MIXER_DEVICE_ID, appError)
      }
    }
  }

  async readDeviceRegisters(request: DeviceReadRequest): Promise<DeviceReadResponse> {
    return this.runDeviceOperation(async () => {
      const timestamp = new Date().toISOString()
      const pointIds = request.pointIds.length > 0
        ? request.pointIds
        : [...DEFAULT_PROCESS_READ_POINT_IDS]
      const values: DevicePointValue[] = []

      for (const pointId of pointIds) {
        const point = getModbusPoint(pointId)
        const result = await this.adapter.read({
          binding: createProtocolBinding(getProtocolKind(this.getConnectionConfig()), point.id as ModbusPointId, 1000),
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
    })
  }

  async writeDeviceRegisters(request: DeviceWriteRequest): Promise<DeviceWriteResponse> {
    return this.runDeviceOperation(async () => {
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
      await this.adapter.write({
        binding: createProtocolBinding(getProtocolKind(this.getConnectionConfig()), point.id as ModbusPointId, 1000),
        area: point.area,
        address: point.pduAddress,
        values: rawValues
      })

      const timestamp = new Date().toISOString()
      const readBack = await this.adapter.read({
        binding: createProtocolBinding(getProtocolKind(this.getConnectionConfig()), point.id as ModbusPointId, 1000),
        area: point.area,
        address: point.pduAddress,
        quantity: point.quantity
      })

      return {
        deviceId: SIMULATED_MIXER_DEVICE_ID,
        point: createPointValue(point, readBack, timestamp),
        timestamp
      }
    })
  }

  dispose(): void {
    this.nextLifecycleGeneration()
    this.cancelReconnect()
    void this.disconnectAdapterSafely('device-manager-dispose')
    this.listeners.clear()
  }

  private async runDeviceOperation<T>(operation: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      try {
        return await operation()
      } catch (error) {
        this.handleCommunicationFailure(error)
        throw error
      }
    }

    try {
      const gate = this.dependencies.operationGate
      return gate
        ? await gate.runExclusive(SIMULATED_MIXER_DEVICE_ID, run)
        : await run()
    } catch (error) {
      if (error instanceof DeviceOperationBusyError) {
        throw createDeviceError(
          DEVICE_ERROR_CODES.commandBusy,
          'Device is busy with another protocol operation.',
          'main:device-manager',
          `deviceId=${error.deviceId}`
        )
      }
      throw error
    }
  }

  private startReconnectLoop(): void {
    if (this.reconnectTimer || this.reconnectRunning || this.connectionStatus !== 'Reconnecting') {
      return
    }

    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    const backoff = this.dependencies.reconnectBackoffMs ?? DEFAULT_RECONNECT_BACKOFF_MS
    const delay = backoff[Math.min(this.reconnectAttempt, backoff.length - 1)] ?? 10000

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.runReconnectAttempt()
    }, delay)

    this.dependencies.logger.write({
      category: 'communication',
      level: 'info',
      message: 'Scheduled device reconnect',
      source: 'main:device-manager',
      context: {
        deviceId: SIMULATED_MIXER_DEVICE_ID,
        attempt: this.reconnectAttempt + 1,
        delayMs: delay
      }
    })
  }

  private async runReconnectAttempt(): Promise<void> {
    if (this.connectionStatus !== 'Reconnecting' || this.reconnectRunning) {
      return
    }

    const generation = this.lifecycleGeneration
    this.reconnectRunning = true
    try {
      await this.adapter.disconnect()
      await this.adapter.connect(this.getConnectionConfig())
      if (!this.isLifecycleCurrent(generation, 'Reconnecting')) {
        await this.disconnectAdapterSafely('stale-reconnect-success')
        return
      }

      this.reconnectAttempt = 0
      this.lastError = undefined
      if (this.applyTransition('reconnectSucceeded', 'reconnect-success')) {
        this.dependencies.lifecycle?.onConnected?.(SIMULATED_MIXER_DEVICE_ID)
      }
    } catch (error) {
      if (!this.isLifecycleCurrent(generation, 'Reconnecting')) {
        return
      }

      const appError = toAppError(error, 'main:device-manager')
      this.lastError = appError
      if (isUnrecoverableReconnectError(appError)) {
        if (this.applyTransition('unrecoverableFailure', 'reconnect-unrecoverable-failure', appError)) {
          this.dependencies.lifecycle?.onFault?.(SIMULATED_MIXER_DEVICE_ID, appError)
        }
        return
      }

      this.reconnectAttempt += 1
      this.logReconnectFailure(appError)
    } finally {
      this.reconnectRunning = false
    }

    if (this.isLifecycleCurrent(generation, 'Reconnecting')) {
      this.scheduleReconnect()
    }
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectRunning = false
    this.reconnectAttempt = 0
    this.lastReconnectFailureLoggedAt = 0
  }

  private logReconnectFailure(error: AppErrorShape): void {
    const now = Date.now()
    if (this.reconnectAttempt > 3 && now - this.lastReconnectFailureLoggedAt < 5000) {
      return
    }

    this.lastReconnectFailureLoggedAt = now
    this.dependencies.logger.write({
      category: 'communication',
      level: 'warn',
      message: 'Device reconnect attempt failed',
      source: 'main:device-manager',
      context: {
        deviceId: SIMULATED_MIXER_DEVICE_ID,
        attempt: this.reconnectAttempt,
        errorCode: error.code,
        errorMessage: error.message
      }
    })
  }

  private getConnectionConfig(): ProtocolConnectionConfig {
    return this.connectionConfig
  }

  private createAdapter(config: ProtocolConnectionConfig): IProtocolAdapter {
    return this.dependencies.adapterFactory?.(config) ?? createProtocolAdapter(config, this.dependencies.logger)
  }

  private applyTransition(event: DeviceStateEvent, reason: string, error?: AppErrorShape): boolean {
    const transition = transitionDeviceState(this.connectionStatus, event, reason, error)
    if (!transition) {
      this.dependencies.logger.write({
        category: 'error',
        level: 'warn',
        message: 'Rejected invalid device state transition',
        source: 'main:device-manager',
        context: {
          deviceId: SIMULATED_MIXER_DEVICE_ID,
          from: this.connectionStatus,
          event,
          reason
        }
      })
      return false
    }

    this.connectionStatus = transition.to
    this.lastTransitionAt = this.dependencies.now?.() ?? new Date().toISOString()
    this.transitionReason = reason
    if (error) {
      this.lastError = error
    }

    this.dependencies.logger.write({
      category: 'communication',
      level: 'info',
      message: 'Device state changed',
      source: 'main:device-manager',
      context: {
        deviceId: SIMULATED_MIXER_DEVICE_ID,
        from: transition.from,
        to: transition.to,
        event,
        reason,
        errorCode: error?.code ?? null
      }
    })

    this.emitState()
    return true
  }

  private nextLifecycleGeneration(): number {
    this.lifecycleGeneration += 1
    return this.lifecycleGeneration
  }

  private isLifecycleCurrent(generation: number, expectedState: DeviceConnectionStatus): boolean {
    return this.lifecycleGeneration === generation && this.connectionStatus === expectedState
  }

  private async disconnectAdapterSafely(reason: string): Promise<void> {
    try {
      await this.adapter.disconnect()
    } catch (error) {
      const appError = toAppError(error, 'main:device-manager')
      this.dependencies.logger.write({
        category: 'error',
        level: 'warn',
        message: 'Failed to disconnect protocol adapter during device cleanup',
        source: 'main:device-manager',
        context: {
          deviceId: SIMULATED_MIXER_DEVICE_ID,
          reason,
          errorCode: appError.code,
          errorMessage: appError.message
        }
      })
    }
  }

  private emitState(): void {
    const event: DeviceStateChangedEvent = {
      ...this.toDeviceStatus(),
      emittedAt: new Date().toISOString()
    }

    this.listeners.forEach((listener) => {
      listener({ ...event })
    })
  }

  private toDeviceStatus(): DeviceStatus {
    const adapterStatus = this.adapter.getStatus()
    const connectionConfig = this.getConnectionConfig()
    const protocol = getProtocolKind(connectionConfig)
    return {
      deviceId: SIMULATED_MIXER_DEVICE_ID,
      name: DEFAULT_DEVICE_NAME,
      protocol,
      connectionStatus: this.connectionStatus,
      endpoint: protocol === 'opcUa'
        ? {
            endpointUrl: connectionConfig.endpointUrl
          }
        : {
            host: connectionConfig.host,
            port: connectionConfig.port,
            unitId: adapterStatus.unitId ?? connectionConfig.unitId
          },
      lastTransitionAt: this.lastTransitionAt,
      transitionReason: this.transitionReason,
      lastSuccessfulAt: adapterStatus.lastSuccessfulAt,
      lastError: this.lastError ?? adapterStatus.lastError
    }
  }
}

export function createDefaultDeviceManager(logger: Logger): DeviceManager {
  return new DeviceManager({
    logger,
    adapterFactory: (config) => createProtocolAdapter(config, logger),
    operationGate: new DeviceOperationGate()
  })
}

export function createPointValue(
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

export function encodeWritablePoint(
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

function isLifecycleCommunicationError(error: AppErrorShape): boolean {
  return error.code === DEVICE_ERROR_CODES.connectionLost ||
    error.code === DEVICE_ERROR_CODES.connectionFailed ||
    error.code === DEVICE_ERROR_CODES.notConnected ||
    error.code === DEVICE_ERROR_CODES.requestTimeout ||
    error.code === DEVICE_ERROR_CODES.configurationInvalid ||
    error.code === DEVICE_ERROR_CODES.protocolError ||
    error.code === UNKNOWN_ERROR_CODE
}

function isUnrecoverableReconnectError(error: AppErrorShape): boolean {
  return error.code === DEVICE_ERROR_CODES.illegalAddress ||
    error.code === DEVICE_ERROR_CODES.writeRejected ||
    error.code === DEVICE_ERROR_CODES.configurationInvalid ||
    error.code === DEVICE_ERROR_CODES.commandRejected ||
    error.code === DEVICE_ERROR_CODES.commandBusy
}

function toProtocolConnectionConfig(request: DeviceConfigUpdateRequest): ProtocolConnectionConfig {
  if (request.connection.protocol === 'opcUa') {
    return {
      deviceId: SIMULATED_MIXER_DEVICE_ID,
      protocol: 'opcUa',
      endpointUrl: request.connection.endpointUrl || DEFAULT_OPCUA_ENDPOINT_URL,
      securityMode: 'None',
      securityPolicy: 'None',
      anonymous: true,
      connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
      requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS
    }
  }

  return {
    deviceId: SIMULATED_MIXER_DEVICE_ID,
    protocol: 'modbusTcp',
    host: request.connection.host,
    port: request.connection.port,
    unitId: request.connection.unitId,
    connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
    requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS
  }
}
