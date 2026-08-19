import {
  AttributeIds,
  ClientSubscription,
  DataType,
  MessageSecurityMode,
  OPCUAClient,
  SecurityPolicy,
  StatusCodes,
  TimestampsToReturn,
  Variant,
  type ClientMonitoredItemGroup,
  type ClientSession,
  type DataValue,
  type OPCUAClient as OpcUaClientInstance,
  type StatusCode
} from 'node-opcua'

import { type AppErrorShape } from '../../../shared/app-error'
import {
  decodeModbusPointValue,
  encodeModbusPointValue,
  getModbusPoint,
  type ModbusEngineeringValue,
  type ModbusPointDefinition,
  type ModbusRawValue
} from '../../../shared/modbus'
import type { TagQuality } from '../../../shared/tag'
import type { Logger } from '../../logging/logger'
import {
  DEFAULT_OPCUA_ENDPOINT_URL,
  createOpcUaBinding,
  getPointIdForProtocolRequest
} from '../bindings'
import { createDeviceError, DEVICE_ERROR_CODES } from '../errors'
import type {
  IProtocolAdapter,
  OpcUaConnectionConfig,
  OpcUaProtocolBinding,
  ProtocolAdapterStatus,
  ProtocolConnectionConfig,
  ProtocolConnectionStatus,
  ProtocolReadRequest,
  ProtocolReadResult,
  ProtocolSubscriptionFailureListener,
  ProtocolSubscriptionHandle,
  ProtocolSubscriptionItem,
  ProtocolSubscriptionListener,
  ProtocolSubscriptionValue,
  ProtocolValueDataType,
  ProtocolWriteRequest,
  ProtocolWriteResult
} from '../types'

const STATUS_SEVERITY_MASK = 0xc0000000
const STATUS_UNCERTAIN = 0x40000000
const STATUS_BAD = 0x80000000

export class OpcUaAdapter implements IProtocolAdapter {
  private client: OpcUaClientInstance | null = null
  private session: ClientSession | null = null
  private connectionStatus: ProtocolConnectionStatus = 'Disconnected'
  private config: OpcUaConnectionConfig | null = null
  private lastSuccessfulAt: string | undefined
  private lastError: AppErrorShape | undefined
  private readonly activeSubscriptions = new Set<OpcUaSubscriptionHandle>()

  constructor(private readonly logger: Logger) {}

  getCapabilities() {
    return {
      protocol: 'opcUa',
      preferredAcquisition: 'subscription',
      supportsPolling: true,
      supportsSubscription: true,
      supportsBatchRead: false,
      supportsWrite: true,
      supportsReadBack: true,
      maxItemsPerSubscription: 1000,
      requestTimeoutMs: this.config?.requestTimeoutMs ?? 2000
    } as const
  }

  async connect(config: ProtocolConnectionConfig): Promise<void> {
    this.config = requireOpcUaConfig(config)
    this.connectionStatus = 'Connecting'
    this.lastError = undefined
    const startedAt = Date.now()

    this.logger.write({
      category: 'communication',
      level: 'info',
      message: 'Connecting OPC UA device',
      source: 'main:protocol:opcua',
      context: this.createLogContext({ result: 'started' })
    })

    try {
      const client = OPCUAClient.create({
        endpointMustExist: false,
        securityMode: MessageSecurityMode.None,
        securityPolicy: SecurityPolicy.None,
        requestedSessionTimeout: Math.max(this.config.requestTimeoutMs * 4, 10000),
        connectionStrategy: {
          initialDelay: 1000,
          maxRetry: 0
        }
      })
      this.client = client
      await withTimeout(client.connect(this.config.endpointUrl), this.config.connectTimeoutMs, () => (
        createDeviceError(
          DEVICE_ERROR_CODES.requestTimeout,
          'OPC UA connect timed out.',
          'main:protocol:opcua'
        )
      ))
      this.session = await withTimeout(client.createSession(), this.config.connectTimeoutMs, () => (
        createDeviceError(
          DEVICE_ERROR_CODES.requestTimeout,
          'OPC UA session creation timed out.',
          'main:protocol:opcua'
        )
      ))
      this.session.on('session_closed', (statusCode) => {
        this.handleSessionClosed(statusCode)
      })

      this.connectionStatus = 'Connected'
      this.lastSuccessfulAt = new Date().toISOString()
      this.logSuccess('Connected OPC UA device', 'connect', Date.now() - startedAt)
    } catch (error) {
      this.connectionStatus = 'Disconnected'
      this.lastError = this.mapOpcUaError(error, 'Unable to connect OPC UA device.')
      await this.cleanupClient()
      this.logFailure('Failed to connect OPC UA device', 'connect', Date.now() - startedAt, this.lastError)
      throw this.lastError
    }
  }

