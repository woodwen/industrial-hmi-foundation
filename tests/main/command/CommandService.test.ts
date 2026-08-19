import { afterEach, describe, expect, it, vi } from 'vitest'

import { CommandService } from '../../../src/main/command'
import { DeviceManager, DeviceOperationGate } from '../../../src/main/device'
import type { Logger } from '../../../src/main/logging/logger'
import { DEVICE_ERROR_CODES } from '../../../src/main/protocol/errors'
import type { AppErrorShape } from '../../../src/shared/app-error'
import type {
  IProtocolAdapter,
  ProtocolAdapterStatus,
  ProtocolConnectionConfig,
  ProtocolReadRequest,
  ProtocolReadResult,
  ProtocolWriteRequest,
  ProtocolWriteResult
} from '../../../src/main/protocol/types'
import { SIMULATED_MIXER_DEVICE_ID, type ModbusRawValue } from '../../../src/shared/modbus'

describe('CommandService', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('verifies Target Temperature with holding-register read-back tolerance', async () => {
    const { service, adapter } = await createConnectedService()

    const result = await service.executeCommand({
      commandId: 'setTargetTemperature',
      value: 62.55
    })

    expect(result).toMatchObject({
      status: 'succeeded',
      writeAccepted: true,
      verificationStatus: 'verified',
      targetPointId: 'targetTemperature',
      point: {
        value: 62.5,
        rawValues: [625]
      }
    })
    expect(adapter.writeRequests).toEqual([
      expect.objectContaining({
        area: 'holdingRegister',
        address: 0,
        values: [625]
      })
    ])
  })

  it('verifies RPM Setpoint by exact integer read-back', async () => {
    const { service } = await createConnectedService()

    const result = await service.executeCommand({
      commandId: 'setRpmSetpoint',
      value: 900
    })

    expect(result).toMatchObject({
      status: 'succeeded',
      verificationStatus: 'verified',
      point: {
        pointId: 'manualMotorRpmSetpoint',
        value: 900
      }
    })
  })

  it('verifies boolean Start command against device running feedback', async () => {
    const { service } = await createConnectedService()

    const result = await service.executeCommand({
      commandId: 'start'
    })

    expect(result).toMatchObject({
      commandId: 'start',
      status: 'succeeded',
      writeAccepted: true,
      verificationStatus: 'verified'
    })
  })

  it('rejects commands while the device is reconnecting', async () => {
    const { service, manager } = await createConnectedService()
    manager.handleCommunicationFailure(new Error('socket closed'))

    const result = await service.executeCommand({
      commandId: 'start'
    })

    expect(result).toMatchObject({
      status: 'rejected',
      writeAccepted: false,
      error: {
        code: DEVICE_ERROR_CODES.commandRejected
      }
    })
  })

  it('rejects read-only, malformed, and out-of-range legacy write requests', async () => {
    const { service } = await createConnectedService()

    await expect(service.writeDeviceRegisters({
      pointId: 'currentTemperature',
      value: 60
    })).rejects.toMatchObject({
      code: DEVICE_ERROR_CODES.commandRejected
    })

    await expect(service.writeDeviceRegisters({
      pointId: 'deviceStartCommand',
      value: 1
    })).rejects.toMatchObject({
      code: DEVICE_ERROR_CODES.commandRejected
    })

    await expect(service.writeDeviceRegisters({
      pointId: 'targetTemperature',
      value: 120
    })).rejects.toMatchObject({
      code: DEVICE_ERROR_CODES.commandRejected
    })

    await expect(service.writeDeviceRegisters({
      pointId: 'manualMotorRpmSetpoint',
      value: 2000
    })).rejects.toMatchObject({
      code: DEVICE_ERROR_CODES.commandRejected
    })
  })

  it('returns timeout result without blocking forever when feedback never reaches the target', async () => {
    vi.useFakeTimers()
    let now = 0
    const { service, adapter } = await createConnectedService(() => now)
    adapter.updateFeedback = false

    const promise = service.executeCommand({
      commandId: 'start'
    })

    for (let index = 0; index < 60; index += 1) {
      now += 100
      await vi.advanceTimersByTimeAsync(100)
    }

    await expect(promise).resolves.toMatchObject({
      status: 'timeout',
      writeAccepted: true,
      verificationStatus: 'timeout',
      error: {
        code: DEVICE_ERROR_CODES.commandTimeout
      }
    })
  })

  it('maps write request timeouts to structured command timeout results', async () => {
    const { service, adapter, manager } = await createConnectedService()
    adapter.writeError = {
      code: DEVICE_ERROR_CODES.requestTimeout,
      message: 'Device request timed out.',
      source: 'test'
    }

    const result = await service.executeCommand({
      commandId: 'setTargetTemperature',
      value: 62.5
    })

    expect(result).toMatchObject({
      status: 'timeout',
      writeAccepted: false,
      verificationStatus: 'timeout',
      error: {
        code: DEVICE_ERROR_CODES.commandTimeout
      }
    })
    expect(manager.getDeviceStatus().connectionStatus).toBe('Reconnecting')
  })

  it('maps verification request timeouts to structured command timeout results', async () => {
    const { service, adapter, manager } = await createConnectedService()
    adapter.readError = {
      code: DEVICE_ERROR_CODES.requestTimeout,
      message: 'Device request timed out.',
      source: 'test'
    }

    const result = await service.executeCommand({
      commandId: 'setTargetTemperature',
      value: 62.5
    })

    expect(result).toMatchObject({
      status: 'timeout',
      writeAccepted: true,
      verificationStatus: 'timeout',
      error: {
        code: DEVICE_ERROR_CODES.commandTimeout
      }
    })
    expect(manager.getDeviceStatus().connectionStatus).toBe('Reconnecting')
  })

  it('returns busy instead of queueing a second command for the same device', async () => {
    const { service, gate } = await createConnectedService()
    const releases: Array<() => void> = []
    const heldOperation = gate.runExclusive(SIMULATED_MIXER_DEVICE_ID, () => (
      new Promise<void>((resolve) => {
        releases.push(resolve)
      })
    ))

    const result = await service.executeCommand({
      commandId: 'start'
    })

    expect(result).toMatchObject({
      status: 'busy',
      writeAccepted: false
    })

    releases[0]?.()
    await heldOperation
  })

  it('isolates write failures and reports structured command failure', async () => {
    const { service, adapter, manager } = await createConnectedService()
    adapter.failWrites = true

    const result = await service.executeCommand({
      commandId: 'setTargetTemperature',
      value: 62.5
    })

    expect(result).toMatchObject({
      status: 'failed',
      writeAccepted: false,
      verificationStatus: 'failed',
      error: {
        code: DEVICE_ERROR_CODES.protocolError
      }
    })
    expect(manager.getDeviceStatus().connectionStatus).toBe('Reconnecting')
  })

  it('uses OPC UA bindings for setpoint commands when the device protocol is OPC UA', async () => {
    const adapter = new FakeProtocolAdapter()
    const gate = new DeviceOperationGate()
    const logger = createLogger()
    const manager = new DeviceManager({
      adapter,
      logger,
      operationGate: gate,
      connectionConfig: {
        deviceId: SIMULATED_MIXER_DEVICE_ID,
        protocol: 'opcUa',
        endpointUrl: 'opc.tcp://127.0.0.1:4840/industrial-hmi-simulator',
        securityMode: 'None',
        securityPolicy: 'None',
        anonymous: true,
        connectTimeoutMs: 500,
        requestTimeoutMs: 500
      },
      reconnectBackoffMs: [10000]
    })
    await manager.connectDevice()
    const service = new CommandService({
      adapter,
      deviceManager: manager,
      operationGate: gate,
      logger
    })

    const result = await service.executeCommand({
      commandId: 'setTargetTemperature',
      value: 62.5
    })

    expect(result.status).toBe('succeeded')
    expect(adapter.writeRequests[0]).toMatchObject({
      binding: {
        protocol: 'opcUa',
        nodeId: 'ns=1;s=Setpoint'
      }
    })
  })
})

