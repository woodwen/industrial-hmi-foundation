import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DeviceManager,
  DEFAULT_RECONNECT_BACKOFF_MS,
  DEFAULT_SIMULATED_DEVICE_CONFIG
} from '../../../src/main/device'
import type { Logger } from '../../../src/main/logging/logger'
import { DEVICE_ERROR_CODES } from '../../../src/main/protocol/errors'
import type {
  IProtocolAdapter,
  ProtocolAdapterStatus,
  ProtocolConnectionConfig,
  ProtocolReadRequest,
  ProtocolReadResult,
  ProtocolWriteRequest,
  ProtocolWriteResult
} from '../../../src/main/protocol/types'
import type { AppErrorShape } from '../../../src/shared/app-error'
import type { ModbusRawValue } from '../../../src/shared/modbus'

describe('DeviceManager', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('connects and disconnects the default simulated PLC through IProtocolAdapter', async () => {
    const adapter = new FakeProtocolAdapter()
    const manager = new DeviceManager({
      adapter,
      logger: createLogger()
    })

    await expect(manager.connectDevice()).resolves.toMatchObject({
      connectionStatus: 'Connected',
      endpoint: {
        host: '127.0.0.1',
        port: 1502,
        unitId: 1
      }
    })
    expect(adapter.connectConfig).toEqual(DEFAULT_SIMULATED_DEVICE_CONFIG)

    await expect(manager.disconnectDevice()).resolves.toMatchObject({
      connectionStatus: 'Disconnected'
    })
  })

  it('updates protocol configuration and replaces the active adapter while disconnected', async () => {
    const adapters: FakeProtocolAdapter[] = []
    const manager = new DeviceManager({
      logger: createLogger(),
      adapterFactory: () => {
        const adapter = new FakeProtocolAdapter()
        adapters.push(adapter)
        return adapter
      }
    })

    await expect(manager.updateDeviceConfig({
      deviceId: 'simulated-mixer-plc',
      connection: {
        protocol: 'opcUa',
        endpointUrl: 'opc.tcp://127.0.0.1:4840/industrial-hmi-simulator'
      }
    })).resolves.toMatchObject({
      protocol: 'opcUa',
      endpoint: {
        endpointUrl: 'opc.tcp://127.0.0.1:4840/industrial-hmi-simulator'
      }
    })

    expect(adapters).toHaveLength(2)
    expect(manager.getProtocolAdapter()).toBe(adapters[1])
  })

  it('ignores connect requests that do not match the state machine', async () => {
    const adapter = new FakeProtocolAdapter()
    const manager = new DeviceManager({
      adapter,
      logger: createLogger(),
      reconnectBackoffMs: [10000]
    })

    await manager.connectDevice()
    await expect(manager.connectDevice()).resolves.toMatchObject({
      connectionStatus: 'Connected'
    })
    expect(adapter.connectCalls).toBe(1)

    manager.handleCommunicationFailure(new Error('socket closed'))
    await expect(manager.connectDevice()).resolves.toMatchObject({
      connectionStatus: 'Reconnecting'
    })
    expect(adapter.connectCalls).toBe(1)

    manager.dispose()
  })

  it('disconnects the adapter when disposed', async () => {
    const adapter = new FakeProtocolAdapter()
    const manager = new DeviceManager({
      adapter,
      logger: createLogger()
    })

    await manager.connectDevice()
    manager.dispose()

    expect(adapter.disconnectCalls).toBe(1)
  })

  it('reads configured points and decodes engineering values', async () => {
    const adapter = new FakeProtocolAdapter()
    const manager = new DeviceManager({
      adapter,
      logger: createLogger()
    })

    adapter.setRead('inputRegister', 0, 1, [255])
    adapter.setRead('inputRegister', 4, 2, [0x0001, 0x0002])

    const response = await manager.readDeviceRegisters({
      pointIds: ['currentTemperature', 'productionCount']
    })

    expect(response.values).toEqual([
      expect.objectContaining({
        pointId: 'currentTemperature',
        value: 25.5,
        formattedValue: '25.5 °C'
      }),
      expect.objectContaining({
        pointId: 'productionCount',
        value: 65538,
        rawValues: [1, 2]
      })
    ])
    expect(adapter.readRequests).toMatchObject([
      {
        area: 'inputRegister',
        address: 0,
        quantity: 1
      },
      {
        area: 'inputRegister',
        address: 4,
        quantity: 2
      }
    ])
  })

  it('rejects read-only writes before reaching the protocol adapter', async () => {
    const adapter = new FakeProtocolAdapter()
    const manager = new DeviceManager({
      adapter,
      logger: createLogger()
    })

    await manager.connectDevice()
    await expect(manager.writeDeviceRegisters({
      pointId: 'currentTemperature',
      value: 60
    })).rejects.toMatchObject({
      code: DEVICE_ERROR_CODES.writeRejected
    })
    expect(adapter.writeRequests).toEqual([])
    expect(manager.getDeviceStatus().connectionStatus).toBe('Connected')
  })

  it('encodes writable holding register values and returns read-back data', async () => {
    const adapter = new FakeProtocolAdapter()
    const manager = new DeviceManager({
      adapter,
      logger: createLogger()
    })

    adapter.setRead('holdingRegister', 0, 1, [625])

    await expect(manager.writeDeviceRegisters({
      pointId: 'targetTemperature',
      value: 62.5
    })).resolves.toMatchObject({
      point: {
        pointId: 'targetTemperature',
        value: 62.5,
        rawValues: [625]
      }
    })
    expect(adapter.writeRequests).toMatchObject([
      {
        area: 'holdingRegister',
        address: 0,
        values: [625]
      }
    ])
  })

  it('moves from Connected to Reconnecting and restores Connected through bounded backoff', async () => {
    vi.useFakeTimers()
    const adapter = new FakeProtocolAdapter()
    const manager = new DeviceManager({
      adapter,
      logger: createLogger(),
      reconnectBackoffMs: DEFAULT_RECONNECT_BACKOFF_MS
    })

    await manager.connectDevice()
    adapter.connectFailuresRemaining = 1
    manager.handleCommunicationFailure(new Error('socket closed'))

    expect(manager.getDeviceStatus()).toMatchObject({
      connectionStatus: 'Reconnecting',
      lastError: {
        message: 'socket closed'
      }
    })

    await vi.advanceTimersByTimeAsync(1000)

    expect(manager.getDeviceStatus().connectionStatus).toBe('Reconnecting')
    expect(adapter.connectCalls).toBe(2)

    await vi.advanceTimersByTimeAsync(2000)

    expect(manager.getDeviceStatus().connectionStatus).toBe('Connected')
    expect(adapter.connectCalls).toBe(3)
    manager.dispose()
  })

  it('keeps initial connect failure in Fault without starting automatic reconnect', async () => {
    vi.useFakeTimers()
    const adapter = new FakeProtocolAdapter()
    adapter.connectFailuresRemaining = 1
    const manager = new DeviceManager({
      adapter,
      logger: createLogger(),
      reconnectBackoffMs: [1]
    })

    await expect(manager.connectDevice()).rejects.toMatchObject({
      message: 'simulated connect failure'
    })
    expect(manager.getDeviceStatus().connectionStatus).toBe('Fault')

    await vi.advanceTimersByTimeAsync(100)

    expect(adapter.connectCalls).toBe(1)
    manager.dispose()
  })

  it('cancels reconnect attempts on manual disconnect', async () => {
    vi.useFakeTimers()
    const adapter = new FakeProtocolAdapter()
    const manager = new DeviceManager({
      adapter,
      logger: createLogger(),
      reconnectBackoffMs: [1000]
    })

    await manager.connectDevice()
    manager.handleCommunicationFailure(new Error('socket closed'))
    await manager.disconnectDevice()
    await vi.advanceTimersByTimeAsync(2000)

    expect(manager.getDeviceStatus().connectionStatus).toBe('Disconnected')
    expect(adapter.connectCalls).toBe(1)
  })

  it('moves reconnect to Fault when a reconnect attempt fails with an unrecoverable error', async () => {
    vi.useFakeTimers()
    const adapter = new FakeProtocolAdapter()
    const manager = new DeviceManager({
      adapter,
      logger: createLogger(),
      reconnectBackoffMs: [1000]
    })

    await manager.connectDevice()
    adapter.connectError = {
      code: DEVICE_ERROR_CODES.illegalAddress,
      message: 'Configured device address is invalid.',
      source: 'test'
    }
    manager.handleCommunicationFailure(new Error('socket closed'))

    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(5000)

    expect(manager.getDeviceStatus()).toMatchObject({
      connectionStatus: 'Fault',
      lastError: {
        code: DEVICE_ERROR_CODES.illegalAddress
      }
    })
    expect(adapter.connectCalls).toBe(2)
    manager.dispose()
  })
})

