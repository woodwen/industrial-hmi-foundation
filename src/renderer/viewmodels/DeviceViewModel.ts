import { makeAutoObservable } from 'mobx'

export class DeviceViewModel {
  description = 'Device management frame for future industrial communication adapters.'
  connectionStateLabel = 'No device connections configured'
  emptyStateMessage = 'Modbus TCP, OPC UA, and simulator connections are intentionally not implemented in this change.'

  constructor() {
    makeAutoObservable(this)
  }
}