async function createConnectedService(now?: () => number): Promise<{
  adapter: FakeProtocolAdapter
  gate: DeviceOperationGate
  manager: DeviceManager
  service: CommandService
}> {
  const adapter = new FakeProtocolAdapter()
  const gate = new DeviceOperationGate()
  const logger = createLogger()
  const manager = new DeviceManager({
    adapter,
    logger,
    operationGate: gate,
    reconnectBackoffMs: [10000]
  })
  await manager.connectDevice()
  const service = new CommandService({
    adapter,
    deviceManager: manager,
    operationGate: gate,
    logger,
    now
  })

  return {
    adapter,
    gate,
    manager,
    service
  }
}

class FakeProtocolAdapter implements IProtocolAdapter {
  failWrites = false
  updateFeedback = true
  readError: AppErrorShape | null = null
  writeError: AppErrorShape | null = null
  writeRequests: ProtocolWriteRequest[] = []
  private readonly coils = new Map<number, boolean>([
    [0, false],
    [1, false],
    [2, false],
    [3, false]
  ])
  private readonly discreteInputs = new Map<number, boolean>([
    [0, false],
    [1, false],
    [2, false],
    [3, false]
  ])
  private readonly holdingRegisters = new Map<number, number>([
    [0, 600],
    [1, 0]
  ])
  private status: ProtocolAdapterStatus = {
    connectionStatus: 'Disconnected'
  }

