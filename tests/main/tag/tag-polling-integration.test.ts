import { createServer, type AddressInfo } from 'node:net'
import { describe, expect, it, vi } from 'vitest'

import { DeviceManager, DeviceOperationGate } from '../../../src/main/device'
import type { Logger } from '../../../src/main/logging/logger'
import { ModbusAdapter } from '../../../src/main/protocol/modbus/ModbusAdapter'
import { PollingScheduler, TagCache, TagService } from '../../../src/main/tag'
import type { TagDefinition } from '../../../src/shared/tag'
import { PlcSimulator } from '../../../src/simulator/plc-simulator'

describe('Tag polling integration', () => {
  it('polls Simulator values into TagCache and degrades quality after Simulator stops', async () => {
    const port = await getAvailablePort()
    const simulator = new PlcSimulator({
      host: '127.0.0.1',
      port,
      unitId: 1,
      tickMs: 50
    })
    const logger = createLogger()
    const adapter = new ModbusAdapter(logger)
    const tagService = new TagService(createFastDefinitions(), logger)
    const tagCache = new TagCache(tagService.listTagDefinitions())
    const scheduler = new PollingScheduler({
      adapter,
      tagService,
      tagCache,
      logger
    })

    try {
      await simulator.start()
      await adapter.connect({
        deviceId: 'simulated-mixer-plc',
        host: '127.0.0.1',
        port,
        unitId: 1,
        connectTimeoutMs: 500,
        requestTimeoutMs: 500
      })

      scheduler.start('simulated-mixer-plc')
      await waitFor(() => tagCache.getValue('currentTemperature')?.quality === 'Good')

      expect(tagCache.getValue('currentTemperature')).toMatchObject({
        value: 25,
        quality: 'Good'
      })

      await simulator.stop()
      await waitFor(() => tagCache.getValue('currentTemperature')?.quality === 'Bad')

      expect(tagCache.getValue('currentTemperature')).toMatchObject({
        quality: 'Bad'
      })
    } finally {
      scheduler.dispose()
      await adapter.disconnect()
      await simulator.stop()
    }
  })

  it('reconnects after Simulator disconnect and restores Tag Quality after a fresh sample', async () => {
    const port = await getAvailablePort()
    const simulator = new PlcSimulator({
      host: '127.0.0.1',
      port,
      unitId: 1,
      tickMs: 50
    })
    const logger = createLogger()
    const adapter = new ModbusAdapter(logger)
    const operationGate = new DeviceOperationGate()
    const tagService = new TagService(createFastDefinitions(), logger)
    const tagCache = new TagCache(tagService.listTagDefinitions())
    const schedulerRef: {
      current?: PollingScheduler
    } = {}
    const manager = new DeviceManager({
      adapter,
      logger,
      operationGate,
      connectionConfig: {
        deviceId: 'simulated-mixer-plc',
        host: '127.0.0.1',
        port,
        unitId: 1,
        connectTimeoutMs: 100,
        requestTimeoutMs: 100
      },
      reconnectBackoffMs: [50],
      lifecycle: {
        onConnected: (deviceId) => {
          schedulerRef.current?.start(deviceId)
        },
        onReconnecting: (deviceId) => {
          schedulerRef.current?.stop(deviceId)
          tagCache.markDeviceQuality(deviceId, 'Bad')
        },
        onDisconnected: (deviceId, manual) => {
          schedulerRef.current?.stop(deviceId)
          tagCache.markDeviceQuality(deviceId, manual ? 'Uncertain' : 'Bad')
        },
        onFault: (deviceId) => {
          schedulerRef.current?.stop(deviceId)
          tagCache.markDeviceQuality(deviceId, 'Bad')
        }
      }
    })
    const scheduler = new PollingScheduler({
      adapter,
      tagService,
      tagCache,
      logger,
      operationGate,
      onDeviceCommunicationFailure: (_deviceId, error) => {
        manager.handleCommunicationFailure(error)
      }
    })
    schedulerRef.current = scheduler

    try {
      await simulator.start()
      await manager.connectDevice()
      await waitFor(() => tagCache.getValue('currentTemperature')?.quality === 'Good')

      await simulator.disconnect()
      await waitFor(() => manager.getDeviceStatus().connectionStatus === 'Reconnecting')
      await waitFor(() => tagCache.getValue('currentTemperature')?.quality === 'Bad')

      await simulator.recover()
      await waitFor(() => manager.getDeviceStatus().connectionStatus === 'Connected', 3000)
      await waitFor(() => tagCache.getValue('currentTemperature')?.quality === 'Good', 3000)

      expect(manager.getDeviceStatus().connectionStatus).toBe('Connected')
      expect(tagCache.getValue('currentTemperature')).toMatchObject({
        quality: 'Good'
      })
    } finally {
      scheduler.dispose()
      manager.dispose()
      operationGate.dispose()
      await adapter.disconnect()
      await simulator.stop()
    }
  })
})

function createFastDefinitions(): TagDefinition[] {
  return new TagService().listTagDefinitions().map((definition) => ({
    ...definition,
    scanRate: 100
  }))
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
        resolve((address as AddressInfo).port)
      })
    })
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
