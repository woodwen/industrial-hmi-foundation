import { AppApplicationService, type HmiApiClient } from '../application/AppApplicationService'
import { HmiApiBrowserClient } from '../infrastructure/HmiApiBrowserClient'
import { AppViewModel } from './AppViewModel'
import { DashboardViewModel } from './DashboardViewModel'
import { DeviceViewModel } from './DeviceViewModel'

export interface RootViewModel {
  app: AppViewModel
  dashboard: DashboardViewModel
  device: DeviceViewModel
}

export function createRootViewModel(apiClient: HmiApiClient = new HmiApiBrowserClient()): RootViewModel {
  const appService = new AppApplicationService(apiClient)

  return {
    app: new AppViewModel(appService),
    dashboard: new DashboardViewModel(),
    device: new DeviceViewModel()
  }
}
