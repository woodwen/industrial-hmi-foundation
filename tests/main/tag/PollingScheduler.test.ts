import { describe, expect, it, vi } from 'vitest'

import { PollingScheduler, TagCache, TagService } from '../../../src/main/tag'
import type { Logger } from '../../../src/main/logging/logger'
import type {
  IProtocolAdapter,
  ProtocolAdapterStatus,
  ProtocolReadRequest,
  ProtocolReadResult,
  ProtocolWriteRequest,
  ProtocolWriteResult
} from '../../../src/main/protocol/types'
import { DEFAULT_TAG_DEFINITIONS } from '../../../src/shared/tag'

describe('PollingScheduler', () => {
  it('creates bounded timers by device and scan rate rather than one timer per Tag', () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(global, 'setInterval')
    const scheduler = createScheduler(new FakeProtocolAdapter())

    scheduler.start('simulated-mixer-plc')

    expect(setIntervalSpy).toHaveBeenCalledTimes(2)
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 500)
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000)
    expect(setIntervalSpy).not.toHaveBeenCalledTimes(DEFAULT_TAG_DEFINITIONS.length)

    scheduler.dispose()
    setIntervalSpy.mockRestore()
    vi.useRealTimers()
  })

  it('reads scan groups as ranges and writes decoded values to TagCache', async () => {
    const adapter = new FakeProtocolAdapter()
    const tagService = new TagService(undefined, createLogger())
    const tagCache = new TagCache(tagService.listTagDefinitions())
    const logger = createLogger()
    const scheduler = new PollingScheduler({
      adapter,
      tagService,
      tagCache,
      logger
    })

    scheduler.start('simulated-mixer-plc')
    await flushPromises()
    scheduler.dispose()

    expect(adapter.readRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({
        area: 'inputRegister',
        address: 0,
        quantity: 4
      })
    ]))
    expect(tagCache.getValue('currentTemperature')).toMatchObject({
      value: 25.5,
      quality: 'Good'
    })
    expect(logger.write).toHaveBeenCalledWith(expect.objectContaining({
      category: 'communication',
      message: 'Configured Tag scan group'
    }))
  })

  it('marks all device Tags as Bad and stops polling when a read fails', async () => {
    const adapter = new FakeProtocolAdapter()
    adapter.failReads = true
    const tagService = new TagService(undefined, createLogger())
    const tagCache = new TagCache(tagService.listTagDefinitions())
    const scheduler = new PollingScheduler({
      adapter,
      tagService,
      tagCache,
      logger: createLogger()
    })

    scheduler.start('simulated-mixer-plc')
    await flushPromises()
    scheduler.dispose()

    expect(tagCache.getValue('currentTemperature')).toMatchObject({
      quality: 'Bad'
    })
    expect(tagCache.getValue('targetTemperature')).toMatchObject({
      quality: 'Bad'
    })
  })

  it('does not let in-flight reads update TagCache after polling is stopped', async () => {
    const adapter = new DeferredProtocolAdapter()
    const tagService = new TagService([
      DEFAULT_TAG_DEFINITIONS.find((definition) => definition.id === 'currentTemperature')!
    ], createLogger())
    const tagCache = new TagCache(tagService.listTagDefinitions())
    const scheduler = new PollingScheduler({
      adapter,
      tagService,
      tagCache,
      logger: createLogger()
    })

    scheduler.start('simulated-mixer-plc')
    expect(adapter.readRequests).toHaveLength(1)

    scheduler.stop('simulated-mixer-plc')
    tagCache.markDeviceQuality('simulated-mixer-plc', 'Uncertain', '2026-08-18T00:00:01.000Z')
    adapter.resolveRead([255])
    await flushPromises()
    scheduler.dispose()

    expect(tagCache.getValue('currentTemperature')).toMatchObject({
      value: null,
      quality: 'Uncertain',
      timestamp: '2026-08-18T00:00:01.000Z'
    })
  })
})

class FakeProtocolAdapter implements IProtocolAdapter {
  readRequests: ProtocolReadRequest[] = []
  failReads = false
  status: ProtocolAdapterStatus = {
    connectionStatus: 'Connected'
  }

  async connect(): Promise<void> {
    this.status.connectionStatus = 'Connected'
  }

  async disconnect(): Promise<void> {
    this.status.connectionStatus = 'Disconnected'
  }

  async read(request: ProtocolReadRequest): Promise<ProtocolReadResult> {
    this.readRequests.push(request)
    if (this.failReads) {
      throw new Error('simulated read failure')
    }

    return {
      area: request.area,
      address: request.address,
      quantity: request.quantity,
      values: createValues(request)
    }
  }

  async write(request: ProtocolWriteRequest): Promise<ProtocolWriteResult> {
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

class DeferredProtocolAdapter extends FakeProtocolAdapter {
  private readResolver: ((result: ProtocolReadResult) => void) | null = null

  override read(request: ProtocolReadRequest): Promise<ProtocolReadResult> {
    this.readRequests.push(request)
    return new Promise((resolve) => {
      this.readResolver = resolve
    })
  }

  resolveRead(values: ProtocolReadResult['values']): void {
    const request = this.readRequests.at(-1)
    if (!request || !this.readResolver) {
      throw new Error('No pending deferred read exists.')
    }

    this.readResolver({
      area: request.area,
      address: request.address,
      quantity: request.quantity,
      values
    })
    this.readResolver = null
  }
}

function createValues(request: ProtocolReadRequest) {
  if (request.area === 'inputRegister' && request.address === 0 && request.quantity === 4) {
    return [255, 412, 12, 900]
  }

  if (request.area === 'inputRegister' && request.address === 4 && request.quantity === 2) {
    return [0, 12]
  }

  if (request.area === 'holdingRegister') {
    return [600, 0]
  }

  if (request.area === 'discreteInput') {
    return [true]
  }

  return [0]
}

function createScheduler(adapter: IProtocolAdapter): PollingScheduler {
  const tagService = new TagService(undefined, createLogger())
  return new PollingScheduler({
    adapter,
    tagService,
    tagCache: new TagCache(tagService.listTagDefinitions()),
    logger: createLogger()
  })
}

function createLogger(): Logger {
  return {
    write: vi.fn()
  }
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}