  async disconnect(): Promise<void> {
    await this.cleanupClient()
    this.connectionStatus = 'Disconnected'
    this.lastError = undefined
    this.logger.write({
      category: 'communication',
      level: 'info',
      message: 'Disconnected OPC UA device',
      source: 'main:protocol:opcua',
      context: this.createLogContext({ result: 'success' })
    })
  }

  async read(request: ProtocolReadRequest): Promise<ProtocolReadResult> {
    this.assertConnected()
    const session = this.requireSession()
    const binding = this.resolveBinding(request)
    const point = this.resolvePoint(request)
    const startedAt = Date.now()

    try {
      const dataValue = await withTimeout(
        session.read({
          nodeId: binding.nodeId,
          attributeId: AttributeIds.Value
        }),
        request.timeoutMs ?? this.requireConfig().requestTimeoutMs,
        () => createDeviceError(
          DEVICE_ERROR_CODES.requestTimeout,
          'OPC UA read timed out.',
          'main:protocol:opcua',
          `nodeId=${binding.nodeId}`
        )
      )
      const quality = mapOpcUaQuality(dataValue.statusCode)
      if (quality === 'Bad') {
        throw createDeviceError(
          DEVICE_ERROR_CODES.protocolError,
          'OPC UA read returned Bad quality.',
          'main:protocol:opcua',
          `${binding.nodeId}: ${dataValue.statusCode.toString()}`
        )
      }

      const engineeringValue = normalizeEngineeringValue(point, dataValue.value?.value)
      const values = encodeRawPointValue(point, engineeringValue)
      this.lastSuccessfulAt = new Date().toISOString()
      this.logSuccess('Read OPC UA value', 'read', Date.now() - startedAt, request, 'debug')

      return {
        binding,
        area: request.area,
        address: request.address,
        quantity: request.quantity,
        values,
        quality
      }
    } catch (error) {
      const appError = this.mapOpcUaError(error, 'OPC UA read failed.')
      this.lastError = appError
      this.updateStatusForError(appError)
      this.logFailure('Failed to read OPC UA value', 'read', Date.now() - startedAt, appError, request)
      throw appError
    }
  }

  async write(request: ProtocolWriteRequest): Promise<ProtocolWriteResult> {
    this.assertConnected()
    const session = this.requireSession()
    const binding = this.resolveBinding(request)
    const point = this.resolvePoint(request)
    const startedAt = Date.now()

    if (!binding.writable) {
      throw createDeviceError(
        DEVICE_ERROR_CODES.writeRejected,
        'OPC UA node is read-only.',
        'main:protocol:opcua',
        `nodeId=${binding.nodeId}`
      )
    }

    try {
      const engineeringValue = decodeModbusPointValue(point, request.values)
      const statusCode = await withTimeout(
        session.write({
          nodeId: binding.nodeId,
          attributeId: AttributeIds.Value,
          value: {
            statusCode: StatusCodes.Good,
            value: new Variant({
              dataType: toOpcUaDataType(binding.dataType),
              value: coerceVariantValue(binding.dataType, engineeringValue)
            })
          }
        }),
        request.timeoutMs ?? this.requireConfig().requestTimeoutMs,
        () => createDeviceError(
          DEVICE_ERROR_CODES.requestTimeout,
          'OPC UA write timed out.',
          'main:protocol:opcua',
          `nodeId=${binding.nodeId}`
        )
      )

      if (mapOpcUaQuality(statusCode) !== 'Good') {
        throw createDeviceError(
          DEVICE_ERROR_CODES.writeRejected,
          'OPC UA write was rejected.',
          'main:protocol:opcua',
          `${binding.nodeId}: ${statusCode.toString()}`
        )
      }

      this.lastSuccessfulAt = new Date().toISOString()
      this.logSuccess('Wrote OPC UA value', 'write', Date.now() - startedAt, request)

      return {
        binding,
        area: request.area,
        address: request.address,
        quantity: request.values.length
      }
    } catch (error) {
      const appError = this.mapOpcUaError(error, 'OPC UA write failed.')
      this.lastError = appError
      this.updateStatusForError(appError)
      this.logFailure('Failed to write OPC UA value', 'write', Date.now() - startedAt, appError, request)
      throw appError
    }
  }