  getCapabilities() {
    return createModbusCapabilities()
  }

  async connect(config: ProtocolConnectionConfig): Promise<void> {
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
    if (this.readError) {
      throw this.readError
    }

    return {
      area: request.area,
      address: request.address,
      quantity: request.quantity,
      values: readValues(request, this.coils, this.discreteInputs, this.holdingRegisters)
    }
  }

  async write(request: ProtocolWriteRequest): Promise<ProtocolWriteResult> {
    this.writeRequests.push(request)
    if (this.writeError) {
      throw this.writeError
    }

    if (this.failWrites) {
      throw new Error('simulated write failure')
    }

    if (request.area === 'coil') {
      request.values.forEach((value, index) => {
        if (typeof value !== 'boolean') {
          throw new Error('coil write expects boolean')
        }

        const address = request.address + index
        this.coils.set(address, value)
        if (this.updateFeedback) {
          this.discreteInputs.set(address, value)
        }
      })
    }

    if (request.area === 'holdingRegister') {
      request.values.forEach((value, index) => {
        if (typeof value !== 'number') {
          throw new Error('holding register write expects number')
        }

        this.holdingRegisters.set(request.address + index, value)
      })
    }

    return {
      area: request.area,
      address: request.address,
      quantity: request.values.length
    }
  }

  getStatus(): ProtocolAdapterStatus {
    return this.status
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

function readValues(
  request: ProtocolReadRequest,
  coils: ReadonlyMap<number, boolean>,
  discreteInputs: ReadonlyMap<number, boolean>,
  holdingRegisters: ReadonlyMap<number, number>
): ModbusRawValue[] {
  return Array.from({ length: request.quantity }, (_, index) => {
    const address = request.address + index

    if (request.area === 'coil') {
      return coils.get(address) ?? false
    }

    if (request.area === 'discreteInput') {
      return discreteInputs.get(address) ?? false
    }

    if (request.area === 'holdingRegister') {
      return holdingRegisters.get(address) ?? 0
    }

    return 0
  })
}

function createLogger(): Logger {
  return {
    write: vi.fn()
  }
}
