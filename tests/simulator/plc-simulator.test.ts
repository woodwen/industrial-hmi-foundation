import { createServer, type AddressInfo } from 'node:net'
import { describe, expect, it, vi } from 'vitest'

import type { Logger } from '../../src/main/logging/logger'
import { DEVICE_ERROR_CODES } from '../../src/main/protocol/errors'
import { ModbusAdapter } from '../../src/main/protocol/modbus/ModbusAdapter'
import { ModbusException, ModbusMemoryMap, MODBUS_EXCEPTION } from '../../src/simulator/memory-map'
import { PlcSimulator } from '../../src/simulator/plc-simulator'
import { ProcessModel } from '../../src/simulator/process-model'

describe('PLC Simulator process model', () => {
  it('moves temperature, level, RPM, pressure, and production count when commands are enabled', () => {
    const memoryMap = new ModbusMemoryMap()
    const processModel = new ProcessModel(memoryMap)
    const initial = memoryMap.getProcessValues()

    memoryMap.writeCoils(0, [true])
    memoryMap.writeCoils(2, [true])
    memoryMap.writeHoldingRegisters(0, [650])

    for (let index = 0; index < 8; index += 1) {
      processModel.tick(1000)
    }

    const next = memoryMap.getProcessValues()

    expect(next.currentTemperature).toBeGreaterThan(initial.currentTemperature)
    expect(next.currentLevel).toBeGreaterThan(initial.currentLevel)
    expect(next.motorRpm).toBeGreaterThan(0)
    expect(next.currentPressure).toBeGreaterThan(initial.currentPressure)
    expect(next.productionCount).toBeGreaterThan(initial.productionCount)
    expect(memoryMap.readBooleans('discreteInput', 0, 1)).toEqual([true])
  })

  it('applies outlet valve effects and clamps level within bounds', () => {
    const memoryMap = new ModbusMemoryMap()
    const processModel = new ProcessModel(memoryMap)

    memoryMap.writeCoils(3, [true])

    for (let index = 0; index < 20; index += 1) {
      processModel.tick(1000)
    }

    expect(memoryMap.getProcessValues().currentLevel).toBeGreaterThanOrEqual(0)
    expect(memoryMap.getProcessValues().currentLevel).toBeLessThan(40)
  })

  it('rejects illegal addresses and illegal holding register writes', () => {
    const memoryMap = new ModbusMemoryMap()

    expect(() => memoryMap.readRegisters('inputRegister', 99, 1)).toThrowError(ModbusException)
    expect(() => memoryMap.writeCoils(99, [true])).toThrowError(ModbusException)

    try {
      memoryMap.writeHoldingRegisters(0, [910])
    } catch (error) {
      expect(error).toMatchObject({
        exceptionCode: MODBUS_EXCEPTION.illegalDataValue
      })
      return
    }

    throw new Error('Expected invalid target temperature to be rejected.')
  })

  it('does not partially apply multi-point writes when validation fails', () => {
    const memoryMap = new ModbusMemoryMap()

    expect(() => memoryMap.writeCoils(4, [true, true])).toThrowError(ModbusException)
    expect(memoryMap.readBooleans('coil', 4, 1)).toEqual([false])

    expect(() => memoryMap.writeHoldingRegisters(1, [1200, 1])).toThrowError(ModbusException)
    expect(memoryMap.readRegisters('holdingRegister', 1, 1)).toEqual([0])
  })

  it('injects response delay, write failure, and network errors without using business registers', async () => {
    const port = await getAvailablePort()
    const simulator = new PlcSimulator({
      host: '127.0.0.1',
      port,
      unitId: 1,
      tickMs: 50
    })
    const adapter = new ModbusAdapter(createLogger())

    try {
      await simulator.start()
      await connectAdapter(adapter, port, 60)

      simulator.setResponseDelay(120)
      await expect(adapter.read({
        area: 'holdingRegister',
        address: 0,
        quantity: 1,
        timeoutMs: 50
      })).rejects.toMatchObject({
        code: DEVICE_ERROR_CODES.requestTimeout
      })

      await adapter.disconnect()
      simulator.clearResponseDelay()
      await connectAdapter(adapter, port)
      simulator.failNextWrite()

      await expect(adapter.write({
        area: 'holdingRegister',
        address: 0,
        values: [650]
      })).rejects.toMatchObject({
        code: DEVICE_ERROR_CODES.protocolError
      })
      expect(simulator.getStatus().writeFailureMode).toBe('off')

      await adapter.disconnect()
      await connectAdapter(adapter, port)
      simulator.triggerNetworkError()
      await waitFor(() => adapter.getStatus().connectionStatus === 'Fault')

      expect(adapter.getStatus().lastError).toMatchObject({
        code: DEVICE_ERROR_CODES.connectionLost
      })
    } finally {
      await adapter.disconnect()
      await simulator.stop()
    }
  })
})

describe('PLC Simulator fault control', () => {
  it('disconnects and recovers the TCP server while preserving memory state', async () => {
    const port = await getAvailablePort()
    const simulator = new PlcSimulator({
      host: '127.0.0.1',
      port,
      unitId: 1,
      tickMs: 50
    })

    try {
      await simulator.start()
      simulator.memoryMap.writeHoldingRegisters(0, [650])

      await simulator.disconnect()
      expect(simulator.getStatus()).toMatchObject({
        listening: false,
        faulted: true
      })

      await simulator.recover()

      expect(simulator.getStatus()).toMatchObject({
        listening: true,
        faulted: false
      })
      expect(simulator.memoryMap.getProcessValues().targetTemperature).toBe(65)
    } finally {
      await simulator.stop()
    }
  })
})

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()

    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Unable to allocate a TCP port for test.'))
        return
      }

      server.close(() => {
        resolve((address as AddressInfo).port)
      })
    })
  })
}

async function connectAdapter(adapter: ModbusAdapter, port: number, requestTimeoutMs = 500): Promise<void> {
  await adapter.connect({
    deviceId: 'simulated-mixer-plc',
    host: '127.0.0.1',
    port,
    unitId: 1,
    connectTimeoutMs: 500,
    requestTimeoutMs
  })
}

async function waitFor(predicate: () => boolean, timeoutMs = 1500): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 25)
    })
  }

  throw new Error('Timed out waiting for condition.')
}

function createLogger(): Logger {
  return {
    write: vi.fn()
  }
}
