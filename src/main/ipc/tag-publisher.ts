import type { WebContents } from 'electron'

import { SIMULATED_MIXER_DEVICE_ID } from '../../shared/modbus'
import type { TagValue, TagValuesChangedEvent } from '../../shared/tag'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { Logger } from '../logging/logger'
import type { TagCache } from '../tag'

export const TAG_IPC_THROTTLE_MS = 250
export const TAG_IPC_HEARTBEAT_MS = 2000

export class TagIpcPublisher {
  private readonly subscribers = new Map<number, WebContents>()
  private readonly pendingValues = new Map<string, TagValue>()
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private readonly unsubscribeCache: () => void
  private readonly heartbeatTimer: ReturnType<typeof setInterval>

  constructor(
    private readonly tagCache: TagCache,
    private readonly logger: Logger,
    private readonly deviceId = SIMULATED_MIXER_DEVICE_ID
  ) {
    this.unsubscribeCache = tagCache.subscribe((values) => this.enqueue(values))
    this.heartbeatTimer = setInterval(() => {
      this.sendValues(this.tagCache.getValuesByDevice(this.deviceId))
    }, TAG_IPC_HEARTBEAT_MS)
  }

  addSubscriber(webContents: WebContents): void {
    this.subscribers.set(webContents.id, webContents)
    webContents.once('destroyed', () => {
      this.removeSubscriber(webContents.id)
    })
  }

  removeSubscriber(webContentsId: number): void {
    this.subscribers.delete(webContentsId)
  }

  dispose(): void {
    this.unsubscribeCache()
    this.subscribers.clear()
    this.pendingValues.clear()
    clearInterval(this.heartbeatTimer)
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
  }

  private enqueue(values: readonly TagValue[]): void {
    for (const value of values) {
      this.pendingValues.set(value.tagId, { ...value })
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), TAG_IPC_THROTTLE_MS)
    }
  }

  private flush(): void {
    this.flushTimer = null
    const values = Array.from(this.pendingValues.values())
    this.pendingValues.clear()
    this.sendValues(values)
  }

  private sendValues(values: readonly TagValue[]): void {
    if (values.length === 0 || this.subscribers.size === 0) {
      return
    }

    const event: TagValuesChangedEvent = {
      deviceId: this.deviceId,
      values: values.map((value) => ({ ...value })),
      emittedAt: new Date().toISOString()
    }

    for (const [id, webContents] of this.subscribers) {
      if (webContents.isDestroyed()) {
        this.subscribers.delete(id)
        continue
      }

      webContents.send(IPC_CHANNELS.tags.valuesChanged, event)
    }

    this.logger.write({
      category: 'communication',
      level: 'debug',
      message: 'Published Tag IPC batch',
      source: 'main:tag-ipc-publisher',
      context: {
        deviceId: this.deviceId,
        tagCount: values.length,
        subscriberCount: this.subscribers.size
      }
    })
  }
}
