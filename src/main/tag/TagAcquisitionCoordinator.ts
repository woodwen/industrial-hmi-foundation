import type { AppErrorShape } from '../../shared/app-error'
import type { TagValue } from '../../shared/tag'
import type { DeviceOperationGate } from '../device'
import { createOpcUaBinding } from '../protocol/bindings'
import type {
  IProtocolAdapter,
  ProtocolSubscriptionHandle,
  ProtocolSubscriptionItem
} from '../protocol/types'
import type { Logger } from '../logging/logger'
import type { PollingScheduler } from './PollingScheduler'
import type { TagCache } from './TagCache'
import type { TagService } from './TagService'

export interface TagAcquisitionMetrics {
  pollingStartCount: number
  subscriptionStartCount: number
  subscriptionNotificationCount: number
  subscriptionValueCount: number
  tagCacheBatchCount: number
  tagCacheChangedValueCount: number
  failureCount: number
  lastBatchSize: number
  lastDurationMs: number
}

interface TagAcquisitionCoordinatorDependencies {
  adapterProvider: () => IProtocolAdapter
  pollingScheduler: PollingScheduler
  tagService: TagService
  tagCache: TagCache
  logger: Logger
  operationGate?: DeviceOperationGate
  onDeviceCommunicationFailure?: (deviceId: string, error: unknown) => void
}

export class TagAcquisitionCoordinator {
  private readonly subscriptionHandles = new Map<string, ProtocolSubscriptionHandle>()
  private readonly metrics: TagAcquisitionMetrics = {
    pollingStartCount: 0,
    subscriptionStartCount: 0,
    subscriptionNotificationCount: 0,
    subscriptionValueCount: 0,
    tagCacheBatchCount: 0,
    tagCacheChangedValueCount: 0,
    failureCount: 0,
    lastBatchSize: 0,
    lastDurationMs: 0
  }

  constructor(private readonly dependencies: TagAcquisitionCoordinatorDependencies) {}

  async start(deviceId: string): Promise<void> {
    await this.stop(deviceId)
    const adapter = this.dependencies.adapterProvider()
    const capabilities = adapter.getCapabilities()
    const acquisitionMode = capabilities.preferredAcquisition === 'subscription' &&
      capabilities.supportsSubscription &&
      adapter.subscribe
      ? 'subscription'
      : 'polling'

    this.dependencies.logger.write({
      category: 'communication',
      level: 'info',
      message: 'Selected Tag acquisition mode',
      source: 'main:tag-acquisition',
      context: {
        deviceId,
        protocol: capabilities.protocol,
        acquisitionMode
      }
    })

    if (acquisitionMode === 'subscription') {
      await this.startSubscription(deviceId, adapter)
      return
    }

    this.metrics.pollingStartCount += 1
    this.dependencies.pollingScheduler.start(deviceId)
  }

  async stop(deviceId?: string): Promise<void> {
    if (deviceId) {
      this.dependencies.pollingScheduler.stop(deviceId)
      const handle = this.subscriptionHandles.get(deviceId)
      if (handle) {
        this.subscriptionHandles.delete(deviceId)
        await handle.dispose()
      }
      return
    }

    this.dependencies.pollingScheduler.stop()
    const handles = [...this.subscriptionHandles.values()]
    this.subscriptionHandles.clear()
    await Promise.all(handles.map((handle) => handle.dispose()))
  }

  dispose(): void {
    void this.stop()
  }

  getMetrics(): TagAcquisitionMetrics {
    return { ...this.metrics }
  }

  private async startSubscription(deviceId: string, adapter: IProtocolAdapter): Promise<void> {
    const tags = this.dependencies.tagService.getTagsByDevice(deviceId)
    const items: ProtocolSubscriptionItem[] = tags.map((tag) => ({
      tagId: tag.id,
      binding: createOpcUaBinding(tag.sourcePointId, tag.scanRate)
    }))

    try {
      const handle = await this.runThroughGate(deviceId, () => adapter.subscribe?.(items, (values) => {
        const startedAt = Date.now()
        const decoded = this.dependencies.tagService.decodeSubscriptionValues(values)
        const changed = this.dependencies.tagCache.setValues(decoded)
        this.metrics.subscriptionNotificationCount += 1
        this.metrics.subscriptionValueCount += values.length
        this.metrics.tagCacheBatchCount += 1
        this.metrics.tagCacheChangedValueCount += changed.length
        this.metrics.lastBatchSize = values.length
        this.metrics.lastDurationMs = Date.now() - startedAt
      }, (error) => {
        this.handleSubscriptionFailure(deviceId, error)
      }))

      if (!handle) {
        throw {
          code: 'DEVICE_SUBSCRIPTION_UNSUPPORTED',
          message: 'Protocol adapter does not support subscription.',
          source: 'main:tag-acquisition'
        } satisfies AppErrorShape
      }

      this.subscriptionHandles.set(deviceId, handle)
      this.metrics.subscriptionStartCount += 1
      this.dependencies.logger.write({
        category: 'communication',
        level: 'info',
        message: 'Started Tag subscription acquisition',
        source: 'main:tag-acquisition',
        context: {
          deviceId,
          itemCount: items.length
        }
      })
    } catch (error) {
      this.metrics.failureCount += 1
      this.dependencies.tagCache.markDeviceQuality(deviceId, 'Bad')
      this.dependencies.onDeviceCommunicationFailure?.(deviceId, error)
      this.dependencies.logger.write({
        category: 'communication',
        level: 'warn',
        message: 'Failed to start Tag subscription acquisition',
        source: 'main:tag-acquisition',
        context: {
          deviceId,
          error: formatErrorSummary(error)
        }
      })
      throw error
    }
  }

  private runThroughGate<T>(deviceId: string, operation: () => Promise<T> | T): Promise<T> | T {
    return this.dependencies.operationGate
      ? this.dependencies.operationGate.runExclusive(deviceId, async () => operation())
      : operation()
  }

  private handleSubscriptionFailure(deviceId: string, error: unknown): void {
    if (!this.subscriptionHandles.has(deviceId)) {
      return
    }

    this.metrics.failureCount += 1
    this.dependencies.tagCache.markDeviceQuality(deviceId, 'Bad')
    this.dependencies.onDeviceCommunicationFailure?.(deviceId, error)
    this.dependencies.logger.write({
      category: 'communication',
      level: 'warn',
      message: 'Tag subscription acquisition failed',
      source: 'main:tag-acquisition',
      context: {
        deviceId,
        error: formatErrorSummary(error)
      }
    })
    void this.stop(deviceId)
  }
}

function formatErrorSummary(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as Partial<AppErrorShape>
    if (typeof candidate.message === 'string') {
      return candidate.code ? `${candidate.code}: ${candidate.message}` : candidate.message
    }
  }

  return String(error)
}

export function summarizeTagBatch(values: readonly TagValue[]): Record<string, string | number | boolean | null> {
  return {
    valueCount: values.length,
    goodCount: values.filter((value) => value.quality === 'Good').length,
    badCount: values.filter((value) => value.quality === 'Bad').length,
    uncertainCount: values.filter((value) => value.quality === 'Uncertain').length
  }
}
