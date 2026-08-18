import { AppApplicationService, type HmiApiClient } from '../application/AppApplicationService'
import { HmiApiBrowserClient } from '../infrastructure/HmiApiBrowserClient'
import { AppViewModel } from './AppViewModel'
import { AppUpdateViewModel } from './AppUpdateViewModel'
import { DashboardViewModel } from './DashboardViewModel'
import { DeviceViewModel } from './DeviceViewModel'

export interface RootViewModel {
  app: AppViewModel
  updates: AppUpdateViewModel
  dashboard: DashboardViewModel
  device: DeviceViewModel
}

export function createRootViewModel(apiClient: HmiApiClient = new HmiApiBrowserClient()): RootViewModel {
  const appService = new AppApplicationService(apiClient)
  const app = new AppViewModel(appService)

  return {
    app,
    updates: new AppUpdateViewModel(appService, () => app.language),
    dashboard: new DashboardViewModel(),
    device: new DeviceViewModel(appService, () => app.language)
  }
}
