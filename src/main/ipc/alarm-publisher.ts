import type { WebContents } from 'electron'

import type { AlarmChangedEvent } from '../../shared/alarm'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { AlarmEngine } from '../alarm'
import type { Logger } from '../logging/logger'

export class AlarmIpcPublisher {
  private readonly subscribers = new Map<number, WebContents>()
  private readonly unsubscribe: () => void

  constructor(
    alarmEngine: AlarmEngine,
    private readonly logger: Logger
  ) {
    this.unsubscribe = alarmEngine.subscribe((event) => this.send(event))
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
    this.unsubscribe()
    this.subscribers.clear()
  }

  private send(event: AlarmChangedEvent): void {
    if (this.subscribers.size === 0) {
      return
    }

    for (const [id, webContents] of this.subscribers) {
      if (webContents.isDestroyed()) {
        this.subscribers.delete(id)
        continue
      }

      webContents.send(IPC_CHANNELS.alarms.changed, event)
    }

    this.logger.write({
      category: 'communication',
      level: 'debug',
      message: 'Published alarm IPC event',
      source: 'main:alarm-ipc-publisher',
      context: {
        occurrenceCount: event.occurrences.length,
        subscriberCount: this.subscribers.size
      }
    })
  }
}
