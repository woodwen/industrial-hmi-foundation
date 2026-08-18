import type { WebContents } from 'electron'

import type { RealtimeTrendChangedEvent } from '../../shared/trend'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { TrendService } from '../historian'
import type { Logger } from '../logging/logger'

interface TrendSubscriber {
  webContents: WebContents
  tagIds: readonly string[]
}

export class TrendIpcPublisher {
  private readonly subscribers = new Map<number, TrendSubscriber>()
  private readonly unsubscribe: () => void

  constructor(
    trendService: TrendService,
    private readonly logger: Logger
  ) {
    this.unsubscribe = trendService.subscribe((event) => this.send(event))
  }

  addSubscriber(webContents: WebContents, tagIds: readonly string[]): void {
    this.subscribers.set(webContents.id, {
      webContents,
      tagIds: [...tagIds]
    })
    webContents.once('destroyed', () => {
      this.removeSubscriber(webContents.id)
    })
  }

  removeSubscriber(webContentsId: number): void {
    this.subscribers.delete(webContentsId)
  }

  dispose(): void {
    this.unsubscribe()
    this.subscribers.clear()
  }

  private send(event: RealtimeTrendChangedEvent): void {
    if (this.subscribers.size === 0) {
      return
    }

    for (const [id, subscriber] of this.subscribers) {
      if (subscriber.webContents.isDestroyed()) {
        this.subscribers.delete(id)
        continue
      }

      const tagIds = new Set(subscriber.tagIds)
      const points = event.points.filter((point) => tagIds.has(point.tagId))
      if (points.length === 0) {
        continue
      }

      subscriber.webContents.send(IPC_CHANNELS.trends.realtimeChanged, {
        points,
        emittedAt: event.emittedAt
      } satisfies RealtimeTrendChangedEvent)
    }

    this.logger.write({
      category: 'communication',
      level: 'debug',
      message: 'Published realtime trend IPC event',
      source: 'main:trend-ipc-publisher',
      context: {
        pointCount: event.points.length,
        subscriberCount: this.subscribers.size
      }
    })
  }
}
