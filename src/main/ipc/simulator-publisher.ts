import type { WebContents } from 'electron'

import type { SimulatorStatusChangedEvent } from '../../shared/simulator'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { Logger } from '../logging/logger'
import type { SimulatorManager } from '../simulator'

export class SimulatorIpcPublisher {
  private readonly subscribers = new Map<number, WebContents>()
  private readonly unsubscribeStatus: () => void

  constructor(
    simulatorManager: SimulatorManager,
    private readonly logger: Logger
  ) {
    this.unsubscribeStatus = simulatorManager.subscribe((event) => this.sendStatus(event))
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
    this.unsubscribeStatus()
    this.subscribers.clear()
  }

  private sendStatus(event: SimulatorStatusChangedEvent): void {
    if (this.subscribers.size === 0) {
      return
    }

    for (const [id, webContents] of this.subscribers) {
      if (webContents.isDestroyed()) {
        this.subscribers.delete(id)
        continue
      }

      webContents.send(IPC_CHANNELS.simulators.statusChanged, event)
    }

    this.logger.write({
      category: 'communication',
      level: 'debug',
      message: 'Published simulator status IPC event',
      source: 'main:simulator-publisher',
      context: {
        kind: event.changed.kind,
        status: event.changed.status,
        subscriberCount: this.subscribers.size
      }
    })
  }
}
