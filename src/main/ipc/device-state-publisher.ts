import type { WebContents } from 'electron'

import type { DeviceStateChangedEvent } from '../../shared/hmi-api'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { DeviceManager } from '../device'
import type { Logger } from '../logging/logger'

export class DeviceStateIpcPublisher {
  private readonly subscribers = new Map<number, WebContents>()
  private readonly unsubscribeState: () => void

  constructor(
    private readonly deviceManager: DeviceManager,
    private readonly logger: Logger
  ) {
    this.unsubscribeState = deviceManager.subscribeState((event) => this.sendState(event))
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
    this.unsubscribeState()
    this.subscribers.clear()
  }

  private sendState(event: DeviceStateChangedEvent): void {
    if (this.subscribers.size === 0) {
      return
    }

    for (const [id, webContents] of this.subscribers) {
      if (webContents.isDestroyed()) {
        this.subscribers.delete(id)
        continue
      }

      webContents.send(IPC_CHANNELS.devices.stateChanged, event)
    }

    this.logger.write({
      category: 'communication',
      level: 'debug',
      message: 'Published device state IPC event',
      source: 'main:device-state-publisher',
      context: {
        deviceId: event.deviceId,
        state: event.connectionStatus,
        subscriberCount: this.subscribers.size
      }
    })
  }
}
