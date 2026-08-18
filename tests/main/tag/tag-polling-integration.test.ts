import { createServer, type AddressInfo } from 'node:net'
import { describe, expect, it, vi } from 'vitest'

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
