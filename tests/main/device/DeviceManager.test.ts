import { describe, expect, it, vi } from 'vitest'

import { DeviceManager, DEFAULT_SIMULATED_DEVICE_CONFIG } from '../../../src/main/device'
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
import type { ModbusRawValue } from '../../../src/shared/modbus'

describe('DeviceManager', () => {
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

    await expect(manager.writeDeviceRegisters({
      pointId: 'currentTemperature',
      value: 60
    })).rejects.toMatchObject({
      code: DEVICE_ERROR_CODES.writeRejected
    })
    expect(adapter.writeRequests).toEqual([])
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

  it('reports adapter fault state through device status', () => {
    const adapter = new FakeProtocolAdapter()
    const manager = new DeviceManager({
      adapter,
      logger: createLogger()
    })

    adapter.status.connectionStatus = 'Fault'
    adapter.status.lastError = {
      code: DEVICE_ERROR_CODES.connectionLost,
      message: 'Device connection was lost.',
      source: 'test'
    }

    expect(manager.getDeviceStatus()).toMatchObject({
      connectionStatus: 'Fault',
      lastError: {
        code: DEVICE_ERROR_CODES.connectionLost
      }
    })
  })
})

class FakeProtocolAdapter implements IProtocolAdapter {
  status: ProtocolAdapterStatus = {
    connectionStatus: 'Disconnected'
  }
  connectConfig: ProtocolConnectionConfig | null = null
  readRequests: ProtocolReadRequest[] = []
  writeRequests: ProtocolWriteRequest[] = []
  private readonly reads = new Map<string, ModbusRawValue[]>()

  async connect(config: ProtocolConnectionConfig): Promise<void> {
    this.connectConfig = config
    this.status = {
      connectionStatus: 'Connected',
      endpoint: `${config.host}:${config.port}`,
      unitId: config.unitId,
      lastSuccessfulAt: '2026-08-18T00:00:00.000Z'
    }
  }

  async disconnect(): Promise<void> {
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

function keyOf(area: ProtocolReadRequest['area'], address: number, quantity: number): string {
  return `${area}:${address}:${quantity}`
}

function createLogger(): Logger {
  return {
    write: vi.fn()
  }
}