  async subscribe(
    items: readonly ProtocolSubscriptionItem[],
    listener: ProtocolSubscriptionListener,
    failureListener?: ProtocolSubscriptionFailureListener
  ): Promise<ProtocolSubscriptionHandle> {
    this.assertConnected()
    if (items.length === 0) {
      return {
        dispose: async () => undefined
      }
    }

    const session = this.requireSession()
    const config = this.requireConfig()
    const subscription = ClientSubscription.create(session, {
      requestedPublishingInterval: Math.min(...items.map((item) => item.binding.samplingIntervalMs)),
      requestedLifetimeCount: 60,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: Math.min(items.length, 1000),
      publishingEnabled: true,
      priority: 10
    })
    const monitoredItems = await subscription.monitorItems(
      items.map((item) => ({
        nodeId: item.binding.nodeId,
        attributeId: AttributeIds.Value
      })),
      {
        samplingInterval: Math.min(...items.map((item) => item.binding.samplingIntervalMs)),
        queueSize: 1,
        discardOldest: true
      },
      TimestampsToReturn.Both
    )

    const handle = new OpcUaSubscriptionHandle(
      subscription,
      monitoredItems,
      () => {
        this.activeSubscriptions.delete(handle)
      },
      failureListener
    )
    this.activeSubscriptions.add(handle)

    monitoredItems.on('changed', (_monitoredItem, dataValue, index) => {
      const item = items[index]
      if (!item) {
        return
      }

      listener([toSubscriptionValue(item, dataValue)])
      this.lastSuccessfulAt = new Date().toISOString()
    })

    monitoredItems.on('err', (message) => {
      const appError = createDeviceError(
        DEVICE_ERROR_CODES.protocolError,
        'OPC UA monitored item failed.',
        'main:protocol:opcua',
        message
      )
      this.reportSubscriptionFailure(appError)
    })

    subscription.on('terminated', () => {
      if (this.connectionStatus === 'Connected') {
        const appError = createDeviceError(
          DEVICE_ERROR_CODES.connectionLost,
          'OPC UA subscription was terminated.',
          'main:protocol:opcua'
        )
        this.reportSubscriptionFailure(appError)
      }
    })

    this.logger.write({
      category: 'communication',
      level: 'info',
      message: 'Started OPC UA subscription',
      source: 'main:protocol:opcua',
      context: this.createLogContext({
        itemCount: items.length,
        requestTimeoutMs: config.requestTimeoutMs
      })
    })

    return handle
  }

  getStatus(): ProtocolAdapterStatus {
    const config = this.config
    return {
      connectionStatus: this.connectionStatus,
      protocol: 'opcUa',
      endpoint: config?.endpointUrl,
      lastSuccessfulAt: this.lastSuccessfulAt,
      lastError: this.lastError
    }
  }

  private handleSessionClosed(statusCode: StatusCode): void {
    if (this.connectionStatus !== 'Connected') {
      return
    }

    const appError = createDeviceError(
      DEVICE_ERROR_CODES.connectionLost,
      'OPC UA session was closed.',
      'main:protocol:opcua',
      statusCode.toString()
    )
    this.reportSubscriptionFailure(appError)
  }

  private reportSubscriptionFailure(error: AppErrorShape): void {
    this.lastError = error
    this.updateStatusForError(error)
    this.activeSubscriptions.forEach((handle) => {
      handle.notifyFailure(error)
    })
  }

  private async cleanupClient(): Promise<void> {
    const handles = [...this.activeSubscriptions]
    this.activeSubscriptions.clear()
    await Promise.all(handles.map((handle) => handle.dispose()))

    const session = this.session
    this.session = null
    if (session) {
      try {
        await session.close(true)
      } catch (error) {
        this.logger.write({
          category: 'error',
          level: 'warn',
          message: 'Failed to close OPC UA session',
          source: 'main:protocol:opcua',
          context: {
            error: error instanceof Error ? error.message : String(error)
          }
        })
      }
    }

    const client = this.client
    this.client = null
    if (client) {
      try {
        await client.disconnect()
      } catch (error) {
        this.logger.write({
          category: 'error',
          level: 'warn',
          message: 'Failed to disconnect OPC UA client',
          source: 'main:protocol:opcua',
          context: {
            error: error instanceof Error ? error.message : String(error)
          }
        })
      }
    }
  }

