import type { Logger } from '../logging/logger'
import { createDeviceError, DEVICE_ERROR_CODES } from './errors'
import { ModbusAdapter } from './modbus/ModbusAdapter'
import type {
  IProtocolAdapter,
  ProtocolAdapterCapabilities,
  ProtocolAdapterStatus,
  ProtocolConnectionConfig,
  ProtocolKind,
  ProtocolReadRequest,
  ProtocolReadResult,
  ProtocolSubscriptionFailureListener,
  ProtocolSubscriptionHandle,
  ProtocolSubscriptionItem,
  ProtocolSubscriptionListener,
  ProtocolWriteRequest,
  ProtocolWriteResult
} from './types'

export function createProtocolAdapter(config: ProtocolConnectionConfig, logger: Logger): IProtocolAdapter {
  switch (getProtocolKind(config)) {
    case 'modbusTcp':
      return new ModbusAdapter(logger)
    case 'opcUa':
      return new LazyOpcUaAdapter(logger)
    default:
      throw createDeviceError(
        DEVICE_ERROR_CODES.configurationInvalid,
        'Device protocol is not supported.',
        'main:protocol-factory'
      )
  }
}

export function getProtocolKind(config: ProtocolConnectionConfig): ProtocolKind {
  return config.protocol ?? 'modbusTcp'
}

class LazyOpcUaAdapter implements IProtocolAdapter {
  private adapter: IProtocolAdapter | undefined
  private loading: Promise<IProtocolAdapter> | undefined

  constructor(private readonly logger: Logger) {}

  getCapabilities(): ProtocolAdapterCapabilities {
    return {
      protocol: 'opcUa',
      preferredAcquisition: 'subscription',
      supportsPolling: true,
      supportsSubscription: true,
      supportsBatchRead: false,
      supportsWrite: true,
      supportsReadBack: true,
      maxItemsPerSubscription: 1000,
      requestTimeoutMs: 1000
    }
  }

  async connect(config: ProtocolConnectionConfig): Promise<void> {
    const adapter = await this.getAdapter()
    await adapter.connect(config)
  }

  async disconnect(): Promise<void> {
    if (!this.adapter) {
      return
    }

    await this.adapter.disconnect()
  }

  async read(request: ProtocolReadRequest): Promise<ProtocolReadResult> {
    const adapter = await this.getAdapter()
    return adapter.read(request)
  }

  async write(request: ProtocolWriteRequest): Promise<ProtocolWriteResult> {
    const adapter = await this.getAdapter()
    return adapter.write(request)
  }

  getStatus(): ProtocolAdapterStatus {
    return this.adapter?.getStatus() ?? {
      protocol: 'opcUa',
      connectionStatus: 'Disconnected'
    }
  }

  async subscribe(
    items: readonly ProtocolSubscriptionItem[],
    listener: ProtocolSubscriptionListener,
    failureListener?: ProtocolSubscriptionFailureListener
  ): Promise<ProtocolSubscriptionHandle> {
    const adapter = await this.getAdapter()
    if (!adapter.subscribe) {
      throw createDeviceError(
        DEVICE_ERROR_CODES.protocolError,
        'OPC UA adapter does not support subscription.',
        'main:protocol-factory'
      )
    }

    return adapter.subscribe(items, listener, failureListener)
  }

  private async getAdapter(): Promise<IProtocolAdapter> {
    if (this.adapter) {
      return this.adapter
    }

    this.loading ??= this.loadAdapter()
    this.adapter = await this.loading
    return this.adapter
  }

  private async loadAdapter(): Promise<IProtocolAdapter> {
    try {
      const module = await import('./opcua/OpcUaAdapter')
      return new module.OpcUaAdapter(this.logger)
    } catch (error) {
      this.loading = undefined
      throw createDeviceError(
        DEVICE_ERROR_CODES.protocolError,
        'OPC UA protocol module could not be loaded.',
        'main:protocol-factory',
        'Check node-opcua runtime compatibility with the current Electron version.',
        error
      )
    }
  }
}
