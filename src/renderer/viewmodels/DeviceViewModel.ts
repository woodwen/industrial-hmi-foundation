import { makeAutoObservable } from 'mobx'

import type { MessageKey } from '../localization/messages'

export class DeviceViewModel {
  descriptionKey: MessageKey = 'device.description'
  connectionStateKey: MessageKey = 'device.connection.title'
  emptyStateKey: MessageKey = 'device.connection.empty'

  constructor() {
    makeAutoObservable(this)
  }
}