  private assertConnected(): void {
    if (this.connectionStatus === 'Connected' && this.session) {
      return
    }

    if (this.connectionStatus === 'Fault') {
      throw createDeviceError(
        DEVICE_ERROR_CODES.connectionLost,
        'Device connection has been lost.',
        'main:protocol:opcua'
      )
    }

    throw createDeviceError(
      DEVICE_ERROR_CODES.notConnected,
      'Device is not connected.',
      'main:protocol:opcua'
    )
  }

  private requireSession(): ClientSession {
    if (!this.session) {
      throw createDeviceError(
        DEVICE_ERROR_CODES.notConnected,
        'OPC UA session is not available.',
        'main:protocol:opcua'
      )
    }

    return this.session
  }

  private requireConfig(): OpcUaConnectionConfig {
    if (!this.config) {
      throw createDeviceError(
        DEVICE_ERROR_CODES.notConnected,
        'OPC UA connection is not configured.',
        'main:protocol:opcua'
      )
    }

    return this.config
  }

  private resolvePoint(request: ProtocolReadRequest | ProtocolWriteRequest): ModbusPointDefinition {
    const pointId = getPointIdForProtocolRequest(request)
    if (!pointId) {
      throw createDeviceError(
        DEVICE_ERROR_CODES.illegalAddress,
        'OPC UA binding could not be resolved for device point.',
        'main:protocol:opcua',
        `area=${request.area};address=${request.address}`
      )
    }

    return getModbusPoint(pointId)
  }

  private resolveBinding(request: ProtocolReadRequest | ProtocolWriteRequest): OpcUaProtocolBinding {
    if (request.binding?.protocol === 'opcUa') {
      return request.binding
    }

    const pointId = getPointIdForProtocolRequest(request)
    if (!pointId) {
      throw createDeviceError(
        DEVICE_ERROR_CODES.illegalAddress,
        'OPC UA binding could not be resolved for device point.',
        'main:protocol:opcua',
        `area=${request.area};address=${request.address}`
      )
    }

    return createOpcUaBinding(pointId, request.timeoutMs ?? this.requireConfig().requestTimeoutMs)
  }

  private mapOpcUaError(error: unknown, fallbackMessage: string): AppErrorShape {
    if (isAppError(error)) {
      return error
    }

    if (error instanceof Error) {
      return createDeviceError(
        DEVICE_ERROR_CODES.protocolError,
        fallbackMessage,
        'main:protocol:opcua',
        error.message,
        error
      )
    }

    return createDeviceError(
      DEVICE_ERROR_CODES.protocolError,
      fallbackMessage,
      'main:protocol:opcua',
      String(error)
    )
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
      source: 'main:protocol:opcua',
      context: this.createLogContext({
        event,
        result: 'success',
        durationMs,
        area: request?.area ?? null,
        address: request?.address ?? null,
        quantity: request ? ('quantity' in request ? request.quantity : request.values.length) : null,
        nodeId: request?.binding?.protocol === 'opcUa' ? request.binding.nodeId : null
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
      source: 'main:protocol:opcua',
      context: this.createLogContext({
        event,
        result: 'error',
        durationMs,
        errorCode: error.code,
        errorMessage: error.message,
        area: request?.area ?? null,
        address: request?.address ?? null,
        quantity: request ? ('quantity' in request ? request.quantity : request.values.length) : null,
        nodeId: request?.binding?.protocol === 'opcUa' ? request.binding.nodeId : null
      })
    })
  }

  private createLogContext(context: Record<string, string | number | boolean | null>): Record<string, string | number | boolean | null> {
    const config = this.config
    return {
      deviceId: config?.deviceId ?? null,
      protocol: 'opcUa',
      endpoint: config?.endpointUrl ?? null,
      ...context
    }
  }
}

class OpcUaSubscriptionHandle implements ProtocolSubscriptionHandle {
  private disposed = false
  private failureNotified = false

  constructor(
    private readonly subscription: ClientSubscription,
    private readonly monitoredItems: ClientMonitoredItemGroup,
    private readonly onDispose: () => void,
    private readonly failureListener: ProtocolSubscriptionFailureListener | undefined
  ) {}

