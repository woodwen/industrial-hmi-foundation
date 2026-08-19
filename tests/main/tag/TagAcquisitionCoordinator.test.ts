import { describe, expect, it, vi } from 'vitest'

import { DeviceOperationGate } from '../../../src/main/device'
import { createDeviceError, DEVICE_ERROR_CODES } from '../../../src/main/protocol/errors'
import type {
  IProtocolAdapter,
  ProtocolAdapterStatus,
  ProtocolReadRequest,
  ProtocolReadResult,
  ProtocolSubscriptionFailureListener,
  ProtocolSubscriptionItem,
  ProtocolSubscriptionListener,
  ProtocolWriteRequest,
  ProtocolWriteResult
} from '../../../src/main/protocol/types'
import { PollingScheduler, TagAcquisitionCoordinator, TagCache, TagService } from '../../../src/main/tag'
import type { AppErrorShape } from '../../../src/shared/app-error'
import type { Logger } from '../../../src/main/logging/logger'

describe('TagAcquisitionCoordinator', () => {
  it('reports subscription failures through the device communication lifecycle and cleans up', async () => {
    const adapter = new FakeSubscriptionAdapter()
    const tagService = new TagService(undefined, createLogger())
    const tagCache = new TagCache(tagService.listTagDefinitions())
    const logger = createLogger()
    const operationGate = new DeviceOperationGate()
    const onDeviceCommunicationFailure = vi.fn()
    const pollingScheduler = new PollingScheduler({
      adapter,
      tagService,
      tagCache,
      logger,
      operationGate
    })
    const coordinator = new TagAcquisitionCoordinator({
      adapterProvider: () => adapter,
      pollingScheduler,
      tagService,
      tagCache,
      logger,
      operationGate,
      onDeviceCommunicationFailure
    })

    await coordinator.start('simulated-mixer-plc')

    const error = createDeviceError(
      DEVICE_ERROR_CODES.connectionLost,
      'OPC UA subscription was terminated.',
      'test'
    )
    adapter.emitFailure(error)
    await flushPromises()

    expect(onDeviceCommunicationFailure).toHaveBeenCalledWith('simulated-mixer-plc', error)
    expect(tagCache.getValue('currentTemperature')).toMatchObject({
      quality: 'Bad'
    })
    expect(adapter.disposeSubscription).toHaveBeenCalledTimes(1)
    expect(coordinator.getMetrics()).toMatchObject({
      subscriptionStartCount: 1,
      failureCount: 1
    })
  })
})

class FakeSubscriptionAdapter implements IProtocolAdapter {
  readonly disposeSubscription = vi.fn(async () => undefined)
  private failureListener: ProtocolSubscriptionFailureListener | undefined

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
      requestTimeoutMs: 500
    } as const
  }

  async connect(): Promise<void> {
    return undefined
  }

  async disconnect(): Promise<void> {
    return undefined
  }

  async read(request: ProtocolReadRequest): Promise<ProtocolReadResult> {
    return {
      area: request.area,
      address: request.address,
      quantity: request.quantity,
      values: [0]
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
    return {
      connectionStatus: 'Connected'
    }
  }

  async subscribe(
    _items: readonly ProtocolSubscriptionItem[],
    _listener: ProtocolSubscriptionListener,
    failureListener?: ProtocolSubscriptionFailureListener
  ) {
    this.failureListener = failureListener
    return {
      dispose: this.disposeSubscription
    }
  }

  emitFailure(error: AppErrorShape): void {
    this.failureListener?.(error)
  }
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
