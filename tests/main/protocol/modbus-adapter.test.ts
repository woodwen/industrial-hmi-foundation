import { createServer, type AddressInfo, type Server, type Socket } from 'node:net'
import { describe, expect, it, vi } from 'vitest'

import type { Logger } from '../../../src/main/logging/logger'
import { DEVICE_ERROR_CODES } from '../../../src/main/protocol/errors'
import { ModbusAdapter } from '../../../src/main/protocol/modbus/ModbusAdapter'
import type { ProtocolConnectionConfig } from '../../../src/main/protocol/types'
import { PlcSimulator } from '../../../src/simulator/plc-simulator'

describe('ModbusAdapter', () => {
  it('connects to the simulator, reads process values, writes holding registers, and controls coils', async () => {
    const port = await getAvailablePort()
    const simulator = new PlcSimulator(createSimulatorConfig(port))
    const logger = createLogger()
    const adapter = new ModbusAdapter(logger)

    try {
      await simulator.start()
      await adapter.connect(createConnectionConfig(port))

      const inputRegisters = await adapter.read({
        area: 'inputRegister',
        address: 0,
        quantity: 4
      })
      expect(inputRegisters.values).toHaveLength(4)

      await adapter.write({
        area: 'holdingRegister',
        address: 0,
        values: [625]
      })
      await adapter.write({
        area: 'coil',
        address: 0,
        values: [true]
      })

      await expect(adapter.read({
        area: 'holdingRegister',
        address: 0,
        quantity: 1
      })).resolves.toMatchObject({
        values: [625]
      })
      await expect(adapter.read({
        area: 'coil',
        address: 0,
        quantity: 1
      })).resolves.toMatchObject({
        values: [true]
      })
      expect(adapter.getStatus().connectionStatus).toBe('Connected')
      expect(logger.write).toHaveBeenCalledWith(expect.objectContaining({
        category: 'communication',
        level: 'debug',
        message: 'Read Modbus TCP values'
      }))
      expect(logger.write).toHaveBeenCalledWith(expect.objectContaining({
        category: 'communication',
        context: expect.objectContaining({
          deviceId: 'simulated-mixer-plc'
        })
      }))
    } finally {
      await adapter.disconnect()
      await simulator.stop()
    }
  })

  it('maps illegal addresses to application errors without exposing Modbus library details', async () => {
    const port = await getAvailablePort()
    const simulator = new PlcSimulator(createSimulatorConfig(port))
    const adapter = new ModbusAdapter(createLogger())

    try {
      await simulator.start()
      await adapter.connect(createConnectionConfig(port))

      await expect(adapter.read({
        area: 'inputRegister',
        address: 99,
        quantity: 1
      })).rejects.toMatchObject({
        code: DEVICE_ERROR_CODES.illegalAddress
      })
    } finally {
      await adapter.disconnect()
      await simulator.stop()
    }
  })

  it('moves to fault on simulator disconnect and supports manual reconnect after recover', async () => {
    const port = await getAvailablePort()
    const simulator = new PlcSimulator(createSimulatorConfig(port))
    const adapter = new ModbusAdapter(createLogger())

    try {
      await simulator.start()
      await adapter.connect(createConnectionConfig(port))
      await simulator.disconnect()
      await waitForSocketClose()

      expect(adapter.getStatus().connectionStatus).toBe('Fault')
      await expect(adapter.read({
        area: 'inputRegister',
        address: 0,
        quantity: 1
      })).rejects.toMatchObject({
        code: DEVICE_ERROR_CODES.connectionLost
      })

      await simulator.recover()
      await adapter.connect(createConnectionConfig(port))

      expect(adapter.getStatus().connectionStatus).toBe('Connected')
    } finally {
      await adapter.disconnect()
      await simulator.stop()
    }
  })

  it('maps request timeouts to a unified device error and fault status', async () => {
    const { port, server, sockets } = await startHangingServer()
    const adapter = new ModbusAdapter(createLogger())

    try {
      await adapter.connect({
        ...createConnectionConfig(port),
        requestTimeoutMs: 30
      })

      await expect(adapter.read({
        area: 'inputRegister',
        address: 0,
        quantity: 1
      })).rejects.toMatchObject({
        code: DEVICE_ERROR_CODES.requestTimeout
      })
      expect(adapter.getStatus()).toMatchObject({
        connectionStatus: 'Fault',
        lastError: {
          code: DEVICE_ERROR_CODES.requestTimeout
        }
      })
    } finally {
      await adapter.disconnect()
      for (const socket of sockets) {
        socket.destroy()
      }
      await closeServer(server)
    }
  })

  it('maps TCP connection failures to a unified device error', async () => {
    const port = await getAvailablePort()
    const adapter = new ModbusAdapter(createLogger())

    await expect(adapter.connect(createConnectionConfig(port))).rejects.toMatchObject({
      code: DEVICE_ERROR_CODES.connectionFailed
    })
    expect(adapter.getStatus().connectionStatus).toBe('Disconnected')
  })
})

function createConnectionConfig(port: number): ProtocolConnectionConfig {
  return {
    deviceId: 'simulated-mixer-plc',
    host: '127.0.0.1',
    port,
    unitId: 1,
    connectTimeoutMs: 500,
    requestTimeoutMs: 500
  }
}

function createSimulatorConfig(port: number) {
  return {
    host: '127.0.0.1',
    port,
    unitId: 1,
    tickMs: 50
  }
}

function createLogger(): Logger {
  return {
    write: vi.fn()
  }
}

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
        resolve(address.port)
      })
    })
  })
}

function startHangingServer(): Promise<{
  port: number
  server: Server
  sockets: Set<Socket>
}> {
  const server = createServer()
  const sockets = new Set<Socket>()

  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => {
      sockets.delete(socket)
    })
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to allocate a TCP port for hanging server test.'))
        return
      }

      resolve({
        port: (address as AddressInfo).port,
        server,
        sockets
      })
    })
  })
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

function waitForSocketClose(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 20)
  })
}
