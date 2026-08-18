import type { AppErrorShape } from '../../../shared/app-error'
import type { ModbusRawValue } from '../../../shared/modbus'
import type { Logger } from '../../logging/logger'
import { createDeviceError, DEVICE_ERROR_CODES } from '../errors'
import type {
  IProtocolAdapter,
  ProtocolAdapterStatus,
  ProtocolConnectionConfig,
  ProtocolConnectionStatus,
  ProtocolReadRequest,
  ProtocolReadResult,
  ProtocolWriteRequest,
  ProtocolWriteResult
} from '../types'
import { ModbusClientError, ModbusTcpClient } from './modbus-client'

export class ModbusAdapter implements IProtocolAdapter {
  private client = new ModbusTcpClient()
  private connectionStatus: ProtocolConnectionStatus = 'Disconnected'
  private config: ProtocolConnectionConfig | null = null
  private lastSuccessfulAt: string | undefined
  private lastError: AppErrorShape | undefined

  constructor(private readonly logger: Logger) {
    this.client.onConnectionLost = (error) => {
      if (this.connectionStatus === 'Connected') {
        this.connectionStatus = 'Fault'
      }
      this.lastError = this.mapClientError(error, 'main:protocol:modbus')
      this.logger.write({
        category: 'communication',
        level: 'warn',
        message: 'Modbus TCP connection lost',
        source: 'main:protocol:modbus',
        context: this.createLogContext({
          result: 'connection-lost',
          errorCode: this.lastError.code,
          errorMessage: this.lastError.message
        })
      })
    }
  }

  async connect(config: ProtocolConnectionConfig): Promise<void> {
    this.config = config
    this.connectionStatus = 'Connecting'
    this.lastError = undefined
    const startedAt = Date.now()

    this.logger.write({
      category: 'communication',
      level: 'info',
      message: 'Connecting Modbus TCP device',
      source: 'main:protocol:modbus',
      context: this.createLogContext({ result: 'started' })
    })

    try {
      await this.client.connect(config, config.connectTimeoutMs)
      this.connectionStatus = 'Connected'
      this.lastSuccessfulAt = new Date().toISOString()
      this.logSuccess('Connected Modbus TCP device', 'connect', Date.now() - startedAt)
    } catch (error) {
      this.connectionStatus = 'Disconnected'
      this.lastError = this.mapClientError(error, 'main:protocol:modbus')
      this.logFailure('Failed to connect Modbus TCP device', 'connect', Date.now() - startedAt, this.lastError)
      throw this.lastError
    }
  }

  async disconnect(): Promise<void> {
    this.client.disconnect()
    this.connectionStatus = 'Disconnected'
    this.lastError = undefined
    this.logger.write({
      category: 'communication',
      level: 'info',
      message: 'Disconnected Modbus TCP device',
      source: 'main:protocol:modbus',
      context: this.createLogContext({ result: 'success' })
    })
  }

  async read(request: ProtocolReadRequest): Promise<ProtocolReadResult> {
    this.assertConnected()
    const startedAt = Date.now()

    try {
      const unitId = request.unitId ?? this.requireConfig().unitId
      const timeoutMs = request.timeoutMs ?? this.requireConfig().requestTimeoutMs
      let values: ModbusRawValue[]

      if (request.area === 'coil') {
        values = await this.client.readCoils(request.address, request.quantity, unitId, timeoutMs)
      } else if (request.area === 'discreteInput') {
        values = await this.client.readDiscreteInputs(request.address, request.quantity, unitId, timeoutMs)
      } else if (request.area === 'holdingRegister') {
        values = await this.client.readHoldingRegisters(request.address, request.quantity, unitId, timeoutMs)
      } else {
        values = await this.client.readInputRegisters(request.address, request.quantity, unitId, timeoutMs)
      }

      this.lastSuccessfulAt = new Date().toISOString()
      this.logSuccess('Read Modbus TCP values', 'read', Date.now() - startedAt, request, 'debug')

      return {
        area: request.area,
        address: request.address,
        quantity: request.quantity,
        values
      }
    } catch (error) {
      const appError = this.mapClientError(error, 'main:protocol:modbus')
      this.lastError = appError
      this.updateStatusForError(appError)
      this.logFailure('Failed to read Modbus TCP values', 'read', Date.now() - startedAt, appError, request)
      throw appError
    }
  }

  async write(request: ProtocolWriteRequest): Promise<ProtocolWriteResult> {
    this.assertConnected()
    const startedAt = Date.now()

    try {
      const unitId = request.unitId ?? this.requireConfig().unitId
      const timeoutMs = request.timeoutMs ?? this.requireConfig().requestTimeoutMs

      if (request.area === 'coil') {
        await this.client.writeCoils(request.address, this.requireBooleanValues(request.values), unitId, timeoutMs)
      } else if (request.area === 'holdingRegister') {
        await this.client.writeHoldingRegisters(request.address, this.requireRegisterValues(request.values), unitId, timeoutMs)
      } else {
        throw createDeviceError(
          DEVICE_ERROR_CODES.writeRejected,
          'Read-only Modbus area cannot be written.',
          'main:protocol:modbus',
          `area=${request.area}`
        )
      }

      this.lastSuccessfulAt = new Date().toISOString()
      this.logSuccess('Wrote Modbus TCP values', 'write', Date.now() - startedAt, request)

      return {
        area: request.area,
        address: request.address,
        quantity: request.values.length
      }
    } catch (error) {
      const appError = this.mapClientError(error, 'main:protocol:modbus')
      this.lastError = appError
      this.updateStatusForError(appError)
      this.logFailure('Failed to write Modbus TCP values', 'write', Date.now() - startedAt, appError, request)
      throw appError
    }
  }