class FakeProtocolAdapter implements IProtocolAdapter {
  status: ProtocolAdapterStatus = {
    connectionStatus: 'Disconnected'
  }
  connectConfig: ProtocolConnectionConfig | null = null
  connectCalls = 0
  disconnectCalls = 0
  connectFailuresRemaining = 0
  connectError: AppErrorShape | null = null
  readRequests: ProtocolReadRequest[] = []
  writeRequests: ProtocolWriteRequest[] = []
  private readonly reads = new Map<string, ModbusRawValue[]>()

  getCapabilities() {
    return createModbusCapabilities()
  }

  async connect(config: ProtocolConnectionConfig): Promise<void> {
    this.connectCalls += 1
    if (this.connectFailuresRemaining > 0) {
      this.connectFailuresRemaining -= 1
      throw new Error('simulated connect failure')
    }
    if (this.connectError) {
      throw this.connectError
    }

    this.connectConfig = config
    this.status = {
      connectionStatus: 'Connected',
      endpoint: `${config.host}:${config.port}`,
      unitId: config.unitId,
      lastSuccessfulAt: '2026-08-18T00:00:00.000Z'
    }
  }

  async disconnect(): Promise<void> {
    this.disconnectCalls += 1
    this.status = {
      connectionStatus: 'Disconnected'
    }
  }

  async read(request: ProtocolReadRequest): Promise<ProtocolReadResult> {
    this.readRequests.push(request)

    return {
      area: request.area,
      address: request.address,
      quantity: request.quantity,
      values: this.reads.get(keyOf(request.area, request.address, request.quantity)) ?? [0]
    }
  }

  async write(request: ProtocolWriteRequest): Promise<ProtocolWriteResult> {
    this.writeRequests.push(request)

    return {
      area: request.area,
      address: request.address,
      quantity: request.values.length
    }
  }

  getStatus(): ProtocolAdapterStatus {
    return this.status
  }

  setRead(area: ProtocolReadRequest['area'], address: number, quantity: number, values: ModbusRawValue[]): void {
    this.reads.set(keyOf(area, address, quantity), values)
  }
}

function createModbusCapabilities() {
  return {
    protocol: 'modbusTcp',
    preferredAcquisition: 'polling',
    supportsPolling: true,
    supportsSubscription: false,
    supportsBatchRead: true,
    supportsWrite: true,
    supportsReadBack: true,
    requestTimeoutMs: 500
  } as const
}

function keyOf(area: ProtocolReadRequest['area'], address: number, quantity: number): string {
  return `${area}:${address}:${quantity}`
}

function createLogger(): Logger {
  return {
    write: vi.fn()
  }
}