  notifyFailure(error: AppErrorShape): void {
    if (this.disposed || this.failureNotified) {
      return
    }

    this.failureNotified = true
    this.failureListener?.(error)
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return
    }

    this.disposed = true
    this.onDispose()
    this.monitoredItems.removeAllListeners()
    this.subscription.removeAllListeners()
    await this.monitoredItems.terminate()
    await this.subscription.terminate()
  }
}

function requireOpcUaConfig(config: ProtocolConnectionConfig): OpcUaConnectionConfig {
  if (config.protocol !== 'opcUa') {
    throw createDeviceError(
      DEVICE_ERROR_CODES.configurationInvalid,
      'OpcUaAdapter requires an OPC UA configuration.',
      'main:protocol:opcua'
    )
  }

  return {
    ...config,
    endpointUrl: config.endpointUrl || DEFAULT_OPCUA_ENDPOINT_URL,
    securityMode: 'None',
    securityPolicy: 'None',
    anonymous: true
  }
}

function toSubscriptionValue(item: ProtocolSubscriptionItem, dataValue: DataValue): ProtocolSubscriptionValue {
  return {
    tagId: item.tagId,
    binding: item.binding,
    value: dataValue.value?.value,
    quality: mapOpcUaQuality(dataValue.statusCode),
    timestamp: (dataValue.sourceTimestamp ?? dataValue.serverTimestamp ?? new Date()).toISOString()
  }
}

function mapOpcUaQuality(statusCode: StatusCode | undefined): TagQuality {
  if (!statusCode) {
    return 'Uncertain'
  }

  const severity = statusCode.value & STATUS_SEVERITY_MASK
  if (severity === STATUS_BAD) {
    return 'Bad'
  }

  if (severity === STATUS_UNCERTAIN) {
    return 'Uncertain'
  }

  return 'Good'
}

function normalizeEngineeringValue(point: ModbusPointDefinition, value: unknown): ModbusEngineeringValue {
  if (point.dataType === 'boolean') {
    if (typeof value !== 'boolean') {
      throw createDeviceError(
        DEVICE_ERROR_CODES.protocolError,
        'OPC UA value type is invalid.',
        'main:protocol:opcua',
        `pointId=${point.id}: expected boolean`
      )
    }
    return value
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw createDeviceError(
      DEVICE_ERROR_CODES.protocolError,
      'OPC UA value type is invalid.',
      'main:protocol:opcua',
      `pointId=${point.id}: expected number`
    )
  }

  return Math.round(value * 1000) / 1000
}

function encodeRawPointValue(point: ModbusPointDefinition, value: ModbusEngineeringValue): ModbusRawValue[] {
  return encodeModbusPointValue(
    {
      ...point,
      access: 'readWrite'
    },
    value
  )
}

function toOpcUaDataType(dataType: ProtocolValueDataType): DataType {
  switch (dataType) {
    case 'boolean':
      return DataType.Boolean
    case 'int16':
      return DataType.Int16
    case 'uint16':
      return DataType.UInt16
    case 'uint32':
      return DataType.UInt32
    case 'double':
      return DataType.Double
    case 'string':
      return DataType.String
  }
}

function coerceVariantValue(dataType: ProtocolValueDataType, value: ModbusEngineeringValue): boolean | number | string {
  if (dataType === 'boolean') {
    if (typeof value !== 'boolean') {
      throw createDeviceError(
        DEVICE_ERROR_CODES.writeRejected,
        'OPC UA write expects a boolean value.',
        'main:protocol:opcua'
      )
    }
    return value
  }

  if (typeof value !== 'number') {
    throw createDeviceError(
      DEVICE_ERROR_CODES.writeRejected,
      'OPC UA write expects a numeric value.',
      'main:protocol:opcua'
    )
  }

  return value
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, createTimeoutError: () => AppErrorShape): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null

  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      timer = null
      reject(createTimeoutError())
    }, timeoutMs)

    promise.then(
      (value) => {
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        resolve(value)
      },
      (error: unknown) => {
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        reject(error)
      }
    )
  })
}

function isAppError(error: unknown): error is AppErrorShape {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const candidate = error as Partial<AppErrorShape>
  return typeof candidate.code === 'string' && typeof candidate.message === 'string'
}