  getStatus(): ProtocolAdapterStatus {
    const config = this.config
    return {
      connectionStatus: this.connectionStatus,
      endpoint: config ? `${config.host}:${config.port}` : undefined,
      unitId: config?.unitId,
      lastSuccessfulAt: this.lastSuccessfulAt,
      lastError: this.lastError
    }
  }

  private assertConnected(): void {
    if (this.connectionStatus === 'Connected' && this.client.connected) {
      return
    }

    if (this.connectionStatus === 'Fault') {
      throw createDeviceError(
        DEVICE_ERROR_CODES.connectionLost,
        'Device connection has been lost.',
        'main:protocol:modbus'
      )
    }

    throw createDeviceError(
      DEVICE_ERROR_CODES.notConnected,
      'Device is not connected.',
      'main:protocol:modbus'
    )
  }

  private requireConfig(): ProtocolConnectionConfig {
    if (!this.config) {
      throw createDeviceError(
        DEVICE_ERROR_CODES.notConnected,
        'Device connection is not configured.',
        'main:protocol:modbus'
      )
    }

    return this.config
  }

  private requireBooleanValues(values: readonly ModbusRawValue[]): boolean[] {
    return values.map((value) => {
      if (typeof value !== 'boolean') {
        throw createDeviceError(
          DEVICE_ERROR_CODES.writeRejected,
          'Coil writes require boolean values.',
          'main:protocol:modbus'
        )
      }
      return value
    })
  }

  private requireRegisterValues(values: readonly ModbusRawValue[]): number[] {
    return values.map((value) => {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 0xffff) {
        throw createDeviceError(
          DEVICE_ERROR_CODES.writeRejected,
          'Holding register writes require uint16 values.',
          'main:protocol:modbus'
        )
      }
      return value
    })
  }

  private mapClientError(error: unknown, source: string): AppErrorShape {
    if (isAppError(error)) {
      return error
    }

    if (error instanceof ModbusClientError) {
      if (error.kind === 'timeout') {
        return createDeviceError(DEVICE_ERROR_CODES.requestTimeout, 'Device request timed out.', source, error.message)
      }

      if (error.kind === 'connection') {
        return createDeviceError(DEVICE_ERROR_CODES.connectionFailed, 'Unable to connect device.', source, error.message)
      }

      if (error.kind === 'connection-lost') {
        return createDeviceError(DEVICE_ERROR_CODES.connectionLost, 'Device connection was lost.', source, error.message)
      }

      if (error.kind === 'illegal-address') {
        return createDeviceError(DEVICE_ERROR_CODES.illegalAddress, 'Modbus register address is invalid.', source, error.message)
      }

      if (error.kind === 'illegal-value') {
        return createDeviceError(DEVICE_ERROR_CODES.writeRejected, 'Modbus write was rejected.', source, error.message)
      }

      return createDeviceError(DEVICE_ERROR_CODES.protocolError, 'Modbus protocol error.', source, error.message)
    }

    if (error instanceof Error) {
      return createDeviceError(DEVICE_ERROR_CODES.protocolError, 'Modbus protocol error.', source, error.message, error)
    }

    return createDeviceError(DEVICE_ERROR_CODES.protocolError, 'Modbus protocol error.', source, String(error))
  }

  private updateStatusForError(error: AppErrorShape): void {
    if (
      error.code === DEVICE_ERROR_CODES.connectionLost ||
      error.code === DEVICE_ERROR_CODES.requestTimeout ||
      error.code === DEVICE_ERROR_CODES.protocolError
    ) {
      this.connectionStatus = 'Fault'
    }
  }

  private logSuccess(
    message: string,
    event: string,
    durationMs: number,
    request?: ProtocolReadRequest | ProtocolWriteRequest,
    level: 'debug' | 'info' = 'info'
  ): void {
    this.logger.write({
      category: 'communication',
      level,
      message,
      source: 'main:protocol:modbus',
      context: this.createLogContext({
        event,
        result: 'success',
        durationMs,
        area: request?.area ?? null,
        address: request?.address ?? null,
        quantity: request ? ('quantity' in request ? request.quantity : request.values.length) : null
      })
    })
  }

  private logFailure(
    message: string,
    event: string,
    durationMs: number,
    error: AppErrorShape,
    request?: ProtocolReadRequest | ProtocolWriteRequest
  ): void {
    this.logger.write({
      category: 'communication',
      level: 'warn',
      message,
      source: 'main:protocol:modbus',
      context: this.createLogContext({
        event,
        result: 'error',
        durationMs,
        errorCode: error.code,
        errorMessage: error.message,
        area: request?.area ?? null,
        address: request?.address ?? null,
        quantity: request ? ('quantity' in request ? request.quantity : request.values.length) : null
      })
    })
  }

  private createLogContext(context: Record<string, string | number | boolean | null>): Record<string, string | number | boolean | null> {
    const config = this.config
    return {
      deviceId: config?.deviceId ?? null,
      protocol: 'modbusTcp',
      endpoint: config ? `${config.host}:${config.port}` : null,
      unitId: config?.unitId ?? null,
      ...context
    }
  }
}

function isAppError(error: unknown): error is AppErrorShape {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const candidate = error as Partial<AppErrorShape>
  return typeof candidate.code === 'string' && typeof candidate.message === 'string'
}
